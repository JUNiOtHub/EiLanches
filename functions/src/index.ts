/**
 * EiLanches - Cloud Functions (Ponto de entrada principal)
 *
 * Melhorias aplicadas:
 * - Usa inicialização centralizada do Firebase (sem múltiplos initializeApp)
 * - Fix: totalHistorico não é mais incrementado duas vezes (removido do creditLojistaPendente)
 * - Validações mais robustas no validateDeliveryPIN
 * - Exporta novas functions: generatePixPayment, refundPayment, checkMercadoPagoStatus
 */

import { createSplitPreference, processSplitWebhook, requestPayout, getWalletBalance, connectSeller } from './mercadoPagoMarketplace';
import { createMercadoPagoPreference, generatePixPayment, refundPayment, checkMercadoPagoStatus, processMercadoPagoWebhook } from './mercadoPago';
import { generateWeeklyReport } from './reportService';

import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, admin } from './config/firebase';

/**
 * Credita saldo PENDENTE na carteira do lojista.
 * totalHistorico NÃO é incrementado aqui — só em validateDeliveryPIN ao concluir a entrega,
 * evitando dupla contagem.
 */
function creditLojistaPendente(tx: admin.firestore.Transaction, lojaId: string, netValue: number, orderRef: admin.firestore.DocumentReference) {
  const walletRef = db.doc(`wallets/${lojaId}`);
  return tx.get(walletRef).then((snap) => {
    const pendente = snap.exists ? Number(snap.data()?.saldoPendente ?? 0) : 0;
    const disponivel = snap.exists ? Number(snap.data()?.saldoDisponivel ?? 0) : 0;
    tx.set(walletRef, {
      saldoPendente: pendente + netValue,
      saldoDisponivel: disponivel,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.update(orderRef, { walletCreditedPendente: true });
  });
}

/**
 * Ao atualizar um documento em pedidos/{pedidoId}, se o status for "concluido",
 * incrementa o saldo de pontos do cliente no users/{clienteUid}.
 * Só credita uma vez por pedido (usa campo loyaltyPointsCredited no pedido).
 */
export const onOrderConcludedCreditLoyalty = onDocumentUpdated({
  document: "pedidos/{pedidoId}",
  region: "southamerica-east1",
}, async (event) => {
    const snap = event.data;
    if (!snap) {
      return null;
    }
    const after = snap.after.data();
    const before = snap.before.data();

    const newStatus = after?.status;
    const oldStatus = before?.status;

    // Só age quando o status passa a ser "concluido"
    if (newStatus !== "concluido" || oldStatus === "concluido") {
      return null;
    }

    const pedidoId = event.params.pedidoId;
    const clienteUid = after?.clienteUid;
    const pointsEarned = typeof after?.loyaltyPointsEarned === "number"
      ? after.loyaltyPointsEarned
      : 0;

    if (!clienteUid || pointsEarned <= 0) {
      return null;
    }

    // Evita crédito duplicado (ex.: se a função rodar duas vezes)
    if (after?.loyaltyPointsCredited === true) {
      return null;
    }

    const userRef = db.doc(`users/${clienteUid}`);
    const pedidoRef = snap.after.ref;

    try {
      await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        const currentPoints = userSnap.exists && typeof userSnap.data()?.loyaltyPoints === "number"
          ? userSnap.data()!.loyaltyPoints
          : 0;

        tx.update(userRef, {
          loyaltyPoints: currentPoints + pointsEarned,
        });

        tx.update(pedidoRef, {
          loyaltyPointsCredited: true,
          loyaltyPointsCreditedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    } catch (e) {
      console.error("onOrderConcludedCreditLoyalty", { pedidoId, clienteUid, pointsEarned, error: e });
      throw e;
    }

    return null;
  });

/**
 * Ao criar um pedido: credita o saldo pendente da carteira do lojista (dinheiro/cartão).
 * Ao atualizar um pedido: se asaasPaymentId for definido (PIX gerado), credita o pendente do lojista.
 */
export const onOrderCreatedCreditWallet = onDocumentCreated({
  document: "pedidos/{pedidoId}",
  region: "southamerica-east1",
}, async (event) => {
    const snap = event.data;
    if (!snap) return null;

    const data = snap.data();
    if (!data || data.walletCreditedPendente || data.status === "falha_pagamento") return null;
    const lojaId = data.lojaId;
    const netValue = Number(data.netValue ?? 0);
    if (!lojaId || netValue <= 0) return null;
    if (data.paymentMethod === "pix") return null; // PIX será creditado no onUpdate quando asaasPaymentId for setado
    const orderRef = snap.ref;
    await db.runTransaction((tx) => creditLojistaPendente(tx, lojaId, netValue, orderRef));
    return null;
  });

/**
 * Quando um pedido recebe asaasPaymentId (PIX gerado), credita o pendente do lojista.
 */
export const onOrderUpdatedCreditWalletPix = onDocumentUpdated({
  document: "pedidos/{pedidoId}",
  region: "southamerica-east1",
}, async (event) => {
    const snap = event.data;
    if (!snap) return null;
    const before = snap.before.data();
    const after = snap.after.data();

    if (!after || after.walletCreditedPendente || after.status === "falha_pagamento") return null;
    if (!after.asaasPaymentId || before.asaasPaymentId) return null; // só quando asaasPaymentId acaba de ser setado
    const lojaId = after.lojaId;
    const netValue = Number(after.netValue ?? 0);
    if (!lojaId || netValue <= 0) return null;
    const orderRef = snap.after.ref;
    await db.runTransaction((tx) => creditLojistaPendente(tx, lojaId, netValue, orderRef));
    return null;
  });

/**
 * Valida o PIN de entrega e marca o pedido como concluído.
 * Callable (httpsCallable no front) — o Firebase trata CORS automaticamente para callables.
 */
export const validateDeliveryPIN = onCall({
  region: "southamerica-east1",
}, async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    const { orderId, pin } = request.data || {};
    const contextUid = request.auth.uid;

    if (!orderId || pin === undefined || pin === null) {
      throw new HttpsError("invalid-argument", "orderId e pin são obrigatórios.");
    }

    const pedidoRef = db.doc(`pedidos/${orderId}`);
    const snap = await pedidoRef.get();
    if (!snap.exists) {
      return { success: false, message: "Pedido não encontrado." };
    }

    const pedido = snap.data()!;

    // --- LÓGICA DE AUTORIZAÇÃO MELHORADA ---
    const isDriver = contextUid === pedido.entregadorUid;
    const isShopOwnerForPickup = contextUid === pedido.lojaId && pedido.deliveryMode === "pickup";

    if (!isDriver && !isShopOwnerForPickup) {
      throw new HttpsError("permission-denied", "Você não tem permissão para confirmar este pedido.");
    }

    const codigoCorreto = String(pedido.deliveryCode || "").trim();
    const codigoInformado = String(pin).trim();

    if (codigoCorreto !== codigoInformado) {
      return { success: false, message: "Código inválido." };
    }

    const lojaId = pedido.lojaId;
    const netValue = Number(pedido.netValue ?? pedido.finalTotal ?? 0);
    const driverFee = Number(pedido.driverFee ?? pedido.deliveryFee ?? 0);
    const alreadyLiberado = pedido.walletLiberado === true;
    const lojaWalletRef = db.doc(`wallets/${lojaId}`);
    const driverWalletRef = db.doc(`wallets/${pedido.entregadorUid || 'no_driver'}`);

    await db.runTransaction(async (tx) => {
      // Leituras primeiro (exigência do Firestore)
      const [lojaSnap, driverSnap] = await Promise.all([
        lojaId ? tx.get(lojaWalletRef) : Promise.resolve(null),
        isDriver && driverFee > 0 ? tx.get(driverWalletRef) : Promise.resolve(null),
      ]);

      const lojaPendente = lojaSnap?.exists ? Number(lojaSnap.data()?.saldoPendente ?? 0) : 0;
      const lojaDisponivel = lojaSnap?.exists ? Number(lojaSnap.data()?.saldoDisponivel ?? 0) : 0;
      const lojaHistorico = lojaSnap?.exists ? Number(lojaSnap.data()?.totalHistorico ?? 0) : 0;
      const driverDisponivel = driverSnap?.exists ? Number(driverSnap.data()?.saldoDisponivel ?? 0) : 0;
      const driverHistorico = driverSnap?.exists ? Number(driverSnap.data()?.totalHistorico ?? 0) : 0;

      tx.update(pedidoRef, {
        status: "concluido",
        concluidoEm: admin.firestore.FieldValue.serverTimestamp(),
        confirmadoPorUid: contextUid, // Campo genérico para quem confirmou
        walletLiberado: true,
      });

      if (!alreadyLiberado && lojaId) {
        tx.set(lojaWalletRef, {
          saldoPendente: Math.max(0, lojaPendente - netValue),
          saldoDisponivel: lojaDisponivel + netValue,
          totalHistorico: lojaHistorico + netValue,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      // Só credita o entregador se for uma entrega e tiver taxa
      if (isDriver && driverFee > 0) {
        tx.set(driverWalletRef, {
          saldoDisponivel: driverDisponivel + driverFee,
          totalHistorico: driverHistorico + driverFee,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });

    return { success: true, message: "Entrega finalizada." };
  });

// Exporta funções do Marketplace
export { createSplitPreference, processSplitWebhook, requestPayout, getWalletBalance, connectSeller, generateWeeklyReport };

// Exporta funções de Pagamento Direto (Mercado Pago)
export { createMercadoPagoPreference, generatePixPayment, refundPayment, checkMercadoPagoStatus, processMercadoPagoWebhook };
