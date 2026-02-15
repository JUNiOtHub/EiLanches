/**
 * Central de configuração financeira – todas as constantes vêm do .env.
 * Taxas, teto de comissão, frete e saque: zero valores chumbados no código.
 */

import { ENV } from './env';

const F = ENV.finance;

/** Comissão do app sobre o pedido: se total >= minValueForTeto usa valor fixo (teto), senão percentual. */
export function calculateSplit(totalPedido: number): number {
  if (totalPedido >= F.minValueForTeto) {
    return F.appFeeTeto;
  }
  return (totalPedido * F.appFeePercent) / 100;
}

/** Frete dinâmico: BASE_FEE + (km excedentes ao BASE_KM) * KM_RATE. Retorna 0 se km <= 0 (ex.: retirada). */
export function calculateDeliveryFee(distanceKm: number): number {
  if (distanceKm <= 0) return 0;
  const kmExcedente = Math.max(0, distanceKm - F.deliveryBaseKm);
  return F.deliveryBaseFee + kmExcedente * F.deliveryKmRate;
}

export const financeConfig = {
  appFeeTeto: F.appFeeTeto,
  appFeePercent: F.appFeePercent,
  minValueForTeto: F.minValueForTeto,
  deliveryBaseFee: F.deliveryBaseFee,
  deliveryKmRate: F.deliveryKmRate,
  deliveryBaseKm: F.deliveryBaseKm,
  minWithdrawValue: F.minWithdrawValue,
  withdrawTax: F.withdrawTax,
} as const;
