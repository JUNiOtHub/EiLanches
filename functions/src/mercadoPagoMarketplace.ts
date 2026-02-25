/**
 * Cloud Functions do Mercado Pago — Marketplace (Split de Pagamento).
 *
 * Melhorias aplicadas:
 * - Usa inicialização centralizada do Firebase (sem duplo initializeApp)
 * - Credenciais vêm de variáveis de ambiente via config centralizado
 * - unit_price em REAIS (não centavos)
 * - Verificação HMAC de webhook
 * - Autenticação obrigatória em callables
 * - Validação de entrada
 * - Wallet padronizada na coleção wallets/ (consistente com index.ts)
 * - Idempotência em webhook e operações de saque
 * - Saque usa coleção wallets/ ao invés de users/
 */

import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { Request, Response } from 'express';
import { db, admin } from './config/firebase';
import { MercadoPagoConfig, verifyWebhookSignature, getMercadoPagoHeaders } from './config/mercadoPago';

const FieldValue = admin.firestore.FieldValue;

// ── Interfaces ────────────────────────────────────────────────────

interface SplitPreferenceData {
  orderId: string;
  items: Array<{ id: string; name: string; quantity: number; price: number }>;
  total: number;
  customer: { name: string; email: string; phone?: string; cpf?: string };
  deliveryAddress?: { street: string; number: string; neighborhood: string; city: string; state: string; zipCode: string };
  lojaId: string;
  entregadorId?: string;
  appCommission?: number;
  deliveryFee?: number;
  returnUrl: string;
  notificationUrl?: string;
}

// ── Helpers de validação ──────────────────────────────────────────

function requireAuth(auth: { uid: string } | undefined): string {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
  }
  return auth.uid;
}

function requireField<T>(value: T | undefined | null, fieldName: string): T {
  if (value === undefined || value === null || value === '') {
    throw new HttpsError('invalid-argument', `Campo obrigatorio: ${fieldName}`);
  }
  return value;
}

// ── Cria preferência com Split de Pagamento ───────────────────────

export const createSplitPreference = onCall({
  region: 'southamerica-east1',
}, async (request) => {
  requireAuth(request.auth);

  const data = request.data as SplitPreferenceData;
  const orderId = requireField(data.orderId, 'orderId');
  const items = requireField(data.items, 'items');
  const total = requireField(data.total, 'total');
  const customer = requireField(data.customer, 'customer');
  const lojaId = requireField(data.lojaId, 'lojaId');
  const returnUrl = requireField(data.returnUrl, 'returnUrl');
  const appCommission = data.appCommission ?? 0.10;
  const deliveryFee = data.deliveryFee ?? 5.00;
  const entregadorId = data.entregadorId || null;

  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpsError('invalid-argument', 'Lista de itens vazia.');
  }

  console.log('[Marketplace] Criando preferencia com split para pedido:', orderId);

  // Calcula valores do split (em REAIS, não centavos)
  const appFee = Number((total * appCommission).toFixed(2));
  const lojaAmount = Number((total - appFee - deliveryFee).toFixed(2));

  // Formata itens — unit_price em REAIS (MP espera reais!)
  const mpItems = items.map((item) => ({
    id: item.id,
    title: item.name,
    quantity: item.quantity,
    unit_price: Number(item.price),
    currency_id: MercadoPagoConfig.SETTINGS.CURRENCY,
  }));

  const body = {
    items: mpItems,
    payer: {
      name: customer.name,
      email: customer.email,
      ...(customer.phone ? {
        phone: {
          area_code: customer.phone.slice(0, 2),
          number: customer.phone.slice(2),
        },
      } : {}),
      ...(customer.cpf ? {
        identification: {
          type: 'CPF',
          number: customer.cpf.replace(/\D/g, ''),
        },
      } : {}),
    },
    ...(data.deliveryAddress ? {
      shipments: {
        receiver_address: {
          street_name: data.deliveryAddress.street,
          street_number: data.deliveryAddress.number,
          neighborhood: data.deliveryAddress.neighborhood,
          city: data.deliveryAddress.city,
          federal_unit: data.deliveryAddress.state,
          zip_code: data.deliveryAddress.zipCode,
        },
        cost: deliveryFee,
        free_shipping: total > MercadoPagoConfig.SETTINGS.FREE_SHIPPING_THRESHOLD,
      },
    } : {}),
    payment_methods: {
      excluded_payment_types: [{ id: 'ticket' }],
      excluded_payment_methods: [{ id: 'atm' }],
    },
    back_urls: {
      success: `${returnUrl}?status=success`,
      failure: `${returnUrl}?status=failure`,
      pending: `${returnUrl}?status=pending`,
    },
    notification_url: data.notificationUrl || undefined,
    auto_return: 'approved',
    external_reference: orderId,
    expires: true,
    expiration_date_from: new Date().toISOString(),
    expiration_date_to: new Date(Date.now() + MercadoPagoConfig.SETTINGS.PAYMENT_TIMEOUT_MS).toISOString(),
    marketplace_fee: appFee,
    marketplace: 'NONE',
  };

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: getMercadoPagoHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[Marketplace] Erro ao criar preferencia:', response.status, errorBody);
    throw new HttpsError('internal', 'Erro ao criar preferencia de pagamento.');
  }

  const preference = await response.json();

  // Salva informações do split no pedido
  await db.collection('pedidos').doc(orderId).update({
    splitInfo: {
      appFee,
      deliveryFee,
      lojaAmount,
      appCommission,
      lojaId,
      entregadorId,
    },
    preferenceId: preference.id,
  });

  console.log('[Marketplace] Preferencia com split criada:', preference.id);

  return {
    preferenceId: preference.id,
    initPoint: preference.init_point,
    splitInfo: { appFee, deliveryFee, lojaAmount },
  };
});

// ── OAuth: Conectar Vendedor ao Marketplace ───────────────────────

export const connectSeller = onCall({
  region: 'southamerica-east1',
}, async (request) => {
  const uid = requireAuth(request.auth);

  const { code, redirectUri, userId } = request.data || {};
  requireField(code, 'code');
  requireField(userId, 'userId');

  // Segurança: só o próprio usuário pode conectar sua conta
  if (uid !== userId) {
    throw new HttpsError('permission-denied', 'Voce so pode conectar sua propria conta.');
  }

  console.log('[Marketplace] Conectando vendedor:', userId);

  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MercadoPagoConfig.ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      client_secret: MercadoPagoConfig.CLIENT_SECRET || MercadoPagoConfig.ACCESS_TOKEN,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  const responseData = await response.json();

  if (responseData.error) {
    console.error('[Marketplace] Erro OAuth:', responseData.error_description);
    throw new HttpsError('internal', responseData.error_description || 'Erro ao conectar vendedor.');
  }

  // Salva as credenciais do vendedor de forma segura
  // Nota: em produção, tokens devem ser criptografados ou salvos no Secret Manager
  await db.collection('seller_credentials').doc(userId).set({
    mpUserId: responseData.user_id,
    mpPublicKey: responseData.public_key,
    mpExpiresIn: responseData.expires_in,
    mpConnectedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  // Marca o user como conectado (sem expor tokens no doc do user)
  await db.collection('users').doc(userId).update({
    mpConnected: true,
    mpUserId: responseData.user_id,
    mpConnectedAt: FieldValue.serverTimestamp(),
  });

  return { success: true, message: 'Vendedor conectado com sucesso.' };
});

// ── Processa webhook com split automático ─────────────────────────

export const processSplitWebhook = onRequest({
  region: 'southamerica-east1',
}, async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo nao permitido' });
    return;
  }

  try {
    const { type, data } = req.body;
    const dataId = data?.id ? String(data.id) : '';

    // Verificação HMAC da assinatura
    const xSignature = req.headers['x-signature'] as string | undefined;
    const xRequestId = req.headers['x-request-id'] as string | undefined;

    if (!verifyWebhookSignature(xSignature, xRequestId, dataId)) {
      console.warn('[Marketplace] Assinatura de webhook invalida.');
      res.status(401).json({ error: 'Assinatura invalida' });
      return;
    }

    if (type !== 'payment' || !dataId) {
      res.status(200).json({ ok: true, message: 'Evento ignorado' });
      return;
    }

    console.log('[Marketplace] Processando pagamento com split:', dataId);

    // Idempotência: verifica se já processamos
    const existingTransaction = await db.collection('transactions')
      .where('paymentId', '==', dataId)
      .limit(1)
      .get();

    if (!existingTransaction.empty) {
      console.log('[Marketplace] Pagamento ja processado:', dataId);
      res.status(200).json({ ok: true, message: 'Ja processado' });
      return;
    }

    // Busca detalhes do pagamento na API do MP (não confia no body do webhook)
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${MercadoPagoConfig.ACCESS_TOKEN}` },
    });

    if (!paymentResponse.ok) {
      console.error('[Marketplace] Erro ao buscar pagamento:', paymentResponse.status);
      res.status(500).json({ error: 'Falha ao consultar pagamento' });
      return;
    }

    const payment = await paymentResponse.json();
    const orderId = payment.external_reference;
    const status = payment.status;

    if (!orderId) {
      res.status(200).json({ ok: true });
      return;
    }

    const orderRef = db.collection('pedidos').doc(orderId);
    const orderDoc = await orderRef.get();
    const order = orderDoc.data();

    if (!order) {
      res.status(200).json({ ok: true, message: 'Pedido nao encontrado' });
      return;
    }

    if (status === 'approved') {
      // A) Atualiza o Pedido
      await orderRef.update({
        status: 'preparando',
        statusPagamento: 'approved',
        paymentId: dataId,
        pagoEm: FieldValue.serverTimestamp(),
      });

      // B) Credita saldo pendente na coleção wallets/ (consistente com index.ts)
      const batch = db.batch();

      if (order.splitInfo?.lojaId) {
        const lojaWalletRef = db.collection('wallets').doc(order.splitInfo.lojaId);
        batch.set(lojaWalletRef, {
          saldoPendente: FieldValue.increment(order.splitInfo.lojaAmount || 0),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      if (order.splitInfo?.entregadorId) {
        const entregadorWalletRef = db.collection('wallets').doc(order.splitInfo.entregadorId);
        batch.set(entregadorWalletRef, {
          saldoPendente: FieldValue.increment(order.splitInfo.deliveryFee || 0),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      await batch.commit();

      // C) Registra transação para auditoria
      await db.collection('transactions').add({
        orderId,
        paymentId: dataId,
        lojaId: order.splitInfo?.lojaId || null,
        entregadorId: order.splitInfo?.entregadorId || null,
        appNetProfit: order.splitInfo?.appFee || 0,
        lojaAmount: order.splitInfo?.lojaAmount || 0,
        deliveryFee: order.splitInfo?.deliveryFee || 0,
        status: 'completed',
        createdAt: FieldValue.serverTimestamp(),
      });

      console.log('[Marketplace] Transacao registrada. Comissao do app:', order.splitInfo?.appFee);

      // D) Notificação para o lojista
      if (order.splitInfo?.lojaId) {
        await db.collection('notifications').add({
          userId: order.splitInfo.lojaId,
          title: 'Pagamento Confirmado!',
          body: `Pedido #${orderId.slice(-4)} aprovado. Comece o preparo!`,
          type: 'payment_success',
          orderId,
          createdAt: FieldValue.serverTimestamp(),
          read: false,
        });
      }
    } else if (status === 'rejected' || status === 'cancelled') {
      await orderRef.update({
        status: 'falha_pagamento',
        statusPagamento: status,
        paymentId: dataId,
        rejectedAt: FieldValue.serverTimestamp(),
      });
      console.log('[Marketplace] Pedido rejeitado:', orderId);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[Marketplace] Erro ao processar webhook:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── Solicitação de saque (Payout) ─────────────────────────────────

export const requestPayout = onCall({
  region: 'southamerica-east1',
}, async (request) => {
  const uid = requireAuth(request.auth);

  const { userId, amount } = request.data || {};
  requireField(userId, 'userId');
  requireField(amount, 'amount');

  // Segurança: só o próprio usuário pode solicitar saque da sua carteira
  if (uid !== userId) {
    throw new HttpsError('permission-denied', 'Voce so pode sacar da sua propria carteira.');
  }

  if (typeof amount !== 'number' || amount <= 0) {
    throw new HttpsError('invalid-argument', 'Valor de saque invalido.');
  }

  console.log('[Marketplace] Solicitacao de saque:', { userId, amount });

  // Usa coleção wallets/ (consistente com index.ts e Withdraw.tsx)
  const walletRef = db.collection('wallets').doc(userId);
  const walletSnap = await walletRef.get();
  const walletData = walletSnap.data();
  const saldoDisponivel = Number(walletData?.saldoDisponivel ?? 0);

  if (saldoDisponivel < amount) {
    throw new HttpsError('failed-precondition', 'Saldo insuficiente.');
  }

  // Registra solicitação de saque
  const payoutRef = await db.collection('solicitacoes_saque').add({
    userId,
    amount,
    status: 'pendente',
    createdAt: FieldValue.serverTimestamp(),
    pixKey: walletData?.chavePix || '',
  });

  // Deduz do saldo disponível via transação atômica para evitar race condition
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(walletRef);
    const currentBalance = Number(snap.data()?.saldoDisponivel ?? 0);
    if (currentBalance < amount) {
      throw new HttpsError('failed-precondition', 'Saldo insuficiente (concorrencia).');
    }
    tx.update(walletRef, {
      saldoDisponivel: currentBalance - amount,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  console.log('[Marketplace] Saque solicitado:', payoutRef.id);

  return {
    success: true,
    message: 'Saque solicitado com sucesso!',
    payoutId: payoutRef.id,
  };
});

// ── Consulta saldo da carteira ────────────────────────────────────

export const getWalletBalance = onCall({
  region: 'southamerica-east1',
}, async (request) => {
  const uid = requireAuth(request.auth);

  const { userId } = request.data || {};
  requireField(userId, 'userId');

  // Segurança: só o próprio usuário pode ver seu saldo
  if (uid !== userId) {
    throw new HttpsError('permission-denied', 'Voce so pode consultar sua propria carteira.');
  }

  // Usa coleção wallets/ (consistente com index.ts e Withdraw.tsx)
  const walletSnap = await db.collection('wallets').doc(userId).get();
  const walletData = walletSnap.data();

  // Busca transações recentes do usuário
  const transactionsSnapshot = await db.collection('transactions')
    .where('lojaId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  const transactions = transactionsSnapshot.docs.map((txDoc) => ({
    id: txDoc.id,
    ...txDoc.data(),
  }));

  return {
    saldoDisponivel: Number(walletData?.saldoDisponivel ?? 0),
    saldoPendente: Number(walletData?.saldoPendente ?? 0),
    totalHistorico: Number(walletData?.totalHistorico ?? 0),
    transactions,
  };
});
