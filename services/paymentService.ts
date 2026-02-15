import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase';
import { ENV } from '../config/env';

interface PaymentRequest {
  orderId: string;
  totalAmount: number;
  netStoreAmount: number; // Para cálculo do split
  customer: {
    nome: string;
    email: string;
    documento?: string;
    telefone?: string;
  };
  method: 'pix' | 'credit_card';
}

export const paymentService = {
  /**
   * Processa o pagamento chamando a Cloud Function segura (Split Automático)
   */
  async process(data: PaymentRequest) {
    try {
      // Em ambiente de desenvolvimento sem Functions, usamos um mock ou Asaas direto
      if (import.meta.env.DEV && !(ENV as any).MERCADO_PAGO?.publicKey) {
        console.warn("Modo DEV: Simulando pagamento ou usando Asaas legado.");
        // Aqui você poderia manter a chamada ao asaasService antigo se quisesse fallback
        return this.mockPayment(data);
      }

      const functions = getFunctions(app, 'southamerica-east1');
      const createSplitPayment = httpsCallable(functions, 'createSplitPayment');

      const result: any = await createSplitPayment({
        orderId: data.orderId,
        amount: data.totalAmount,
        paymentMethod: data.method,
        payer: {
          email: data.customer.email,
          first_name: data.customer.nome.split(' ')[0],
          last_name: data.customer.nome.split(' ').slice(1).join(' '),
          identification: {
            type: 'CPF',
            number: data.customer.documento?.replace(/\D/g, '')
          }
        }
      });

      if (result.data.status === 'error') {
        return { success: false, error: result.data.message };
      }

      return {
        success: true,
        paymentId: result.data.id,
        pixQrCode: result.data.point_of_interaction?.transaction_data ? {
          encodedImage: result.data.point_of_interaction.transaction_data.qr_code_base64,
          payload: result.data.point_of_interaction.transaction_data.qr_code
        } : null
      };

    } catch (error: any) {
      console.error("Erro no pagamento:", error);
      return { success: false, error: error.message || "Falha ao processar pagamento." };
    }
  },

  async refund(paymentId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    // Implementar chamada para estorno via Cloud Function
    return { success: true };
  },

  // Mock para testes locais sem backend
  mockPayment(data: PaymentRequest) {
    return {
      success: true,
      paymentId: `mock_${Date.now()}`,
      pixQrCode: {
        encodedImage: "", // Em produção viria do MP
        payload: "00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000520400005303986540510.005802BR5913EiLanches App6008Brasilia62070503***6304ABCD"
      }
    };
  }
};