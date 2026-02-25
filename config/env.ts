// Todas as variáveis de ambiente devem usar prefixo VITE_ e ser acessadas via import.meta.env (segurança do build Vite).
export const ENV = {
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  },
  asaas: {
    apiKey: import.meta.env.VITE_ASAAS_API_KEY || import.meta.env.VITE_ASAAS_KEY,
    baseUrl: import.meta.env.VITE_ASAAS_BASE_URL || 'https://sandbox.asaas.com/api/v3',
  },
  IMGBB: {
    key: import.meta.env.VITE_IMGBB_KEY
  },
  UNSPLASH: {
    accessKey: import.meta.env.VITE_UNSPLASH_ACCESS_KEY
  },
  APP: {
    minOrder: Number(import.meta.env.VITE_MIN_ORDER_VALUE) || 15.00,
    platformFee: Number(import.meta.env.VITE_PLATFORM_FEE_PERCENT) || 10,
    adminPhone: import.meta.env.VITE_ADMIN_PHONE
  },
  // Tesouraria (taxas e regras via .env)
  finance: {
    appFeeTeto: Number(import.meta.env.VITE_APP_FEE_TETO) || 60,
    appFeePercent: Number(import.meta.env.VITE_APP_FEE_PERCENT) || 12,
    minValueForTeto: Number(import.meta.env.VITE_APP_MIN_VALUE_FOR_TETO) || 400,
    deliveryBaseFee: Number(import.meta.env.VITE_DELIVERY_BASE_FEE) || 7,
    deliveryKmRate: Number(import.meta.env.VITE_DELIVERY_KM_RATE) || 2,
    deliveryBaseKm: Number(import.meta.env.VITE_DELIVERY_BASE_KM) || 3,
    minWithdrawValue: Number(import.meta.env.VITE_MIN_WITHDRAW_VALUE) || 50,
    withdrawTax: Number(import.meta.env.VITE_WITHDRAW_TAX) || 1.99,
  },
  // Mercado Pago (chave pública para o front — segura para expor)
  mercadoPago: {
    publicKey: import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY || '',
  },
};

Object.freeze(ENV);

// Validação discreta: em desenvolvimento, apenas aviso para não poluir o console
function validateEnv(): void {
  if (!ENV.firebase.apiKey) {
    console.warn('[EiLanches] VITE_FIREBASE_API_KEY nao encontrada. O app pode falhar ao conectar ao Firebase.');
  }
  if (!ENV.mercadoPago.publicKey) {
    console.warn('[EiLanches] VITE_MERCADO_PAGO_PUBLIC_KEY nao encontrada. Checkout do Mercado Pago pode falhar.');
  }
}
validateEnv();
