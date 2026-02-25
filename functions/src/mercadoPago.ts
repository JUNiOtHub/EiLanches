/**
 * Cloud Functions do Mercado Pago — Pagamento Direto (sem split).
 *
 * Melhorias aplicadas:
 * - Usa inicialização centralizada do Firebase (sem duplo initializeApp)
 * - Credenciais vêm exclusivamente de variáveis de ambiente (token hardcoded removido)
 * - unit_price em REAIS (MP espera reais, não centavos)
 * - Verificação HMAC de assinatura no webhook
 * - Autenticação obrigatória em todas as callables
 * - Validação de entrada em todos os campos
 * - Idempotência no webhook (coleção webhook_events)
 * - Geração de PIX corrigida (preference.total não existe, agora usa API v1/payments direto)
 * - Estorno implementado de verdade via API do MP
 */

import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { Request, Response } from 'express';
import { db, admin } from './config/firebase';
import { MercadoPagoConfig, verifyWebhookSignature, getMercadoPagoHeaders } from './config/mercadoPago';

// ── Interfaces ────────────────────────────────────────────────────

interface PayerInfo {
  name: string;
  email: string;
  phone?: string;
  cpf?: string;
}

interface DeliveryAddress {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

interface PreferenceItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface CreatePreferenceData {
  orderId: string;
  items: PreferenceItem[];
  total: number;
  customer: PayerInfo;
  deliveryAddress?: DeliveryAddress;
  returnUrl: string;
  notificationUrl?: string;
}

interface PixPaymentData {
  orderId: string;
  amount: number;
  description?: string;
  payerEmail: string;
  payerCpf?: string;
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

// ── Cria preferência de pagamento ─────────────────────────────────

export const createMercadoPagoPreference = onCall({
  region: 'southamerica-east1',
}, async (request) => {
  requireAuth(request.auth);

  const data = request.data as CreatePreferenceData;
  const orderId = requireField(data.orderId, 'orderId');
  const items = requireField(data.items, 'items');
  const customer = requireField(data.customer, 'customer');
  const returnUrl = requireField(data.returnUrl, 'returnUrl');

  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpsError('invalid-argument', 'Lista de itens vazia.');
  }

  console.log('[MercadoPago] Criando preferencia para pedido:', orderId);

  // Formata itens — unit_price em REAIS (MP espera reais, NÃO centavos!)
  const mpItems = items.map((item) => ({
    id: item.id,
    title: item.name,
    quantity: item.quantity,
    unit_price: Number(item.price),
    currency_id: MercadoPagoConfig.SETTINGS.CURRENCY,
  }));

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

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
        cost: total > MercadoPagoConfig.SETTINGS.FREE_SHIPPING_THRESHOLD ? 0 : total * MercadoPagoConfig.SETTINGS.SHIPPING_RATE,
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
  };

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: getMercadoPagoHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[MercadoPago] Erro ao criar preferencia:', response.status, errorBody);
    throw new HttpsError('internal', 'Erro ao criar preferencia de pagamento.');
  }

  const preference = await response.json();
  console.log('[MercadoPago] Preferencia criada:', preference.id);

  return {
    preferenceId: preference.id,
    initPoint: preference.init_point,
  };
});

// ── Gera pagamento PIX direto via API v1/payments ─────────────────

export const generatePixPayment = onCall({
  region: 'southamerica-east1',
}, async (request) => {
  requireAuth(request.auth);

  const data = request.data as PixPaymentData;
  const orderId = requireField(data.orderId, 'orderId');
  const amount = requireField(data.amount, 'amount');
  const payerEmail = requireField(data.payerEmail, 'payerEmail');

  if (typeof amount !== 'number' || amount <= 0) {
    throw new HttpsError('invalid-argument', 'Valor do pagamento invalido.');
  }

  console.log('[MercadoPago] Gerando pagamento PIX para pedido:', orderId);

  // Idempotência: se já existe pagamento ativo, retorna ele
  const existingOrder = await db.collection('pedidos').doc(orderId).get();
  const existingData = existingOrder.data();
  if (existingData?.paymentId && existingData.paymentStatus !== 'rejected') {
    console.log('[MercadoPago] Pagamento ja existe para pedido:', orderId);
    return {
      paymentId: existingData.paymentId,
      status: existingData.paymentStatus || 'pending',
      alreadyExists: true,
    };
  }

  const body = {
    transaction_amount: amount,
    description: data.description || `EiLanches - Pedido #${orderId.slice(-6)}`,
    payment_method_id: 'pix',
    payer: {
      email: payerEmail,
      ...(data.payerCpf ? {
        identification: {
          type: 'CPF',
          number: data.payerCpf.replace(/\D/g, ''),
        },
      } : {}),
    },
    external_reference: orderId,
  };

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: getMercadoPagoHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[MercadoPago] Erro ao criar pagamento PIX:', response.status, errorBody);
    throw new HttpsError('internal', 'Erro ao gerar pagamento PIX.');
  }

  const payment = await response.json();

  // Salva referência no pedido
  await db.collection('pedidos').doc(orderId).update({
    paymentId: String(payment.id),
    paymentStatus: payment.status,
    paymentMethod: 'pix',
  });

  const txData = payment.point_of_interaction?.transaction_data;

  return {
    paymentId: String(payment.id),
    status: payment.status,
    qr_code: txData?.qr_code || null,
    qr_code_base64: txData?.qr_code_base64 || null,
    ticket_url: txData?.ticket_url || null,
    expiration_date: payment.date_of_expiration || null,
  };
});

// ── Verifica status do pagamento ──────────────────────────────────

export const checkMercadoPagoStatus = onCall({
  region: 'southamerica-east1',
}, async (request) => {
  requireAuth(request.auth);

  const { paymentId } = request.data || {};
  requireField(paymentId, 'paymentId');

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${MercadoPagoConfig.ACCESS_TOKEN}` },
  });

  if (!response.ok) {
    console.error('[MercadoPago] Erro ao verificar status:', response.status);
    throw new HttpsError('internal', 'Erro ao verificar status do pagamento.');
  }

  const payment = await response.json();

  return {
    status: payment.status,
    status_detail: payment.status_detail,
    payment_method_id: payment.payment_method_id,
  };
});

// ── Estorno de pagamento (implementação real) ─────────────────────

export const refundPayment = onCall({
  region: 'southamerica-east1',
}, async (request) => {
  requireAuth(request.auth);

  const { paymentId, amount, reason } = request.data || {};
  requireField(paymentId, 'paymentId');

  console.log('[MercadoPago] Solicitando estorno para pagamento:', paymentId);

  const body = amount ? { amount: Number(amount) } : {};

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
    method: 'POST',
    headers: getMercadoPagoHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[MercadoPago] Erro ao estornar:', response.status, errorBody);
    throw new HttpsError('internal', 'Erro ao processar estorno.');
  }

  const refund = await response.json();

  // Registra estorno para auditoria
  await db.collection('refunds').add({
    paymentId,
    refundId: String(refund.id),
    amount: refund.amount,
    reason: reason || 'Solicitado pelo sistema',
    status: refund.status,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    refundId: String(refund.id),
    status: refund.status,
    amount: refund.amount,
  };
});

// ── Processa webhook do Mercado Pago ──────────────────────────────

export const processMercadoPagoWebhook = onRequest({
  region: 'southamerica-east1',
}, async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo nao permitido' });
    return;
  }

  try {
    const { type, data } = req.body;
    const dataId = data?.id ? String(data.id) : '';

    // Verificação HMAC da assinatura do webhook
    const xSignature = req.headers['x-signature'] as string | undefined;
    const xRequestId = req.headers['x-request-id'] as string | undefined;

    if (!verifyWebhookSignature(xSignature, xRequestId, dataId)) {
      console.warn('[MercadoPago] Assinatura de webhook invalida.');
      res.status(401).json({ error: 'Assinatura invalida' });
      return;
    }

    if (type !== 'payment' || !dataId) {
      res.status(200).json({ ok: true, message: 'Evento ignorado' });
      return;
    }

    console.log('[MercadoPago] Webhook de pagamento:', dataId);

    // Idempotência: verifica se já processamos este pagamento
    const existingTx = await db.collection('webhook_events')
      .where('paymentId', '==', dataId)
      .where('provider', '==', 'mercadopago')
      .limit(1)
      .get();

    if (!existingTx.empty) {
      console.log('[MercadoPago] Webhook ja processado:', dataId);
      res.status(200).json({ ok: true, message: 'Ja processado' });
      return;
    }

    // Busca detalhes do pagamento na API do MP (não confia no body do webhook)
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${MercadoPagoConfig.ACCESS_TOKEN}` },
    });

    if (!paymentResponse.ok) {
      console.error('[MercadoPago] Erro ao buscar pagamento:', paymentResponse.status);
      res.status(500).json({ error: 'Falha ao consultar pagamento' });
      return;
    }

    const payment = await paymentResponse.json();
    const orderId = payment.external_reference;
    const status = payment.status;

    if (!orderId) {
      console.warn('[MercadoPago] Pagamento sem external_reference:', dataId);
      res.status(200).json({ ok: true });
      return;
    }

    const orderRef = db.collection('pedidos').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      console.warn('[MercadoPago] Pedido nao encontrado:', orderId);
      res.status(200).json({ ok: true, message: 'Pedido nao encontrado' });
      return;
    }

    // Atualiza status do pedido conforme pagamento
    if (status === 'approved') {
      await orderRef.update({
        status: 'preparando',
        paymentStatus: 'approved',
        paymentMethod: 'mercadopago',
        paymentId: dataId,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('[MercadoPago] Pedido aprovado:', orderId);
    } else if (status === 'rejected' || status === 'cancelled') {
      await orderRef.update({
        status: 'falha_pagamento',
        paymentStatus: status,
        paymentMethod: 'mercadopago',
        paymentId: dataId,
        rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('[MercadoPago] Pedido rejeitado/cancelado:', orderId);
    } else if (status === 'pending' || status === 'in_process') {
      await orderRef.update({
        paymentStatus: status,
        paymentMethod: 'mercadopago',
        paymentId: dataId,
      });
      console.log('[MercadoPago] Pedido pendente:', orderId);
    }

    // Registra evento para idempotência e auditoria
    await db.collection('webhook_events').add({
      paymentId: dataId,
      provider: 'mercadopago',
      orderId,
      status,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[MercadoPago] Erro no webhook:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});
