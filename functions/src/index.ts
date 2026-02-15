import { createSplitPreference, processSplitWebhook, requestPayout, getWalletBalance, connectSeller } from './mercadoPagoMarketplace';
import { generateWeeklyReport } from './reportService';
/**
 * EiLanches - Cloud Functions
 *
 * - onOrderConcludedCreditLoyalty: credita pontos ao concluir pedido
 * - onOrderCreatedCreditWallet: credita saldo pendente da carteira do lojista ao criar/confirmar pedido
 * - validateDeliveryPIN: callable que valida PIN e libera saldo (pendente -> disponível)
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

// Types para Firebase Functions v1
interface Change {
  before: admin.firestore.DocumentSnapshot;
  after: admin.firestore.DocumentSnapshot;
}

interface Context {
  params: { [key: string]: string };
}

function creditLojistaPendente(tx: admin.firestore.Transaction, lojaId: string, netValue: number, orderRef: admin.firestore.DocumentReference) {
  const walletRef = db.doc(`wallets/${lojaId}`);
  return tx.get(walletRef).then((snap) => {
    const pendente = snap.exists ? Number(snap.data()?.saldoPendente ?? 0) : 0;
    const disponivel = snap.exists ? Number(snap.data()?.saldoDisponivel ?? 0) : 0;
    const historico = snap.exists ? Number(snap.data()?.totalHistorico ?? 0) : 0;
    tx.set(walletRef, {
      saldoPendente: pendente + netValue,
      saldoDisponivel: disponivel,
      totalHistorico: historico + netValue,
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
export const onOrderConcludedCreditLoyalty = functions
  .region("southamerica-east1")
  .firestore.document("pedidos/{pedidoId}")
  .onUpdate(async (change: Change, context: Context) => {
    const after = change.after.data();
    const before = change.before.data();

    const newStatus = after?.status;
    const oldStatus = before?.status;

    // Só age quando o status passa a ser "concluido"
    if (newStatus !== "concluido" || oldStatus === "concluido") {
      return null;
    }

    const pedidoId = context.params.pedidoId;
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
    const pedidoRef = change.after.ref;

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
      functions.logger.error("onOrderConcludedCreditLoyalty", { pedidoId, clienteUid, pointsEarned, error: e });
      throw e;
    }

    return null;
  });

/**
 * Ao criar um pedido: credita o saldo pendente da carteira do lojista (dinheiro/cartão).
 * Ao atualizar um pedido: se asaasPaymentId for definido (PIX gerado), credita o pendente do lojista.
 */
export const onOrderCreatedCreditWallet = functions
  .region("southamerica-east1")
  .firestore.document("pedidos/{pedidoId}")
  .onCreate(async (snap: admin.firestore.DocumentSnapshot, context: Context) => {
    const data = snap.data();
    if (data.walletCreditedPendente || data.status === "falha_pagamento") return null;
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
export const onOrderUpdatedCreditWalletPix = functions
  .region("southamerica-east1")
  .firestore.document("pedidos/{pedidoId}")
  .onUpdate(async (change: Change, context: Context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (after.walletCreditedPendente || after.status === "falha_pagamento") return null;
    if (!after.asaasPaymentId || before.asaasPaymentId) return null; // só quando asaasPaymentId acaba de ser setado
    const lojaId = after.lojaId;
    const netValue = Number(after.netValue ?? 0);
    if (!lojaId || netValue <= 0) return null;
    const orderRef = change.after.ref;
    await db.runTransaction((tx) => creditLojistaPendente(tx, lojaId, netValue, orderRef));
    return null;
  });

/**
 * Valida o PIN de entrega e marca o pedido como concluído.
 * Callable (httpsCallable no front) — o Firebase trata CORS automaticamente para callables.
 */
export const validateDeliveryPIN = functions
  .region("southamerica-east1")
  .https.onCall(async (data: any, context: any) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    const { orderId, pin } = data || {};
    if (!orderId || pin === undefined || pin === null) {
      throw new functions.https.HttpsError("invalid-argument", "orderId e pin são obrigatórios.");
    }

    const pedidoRef = db.doc(`pedidos/${orderId}`);
    const snap = await pedidoRef.get();
    if (!snap.exists) {
      return { success: false, message: "Pedido não encontrado." };
    }

    const pedido = snap.data()!;
    const codigoCorreto = String(pedido.deliveryCode || "").trim();
    const codigoInformado = String(pin).trim();

    if (codigoCorreto !== codigoInformado) {
      return { success: false, message: "Código inválido." };
    }

    const entregadorUid = context.auth.uid;
    const lojaId = pedido.lojaId;
    const netValue = Number(pedido.netValue ?? pedido.finalTotal ?? 0);
    const driverFee = Number(pedido.driverFee ?? pedido.deliveryFee ?? 0);
    const alreadyLiberado = pedido.walletLiberado === true;
    const lojaWalletRef = db.doc(`wallets/${lojaId}`);
    const driverWalletRef = db.doc(`wallets/${entregadorUid}`);

    await db.runTransaction(async (tx) => {
      // Leituras primeiro (exigência do Firestore)
      const [lojaSnap, driverSnap] = await Promise.all([
        lojaId ? tx.get(lojaWalletRef) : Promise.resolve(null),
        entregadorUid && driverFee > 0 ? tx.get(driverWalletRef) : Promise.resolve(null),
      ]);

      const lojaPendente = lojaSnap?.exists ? Number(lojaSnap.data()?.saldoPendente ?? 0) : 0;
      const lojaDisponivel = lojaSnap?.exists ? Number(lojaSnap.data()?.saldoDisponivel ?? 0) : 0;
      const lojaHistorico = lojaSnap?.exists ? Number(lojaSnap.data()?.totalHistorico ?? 0) : 0;
      const driverDisponivel = driverSnap?.exists ? Number(driverSnap.data()?.saldoDisponivel ?? 0) : 0;
      const driverHistorico = driverSnap?.exists ? Number(driverSnap.data()?.totalHistorico ?? 0) : 0;

      tx.update(pedidoRef, {
        status: "concluido",
        concluidoEm: admin.firestore.FieldValue.serverTimestamp(),
        confirmadoPeloEntregadorUid: entregadorUid,
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

      if (entregadorUid && driverFee > 0) {
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
