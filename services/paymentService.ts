/**
 * Payment Service — camada de abstração para pagamentos.
 *
 * Melhorias aplicadas:
 * - Chama Cloud Functions corretas (generatePixPayment, refundPayment)
 * - Retry automático para erros transientes
 * - Polling de status do pagamento com timeout
 * - Refund implementado de verdade
 * - Mock mais seguro (só ativa em DEV explicitamente)
 * - Tipagem forte sem uso de `any`
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase';

// ── Interfaces ────────────────────────────────────────────────────

interface PaymentRequest {
  orderId: string;
  totalAmount: number;
  netStoreAmount: number;
  customer: {
    nome: string;
    email: string;
    documento?: string;
    telefone?: string;
  };
  method: 'pix' | 'credit_card';
}

interface PaymentResult {
  success: boolean;
  paymentId?: string;
  pixQrCode?: {
    encodedImage: string;
    payload: string;
  } | null;
  error?: string;
}

interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

interface PaymentStatusResult {
  status: string;
  status_detail?: string;
  payment_method_id?: string;
}

interface PixPaymentResponse {
  paymentId: string;
  status: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
  expiration_date: string | null;
  alreadyExists?: boolean;
}

interface RefundResponse {
  success: boolean;
  refundId: string;
  status: string;
  amount: number;
}

// ── Helpers ───────────────────────────────────────────────────────

const FUNCTIONS_REGION = 'southamerica-east1';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;
const STATUS_POLL_INTERVAL_MS = 5000;
const STATUS_POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

function getFunctionsInstance() {
  return getFunctions(app, FUNCTIONS_REGION);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isTransient = lastError.message?.includes('UNAVAILABLE') ||
        lastError.message?.includes('DEADLINE_EXCEEDED') ||
        lastError.message?.includes('Failed to fetch');
      if (!isTransient || attempt === retries) {
        throw lastError;
      }
      console.warn(`[PaymentService] Tentativa ${attempt + 1} falhou, retentando em ${RETRY_DELAY_MS}ms...`);
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw lastError;
}

// ── Payment Service ───────────────────────────────────────────────

export const paymentService = {
  /**
   * Processa pagamento PIX ou cartão via Cloud Function segura.
   */
  async process(data: PaymentRequest): Promise<PaymentResult> {
    try {
      // Mock apenas em DEV com flag explícito
      if (import.meta.env.DEV && import.meta.env.VITE_MOCK_PAYMENTS === 'true') {
        console.warn('[PaymentService] Modo DEV: Simulando pagamento.');
        return this.mockPayment(data);
      }

      const functions = getFunctionsInstance();

      if (data.method === 'pix') {
        const generatePixPayment = httpsCallable<Record<string, unknown>, PixPaymentResponse>(functions, 'generatePixPayment');

        const result = await withRetry(() => generatePixPayment({
          orderId: data.orderId,
          amount: data.totalAmount,
          payerEmail: data.customer.email,
          payerCpf: data.customer.documento?.replace(/\D/g, '') || undefined,
          description: `EiLanches - Pedido #${data.orderId.slice(-6)}`,
        }));

        const paymentData = result.data;

        return {
          success: true,
          paymentId: paymentData.paymentId,
          pixQrCode: paymentData.qr_code_base64 ? {
            encodedImage: paymentData.qr_code_base64,
            payload: paymentData.qr_code || '',
          } : null,
        };
      }

      // Cartão de crédito via preferência do checkout
      const createPreference = httpsCallable<Record<string, unknown>, { preferenceId: string; initPoint: string }>(functions, 'createMercadoPagoPreference');

      const result = await withRetry(() => createPreference({
        orderId: data.orderId,
        items: [{ id: data.orderId, name: 'Pedido EiLanches', quantity: 1, price: data.totalAmount }],
        total: data.totalAmount,
        customer: {
          name: data.customer.nome,
          email: data.customer.email,
          cpf: data.customer.documento,
          phone: data.customer.telefone,
        },
        returnUrl: window.location.origin + '/orders',
      }));

      return {
        success: true,
        paymentId: result.data.preferenceId,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao processar pagamento.';
      console.error('[PaymentService] Erro:', message);
      return { success: false, error: message };
    }
  },

  /**
   * Solicita estorno via Cloud Function (implementação real).
   */
  async refund(paymentId: string, reason: string, amount?: number): Promise<RefundResult> {
    try {
      const functions = getFunctionsInstance();
      const refundFn = httpsCallable<Record<string, unknown>, RefundResponse>(functions, 'refundPayment');

      const result = await withRetry(() => refundFn({ paymentId, reason, amount }));

      return {
        success: result.data.success,
        refundId: result.data.refundId,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao solicitar estorno.';
      console.error('[PaymentService] Erro no estorno:', message);
      return { success: false, error: message };
    }
  },

  /**
   * Consulta status do pagamento na Cloud Function.
   */
  async checkStatus(paymentId: string): Promise<PaymentStatusResult | null> {
    try {
      const functions = getFunctionsInstance();
      const checkFn = httpsCallable<Record<string, unknown>, PaymentStatusResult>(functions, 'checkMercadoPagoStatus');

      const result = await checkFn({ paymentId });
      return result.data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao consultar status.';
      console.error('[PaymentService] Erro ao consultar status:', message);
      return null;
    }
  },

  /**
   * Polling de status até aprovação, rejeição ou timeout.
   */
  async pollStatus(
    paymentId: string,
    onStatusChange?: (status: string) => void,
    timeoutMs = STATUS_POLL_TIMEOUT_MS,
  ): Promise<string> {
    const startTime = Date.now();
    let lastStatus = '';

    while (Date.now() - startTime < timeoutMs) {
      const result = await this.checkStatus(paymentId);
      if (result) {
        if (result.status !== lastStatus) {
          lastStatus = result.status;
          onStatusChange?.(result.status);
        }

        if (['approved', 'rejected', 'cancelled', 'refunded'].includes(result.status)) {
          return result.status;
        }
      }
      await sleep(STATUS_POLL_INTERVAL_MS);
    }

    return 'timeout';
  },

  /**
   * Mock para testes locais — ativado apenas com VITE_MOCK_PAYMENTS=true.
   */
  mockPayment(_data: PaymentRequest): PaymentResult {
    return {
      success: true,
      paymentId: `mock_${Date.now()}`,
      pixQrCode: {
        encodedImage: '',
        payload: '00020126580014br.gov.bcb.pix0136mock-key520400005303986540510.005802BR5913EiLanches6008Brasilia62070503***6304ABCD',
      },
    };
  },
};
