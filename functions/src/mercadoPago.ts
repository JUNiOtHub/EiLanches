import { onCall, onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
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

// Configuração do Mercado Pago
const mercadopago = require('mercadopago');
mercadopago.configure({
    access_token: process.env.MP_ACCESS_TOKEN_PROD || 'APP_USR-2754483714539775-021417-2a09f35b4da8ff5f3a0eaaf98bd0ca44-3203099803',
    sandbox: process.env.NODE_ENV !== 'production'
});

// Cria preferência de pagamento
export const createMercadoPagoPreference = onCall(async (request: CallableRequest) => {
    try {
        const { orderId, items, total, customer, deliveryAddress, returnUrl, notificationUrl } = request.data;

        console.log('[MercadoPago] Criando preferência para pedido:', orderId);

        // Formata itens para o Mercado Pago
        const mpItems = items.map((item: any) => ({
            id: item.id,
            title: item.name,
            quantity: item.quantity,
            unit_price: Math.round(item.price * 100), // Converte para centavos
            currency_id: 'BRL'
        }));

        // Cria a preferência
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
                cost: total > 50 ? 0 : Math.round(total * 0.1), // Frete grátis acima de R$50
                free_shipping: total > 50
            },
            payment_methods: {
                excluded_payment_types: ['ticket'], // Excluir boleto
                excluded_payment_methods: ['atm'] // Excluir pagamento em lotéricas
            },
            back_urls: {
                success: `${returnUrl}?status=success`,
                failure: `${returnUrl}?status=failure`,
                pending: `${returnUrl}?status=pending`
            },
            notification_url: notificationUrl,
            auto_return: 'approved',
            external_reference: orderId, // ID do nosso pedido
            expires: true,
            expiration_date_from: new Date(),
            expiration_date_to: new Date(Date.now() + 30 * 60 * 1000) // 30 minutos
        });

        console.log('[MercadoPago] Preferência criada:', preference.id);

        return {
            preferenceId: preference.id,
            initPoint: preference.init_point
        };

    } catch (error) {
        console.error('[MercadoPago] Erro ao criar preferência:', error);
        throw new Error('Erro ao criar preferência de pagamento');
    }
});

// Gera QR Code para Pix
export const generatePixQRCode = onCall(async (request: CallableRequest) => {
    try {
        const { preferenceId } = request.data;

        console.log('[MercadoPago] Gerando QR Code Pix para preferência:', preferenceId);

        // Busca a preferência
        const preference = await mercadopago.preferences.get(preferenceId);

        // Cria o pagamento Pix
        const payment = await mercadopago.payment.create({
            transaction_amount: preference.total,
            description: `EiLanches - Pedido ${preference.external_reference}`,
            payment_method_id: 'pix', // ID do Pix no Mercado Pago
            payer: {
                email: preference.payer.email,
                identification: preference.payer.identification
            },
            external_reference: preference.external_reference,
            notification_url: preference.notification_url,
            expires: true,
            expiration_date: new Date(Date.now() + 30 * 60 * 1000) // 30 minutos
        });

        console.log('[MercadoPago] Pagamento Pix criado:', payment.id);

        // Gera o QR Code
        const qrCode = await mercadopago.payment.get(payment.id);

        return {
            qr_code: qrCode.point_of_interaction.transaction_data.qr_code_base64,
            qr_code_base64: qrCode.point_of_interaction.transaction_data.qr_code,
            transaction_id: qrCode.point_of_interaction.transaction_id,
            amount: qrCode.transaction_amount,
            expiration_date: qrCode.date_of_expiration
        };

    } catch (error) {
        console.error('[MercadoPago] Erro ao gerar QR Code:', error);
        throw new Error('Erro ao gerar QR Code Pix');
    }
});

// Verifica status do pagamento
export const checkMercadoPagoStatus = onCall(async (request: CallableRequest) => {
    try {
        const { paymentId } = request.data;

        console.log('[MercadoPago] Verificando status do pagamento:', paymentId);

        const payment = await mercadopago.payment.get(paymentId);

        console.log('[MercadoPago] Status:', payment.status);

        return {
            status: payment.status,
            status_detail: payment.status_detail,
            payment_method_id: payment.payment_method_id
        };

    } catch (error) {
        console.error('[MercadoPago] Erro ao verificar status:', error);
        throw new Error('Erro ao verificar status do pagamento');
    }
});

// Processa webhook do Mercado Pago
export const processMercadoPagoWebhook = onRequest(async (req: Request, res: Response) => {
    try {
        console.log('[MercadoPago] Webhook recebido:', req.body);

        const { type, data } = req.body;

        // Verifica se é um pagamento
        if (type === 'payment') {
            const payment = data;

            console.log('[MercadoPago] Processando pagamento:', payment.id);

            // Atualiza o status no Firebase
            const orderId = payment.external_reference;

            if (payment.status === 'approved') {
                // Pagamento aprovado
                await db.collection('pedidos').doc(orderId).update({
                    status: 'preparando',
                    paymentStatus: 'approved',
                    paymentMethod: 'mercadopago',
                    paymentId: payment.id,
                    approvedAt: new Date(),
                    paidAt: new Date()
                });

                console.log('[MercadoPago] Pedido', orderId, 'aprovado e atualizado para preparando');

            } else if (payment.status === 'rejected') {
                // Pagamento recusado
                await db.collection('pedidos').doc(orderId).update({
                    status: 'falha_pagamento',
                    paymentStatus: 'rejected',
                    paymentMethod: 'mercadopago',
                    paymentId: payment.id,
                    rejectedAt: new Date()
                });

                console.log('[MercadoPago] Pedido', orderId, 'rejeitado');

            } else if (payment.status === 'pending') {
                // Pagamento pendente
                await db.collection('pedidos').doc(orderId).update({
                    status: 'pendente',
                    paymentStatus: 'pending',
                    paymentMethod: 'mercadopago',
                    paymentId: payment.id
                });

                console.log('[MercadoPago] Pedido', orderId, 'pendente');
            }
        }

        res.status(200).json({ ok: true });

    } catch (error) {
        console.error('[MercadoPago] Erro ao processar webhook:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});
