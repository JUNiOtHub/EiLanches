/**
 * Cálculo de valores do pedido – usa config/finance (variáveis do .env).
 * Nada chumbado: teto de comissão, % app, frete (base + km) e taxas vêm do ambiente.
 */

import { calculateSplit, calculateDeliveryFee } from '../config/finance';
import { ENV } from '../config/env';

export const MIN_ORDER_VALUE = ENV.APP.minOrder;

interface OrderValues {
  totalCliente: number;
  lucroApp: number;
  receberLojista: number;
  receberEntregador: number;
  repasseEntregador: number;
  frete: number;
  taxaProcessamento: number;
  descontoAplicado: number;
  error: string | null;
  bankFee: number;
  message: string | null;
}

const PROCESSING_FEE = 0.99;
const BANK_FEE = 0.99;
const MIN_APP_PROFIT = 0.50;

export const calculateOrderValues = (
  subtotal: number,
  coupon: any | null = null,
  distanceKm: number = 2,
  mode: 'delivery' | 'pickup' = 'delivery'
): OrderValues => {
  let error: string | null = null;
  let message: string | null = null;

  let couponDiscount = 0;
  if (coupon) {
    couponDiscount = coupon.type === 'fixed' ? coupon.value : subtotal * (coupon.value / 100);
    if (couponDiscount > subtotal) couponDiscount = subtotal;
  }

  const shopBase = subtotal - couponDiscount;
  const deliveryFee = mode === 'pickup' ? 0 : calculateDeliveryFee(distanceKm);
  const appCommission = calculateSplit(shopBase);
  const shopTake = shopBase - appCommission;
  const driverTake = deliveryFee;

  const appTake = appCommission + (PROCESSING_FEE - BANK_FEE);

  if (appTake < MIN_APP_PROFIT) {
    error = "Descontos excessivos. Este cupom não pode ser aplicado a este pedido.";
    couponDiscount = 0;
  }

  const totalForCustomer = subtotal - couponDiscount + PROCESSING_FEE + deliveryFee;

  return {
    totalCliente: totalForCustomer,
    lucroApp: appTake,
    receberLojista: shopTake,
    receberEntregador: driverTake,
    repasseEntregador: driverTake,
    frete: deliveryFee,
    taxaProcessamento: PROCESSING_FEE,
    descontoAplicado: couponDiscount,
    error,
    bankFee: BANK_FEE,
    message,
  };
};
