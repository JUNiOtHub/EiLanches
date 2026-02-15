// Configuração do Mercado Pago
export const MercadoPagoConfig = {
    // Ambiente: production ou sandbox
    ACCESS_TOKEN: process.env.MERCADO_PAGO_ACCESS_TOKEN || 'TEST-ACCESS-TOKEN',
    
    // Public Key para o frontend
    PUBLIC_KEY: process.env.MERCADO_PAGO_PUBLIC_KEY || 'TEST-PUBLIC-KEY',
    
    // URLs de webhook
    WEBHOOK_URL: process.env.MERCADO_PAGO_WEBHOOK_URL || 'https://seu-dominio.com/webhook/mercadopago',
    
    // Configurações de pagamento
    PAYMENT_METHODS: {
        PIX: 'pix',
        CREDIT_CARD: 'credit_card',
        DEBIT_CARD: 'debit_card'
    },
    
    // Taxas e configurações
    SETTINGS: {
        // Frete grátis acima de R$50
        FREE_SHIPPING_THRESHOLD: 50,
        
        // Taxa de entrega (10% para pedidos abaixo de R$50)
        SHIPPING_RATE: 0.1,
        
        // Tempo de expiração do QR Code (30 minutos)
        QR_CODE_EXPIRATION_MINUTES: 30,
        
        // Moeda
        CURRENCY: 'BRL'
    }
};

// Validação de ambiente
if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
    console.warn('[MercadoPago] ACCESS_TOKEN não configurado. Usando ambiente de teste.');
}

if (!process.env.MERCADO_PAGO_PUBLIC_KEY) {
    console.warn('[MercadoPago] PUBLIC_KEY não configurada. Usando ambiente de teste.');
}

export default MercadoPagoConfig;
