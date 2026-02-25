/**
 * Configuração centralizada do Mercado Pago.
 * Todas as credenciais vêm EXCLUSIVAMENTE de variáveis de ambiente.
 * NUNCA hardcode tokens no código-fonte.
 */
import * as crypto from 'crypto';

// ── Configuração de ambiente ──────────────────────────────────────
export const MercadoPagoConfig = {
  ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN_PROD || '',
  PUBLIC_KEY: process.env.MP_PUBLIC_KEY || '',
  WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET || '',
  CLIENT_SECRET: process.env.MP_CLIENT_SECRET || '',

  PAYMENT_METHODS: {
    PIX: 'pix',
    CREDIT_CARD: 'credit_card',
    DEBIT_CARD: 'debit_card',
  } as const,

  SETTINGS: {
    FREE_SHIPPING_THRESHOLD: 50,
    SHIPPING_RATE: 0.1,
    QR_CODE_EXPIRATION_MINUTES: 30,
    CURRENCY: 'BRL',
    MAX_RETRY_ATTEMPTS: 3,
    PAYMENT_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutos
  } as const,
} as const;

// ── Validação de ambiente ─────────────────────────────────────────
export function validateMercadoPagoEnv(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!MercadoPagoConfig.ACCESS_TOKEN) {
    warnings.push('[MercadoPago] MP_ACCESS_TOKEN_PROD nao configurado. Pagamentos falharam.');
  }
  if (!MercadoPagoConfig.WEBHOOK_SECRET) {
    warnings.push('[MercadoPago] MP_WEBHOOK_SECRET nao configurado. Webhooks nao serao verificados.');
  }

  warnings.forEach((w) => console.warn(w));

  return { valid: warnings.length === 0, warnings };
}

// ── Verificação de assinatura HMAC do webhook ─────────────────────
export function verifyWebhookSignature(
  xSignature: string | undefined,
  xRequestId: string | undefined,
  dataId: string,
): boolean {
  if (!MercadoPagoConfig.WEBHOOK_SECRET) {
    console.warn('[MercadoPago] Webhook secret nao configurado, pulando verificacao.');
    return true; // Em dev, permite sem secret
  }

  if (!xSignature || !xRequestId) {
    return false;
  }

  // Formato do x-signature: "ts=TIMESTAMP,v1=HASH"
  const parts: Record<string, string> = {};
  xSignature.split(',').forEach((part) => {
    const [key, value] = part.split('=', 2);
    if (key && value) {
      parts[key.trim()] = value.trim();
    }
  });

  const ts = parts['ts'];
  const receivedHash = parts['v1'];
  if (!ts || !receivedHash) {
    return false;
  }

  // Monta o template conforme doc do MP
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expectedHash = crypto
    .createHmac('sha256', MercadoPagoConfig.WEBHOOK_SECRET)
    .update(manifest)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(receivedHash, 'hex'),
      Buffer.from(expectedHash, 'hex'),
    );
  } catch {
    return false;
  }
}

// ── Helper: headers para chamadas diretas a API do MP ─────────────
export function getMercadoPagoHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${MercadoPagoConfig.ACCESS_TOKEN}`,
    'X-Idempotency-Key': crypto.randomUUID(),
  };
}

export default MercadoPagoConfig;
