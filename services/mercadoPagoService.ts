import { loadMercadoPago } from '@mercadopago/sdk-js';
import { Payment, Preference } from '@mercadopago/sdk-react';
import { httpsCallable } from 'firebase/functions';
import { app } from '../firebase';

// Configuração do Mercado Pago
const MERCADO_PAGO_PUBLIC_KEY = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY;

// Inicializa o Mercado Pago
export const initializeMercadoPago = async () => {
  try {
    await loadMercadoPago();
    const mp = new (window as any).MercadoPago(MERCADO_PAGO_PUBLIC_KEY);
    return mp;
  } catch (error) {
    console.error('[MercadoPago] Erro ao inicializar:', error);
    throw error;
  }
};

// Cria preferência de pagamento para Pix ou Cartão
export const createPaymentPreference = async (orderData: {
    id: string;
    items: any[];
    total: number;
    customerInfo: {
        name: string;
        email: string;
        phone: string;
        cpf?: string;
    };
    deliveryAddress?: {
        street: string;
        number: string;
        neighborhood: string;
        city: string;
        state: string;
        zipCode: string;
    };
}) => {
    try {
        console.log('[MercadoPago] Criando preferência para pedido:', orderData.id);

        // Chama Firebase Function para criar preferência
        const createPreference = httpsCallable(app, 'createMercadoPagoPreference');
        
        const result = await createPreference({
            orderId: orderData.id,
            items: orderData.items,
            total: orderData.total,
            customer: orderData.customerInfo,
            deliveryAddress: orderData.deliveryAddress,
            returnUrl: `${window.location.origin}/order/${orderData.id}`,
            notificationUrl: `${window.location.origin}/webhook/mercadopago`
        });

        console.log('[MercadoPago] Preferência criada:', result.data);
        return result.data as { preferenceId: string; initPoint: string };
    } catch (error) {
        console.error('[MercadoPago] Erro ao criar preferência:', error);
        throw error;
    }
};

// Gera QR Code para Pix (Point of Interaction)
export const generatePixQRCode = async (preferenceId: string) => {
    try {
        console.log('[MercadoPago] Gerando QR Code Pix para preferência:', preferenceId);

        const generateQR = httpsCallable(app, 'generatePixQRCode');
        const result = await generateQR({ preferenceId });

        console.log('[MercadoPago] QR Code gerado:', result.data);
        return result.data as {
            qr_code: string;          // QR Code em Base64
            qr_code_base64: string;   // QR Code para copiar e colar
            transaction_id: string;     // ID da transação
        };
    } catch (error) {
        console.error('[MercadoPago] Erro ao gerar QR Code:', error);
        throw error;
    }
};

// Verifica status do pagamento
export const checkPaymentStatus = async (paymentId: string) => {
    try {
        console.log('[MercadoPago] Verificando status do pagamento:', paymentId);

        const checkStatus = httpsCallable(app, 'checkMercadoPagoStatus');
        const result = await checkStatus({ paymentId });

        console.log('[MercadoPago] Status verificado:', result.data);
        return result.data as {
            status: 'pending' | 'approved' | 'rejected' | 'cancelled';
            status_detail: string;
            payment_method_id: string;
        };
    } catch (error) {
        console.error('[MercadoPago] Erro ao verificar status:', error);
        throw error;
    }
};

// Processa webhook do Mercado Pago
export const processWebhook = async (webhookData: any) => {
    try {
        console.log('[MercadoPago] Processando webhook:', webhookData);

        const processWebhook = httpsCallable(app, 'processMercadoPagoWebhook');
        const result = await processWebhook(webhookData);

        console.log('[MercadoPago] Webhook processado:', result.data);
        return result.data;
    } catch (error) {
        console.error('[MercadoPago] Erro ao processar webhook:', error);
        throw error;
    }
};

// Tipos para TypeScript
export interface MercadoPagoPreference {
    id: string;
    init_point: string;
    items: Array<{
        id: string;
        title: string;
        quantity: number;
        unit_price: number;
    }>;
    payer: {
        name: string;
        email: string;
        phone: {
            area_code: string;
            number: string;
        };
        identification?: {
            type: string;
            number: string;
        };
    };
    payment_methods: {
        excluded_payment_types: Array<string>;
        excluded_payment_methods: Array<string>;
    };
    back_urls: {
        success: string;
        failure: string;
        pending: string;
    };
    auto_return: string;
}

export interface PixQRCode {
    qr_code: string;
    qr_code_base64: string;
    transaction_id: string;
    amount: number;
    expiration_date: string;
}

export default {
    initializeMercadoPago,
    createPaymentPreference,
    generatePixQRCode,
    checkPaymentStatus,
    processWebhook
};
