import { onCall, onRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';
import { Request, Response } from 'express';

// Type para CallableRequest
interface CallableRequest {
    data: any;
    auth?: any;
}

// Inicializa Firebase Admin
initializeApp();

const db = getFirestore();

// Configuração do Mercado Pago Marketplace
const mercadopago = require('mercadopago');
mercadopago.configure({
    access_token: process.env.MP_ACCESS_TOKEN_PROD,
    sandbox: process.env.NODE_ENV !== 'production'
});

// Cria preferência com Split de Pagamento
export const createSplitPreference = onCall(async (request: CallableRequest) => {
    try {
        const {
            orderId,
            items,
            total,
            customer,
            deliveryAddress,
            lojaId,
            entregadorId,
            appCommission = 0.10,
            deliveryFee = 5.00,
            returnUrl,
            notificationUrl
        } = request.data;

        console.log('[Marketplace] Criando preferência com split para pedido:', orderId);

        // Calcula valores do split
        const totalCents = Math.round(total * 100);
        const appFeeCents = Math.round(total * appCommission * 100);
        const deliveryFeeCents = Math.round(deliveryFee * 100);
        const lojaAmountCents = totalCents - appFeeCents - deliveryFeeCents;

        // Formata itens para o Mercado Pago
        const mpItems = items.map((item: any) => ({
            id: item.id,
            title: item.name,
            quantity: item.quantity,
            unit_price: Math.round(item.price * 100),
            currency_id: 'BRL'
        }));

        // Cria a preferência com split
        const preference = await mercadopago.preferences.create({
            items: mpItems,
            payer: {
                name: customer.name,
                email: customer.email,
                phone: {
                    area_code: customer.phone.slice(0, 2),
                    number: customer.phone.slice(2)
                },
                identification: customer.cpf ? {
                    type: 'CPF',
                    number: customer.cpf.replace(/\D/g, '')
                } : undefined
            },
            shipments: {
                receiver_address: deliveryAddress ? {
                    street_name: deliveryAddress.street,
                    street_number: deliveryAddress.number,
                    neighborhood: deliveryAddress.neighborhood,
                    city: deliveryAddress.city,
                    federal_unit: deliveryAddress.state,
                    zip_code: deliveryAddress.zipCode
                } : undefined,
                cost: deliveryFeeCents,
                free_shipping: total > 50 // Exemplo de regra de frete grátis
            },
            payment_methods: {
                excluded_payment_types: ['ticket'],
                excluded_payment_methods: ['atm']
            },
            back_urls: {
                success: `${returnUrl}?status=success`,
                failure: `${returnUrl}?status=failure`,
                pending: `${returnUrl}?status=pending`
            },
            notification_url: notificationUrl,
            auto_return: 'approved',
            external_reference: orderId,
            expires: true,
            expiration_date_from: new Date(),
            expiration_date_to: new Date(Date.now() + 30 * 60 * 1000),

            // CONFIGURAÇÃO DO SPLIT
            marketplace_fee: appFeeCents / 100,

            // Split entre vendedores (Marketplace)
            marketplace: 'YES',

            // Configuração dos recebedores
            seller_id: lojaId, // ID da loja no Mercado Pago

            // Distribuição automática
            differential_pricing: [{
                id: lojaId,
                type: 'seller'
            }]
        });

        // Salva informações do split no Firestore
        await db.collection('pedidos').doc(orderId).update({
            splitInfo: {
                appFee: appFeeCents / 100,
                deliveryFee: deliveryFeeCents / 100,
                lojaAmount: lojaAmountCents / 100,
                appCommission,
                lojaId,
                entregadorId
            },
            preferenceId: preference.id
        });

        console.log('[Marketplace] Preferência com split criada:', preference.id);

        return {
            preferenceId: preference.id,
            initPoint: preference.init_point,
            splitInfo: {
                appFee: appFeeCents / 100,
                deliveryFee: deliveryFeeCents / 100,
                lojaAmount: lojaAmountCents / 100
            }
        };

    } catch (error) {
        console.error('[Marketplace] Erro ao criar preferência com split:', error);
        throw new Error('Erro ao criar preferência de pagamento');
    }
});

// OAuth: Conectar Vendedor ao Marketplace
export const connectSeller = onCall(async (request: CallableRequest) => {
    try {
        const { code, redirectUri, userId } = request.data;

        if (!code || !userId) {
            throw new Error('Código de autorização e ID do usuário são obrigatórios');
        }

        console.log('[Marketplace] Conectando vendedor:', userId);

        // Troca o código pelo token de acesso
        const response = await fetch('https://api.mercadopago.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN_PROD}`
            },
            body: JSON.stringify({
                client_secret: process.env.MP_ACCESS_TOKEN_PROD,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error_description || 'Erro ao conectar vendedor');
        }

        // Salva as credenciais do vendedor no Firestore
        await db.collection('users').doc(userId).update({
            mpAccessToken: data.access_token,
            mpRefreshToken: data.refresh_token,
            mpUserId: data.user_id,
            mpExpiresIn: data.expires_in,
            mpPublicKey: data.public_key,
            mpConnectedAt: FieldValue.serverTimestamp()
        });

        return { success: true, message: 'Vendedor conectado com sucesso' };

    } catch (error) {
        console.error('[Marketplace] Erro ao conectar vendedor:', error);
        throw new Error('Erro ao conectar vendedor ao Mercado Pago');
    }
});

// Processa webhook com split automático
export const processSplitWebhook = onRequest(async (req: Request, res: Response) => {
    try {
        console.log('[Marketplace] Webhook recebido:', req.body);

        const { type, data } = req.body;

        if (type === 'payment') {
            const paymentId = String(data.id);
            
            console.log('[Marketplace] Processando pagamento com split:', paymentId);

            // Idempotência: Verifica se o pagamento já foi processado
            const existingTransaction = await db.collection('transactions').where('paymentId', '==', paymentId).get();
            if (!existingTransaction.empty) {
                console.log('[Marketplace] Pagamento já processado:', paymentId);
                res.status(200).json({ ok: true, message: 'Already processed' });
                return;
            }
            
            // Busca detalhes do pagamento no MP
            const payment = await mercadopago.payment.get(paymentId);
            const orderId = payment.body.external_reference;
            const status = payment.body.status;

            const orderRef = db.collection('pedidos').doc(orderId);
            const orderDoc = await orderRef.get();
            const order = orderDoc.data();

            if (!order) {
                res.status(404).send('Pedido não encontrado');
                return;
            }

            if (status === 'approved') {
                // A) Atualiza o Pedido
                await orderRef.update({
                    status: 'preparando',
                    statusPagamento: 'approved',
                    pagoEm: FieldValue.serverTimestamp()
                });

                // B) Split de Saldo (Lojista e Entregador)
                const batch = db.batch();
                
                // Crédito para lojista (saldo pendente)
                if (order.splitInfo?.lojaId) {
                    const lojaRef = db.collection('users').doc(order.splitInfo.lojaId);
                    batch.update(lojaRef, { 
                        pendingBalance: FieldValue.increment(order.splitInfo.lojaAmount || 0),
                        lastTransaction: FieldValue.serverTimestamp()
                    });
                }

                // Crédito para entregador (saldo pendente)
                if (order.splitInfo?.entregadorId) {
                    const entregadorRef = db.collection('users').doc(order.splitInfo.entregadorId);
                    batch.update(entregadorRef, { 
                        pendingBalance: FieldValue.increment(order.splitInfo.deliveryFee || 0),
                        lastTransaction: FieldValue.serverTimestamp()
                    });
                }
                
                await batch.commit();

                // C) Registra a Transação para Auditoria
                await db.collection('transactions').add({
                    orderId,
                    paymentId,
                    lojaId: order.splitInfo?.lojaId,
                    entregadorId: order.splitInfo?.entregadorId,
                    appNetProfit: order.splitInfo?.appFee,
                    lojaAmount: order.splitInfo?.lojaAmount,
                    deliveryFee: order.splitInfo?.deliveryFee,
                    status: 'completed',
                    createdAt: FieldValue.serverTimestamp()
                });

                console.log('[Marketplace] Transação registrada. Comissão do app:', order.splitInfo?.appFee);

                // D) Notificações Push
                if (order.splitInfo?.lojaId) {
                    await db.collection('notifications').add({
                        userId: order.splitInfo.lojaId,
                        title: '💵 Pagamento Confirmado!',
                        body: `Pedido #${orderId.slice(-4)} aprovado. Comece o preparo!`,
                        type: 'payment_success',
                        orderId: orderId,
                        createdAt: new Date(),
                        read: false
                    });
                }
            } else if (status === 'rejected' || status === 'cancelled') {
                await orderRef.update({ 
                    status: 'falha_pagamento', 
                    statusPagamento: status,
                    paymentId: paymentId,
                    rejectedAt: FieldValue.serverTimestamp()
                });

                console.log('[Marketplace] Pedido', orderId, 'rejeitado');
            }
        }

        res.status(200).json({ ok: true });

    } catch (error) {
        console.error('[Marketplace] Erro ao processar webhook:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Solicitação de saque (Payout)
export const requestPayout = onCall(async (request: CallableRequest) => {
    try {
        const { userId, amount } = request.data;

        console.log('[Marketplace] Solicitação de saque:', { userId, amount });

        // Verifica saldo disponível
        const userDoc = await db.collection('users').doc(userId).get();
        const user = userDoc.data();

        // Verifica se tem saldo disponível (não pendente)
        const saldoDisponivel = user?.walletBalance || 0; // Assumindo que walletBalance é o saldo liberado

        if (!user || saldoDisponivel < amount) {
            throw new Error('Saldo insuficiente');
        }

        // Registra solicitação de saque para processamento (manual ou automático posterior)
        // Por segurança, não chamamos a API de Payout diretamente aqui sem validação adicional
        const payoutRef = await db.collection('payouts').add({
            userId,
            amount,
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
            pixKey: user.chavePix || user.telefone // Usa chave PIX do perfil
        });

        // Deduz do saldo imediatamente para evitar saque duplo
        await db.collection('users').doc(userId).update({
            walletBalance: FieldValue.increment(-amount),
            lastPayoutRequest: FieldValue.serverTimestamp()
        });

        console.log('[Marketplace] Saque solicitado:', payoutRef.id);

        return {
            success: true,
            message: 'Saque solicitado com sucesso!',
            payoutId: payoutRef.id
        };

    } catch (error) {
        console.error('[Marketplace] Erro ao solicitar saque:', error);
        throw new Error('Erro ao solicitar saque');
    }
});

// Consulta saldo da carteira
export const getWalletBalance = onCall(async (request: CallableRequest) => {
    try {
        const { userId } = request.data;

        const userDoc = await db.collection('users').doc(userId).get();
        const user = userDoc.data();

        if (!user) {
            throw new Error('Usuário não encontrado');
        }

        // Busca transações recentes
        const transactionsSnapshot = await db.collection('transactions')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        const transactions = transactionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return {
            balance: user.walletBalance || 0,
            lastTransaction: user.lastTransaction,
            transactions: transactions
        };

    } catch (error) {
        console.error('[Marketplace] Erro ao consultar saldo:', error);
        throw new Error('Erro ao consultar saldo');
    }
});