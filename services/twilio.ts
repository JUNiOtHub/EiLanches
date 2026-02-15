import { getFunctions, httpsCallable } from 'firebase/functions';

export const twilioService = {
  /**
   * Envia um código de verificação (OTP) para o celular via WhatsApp
   * @param phone Número de telefone (com ou sem máscara)
   */
  async sendVerificationCode(phone: string) {
    try {
      // Tenta usar a região correta para evitar CORS
      const functions = getFunctions(undefined, 'southamerica-east1');
      const sendCodeFn = httpsCallable(functions, 'sendVerificationCode', {
        // Timeout aumentado para evitar erros de rede
        timeout: 30000
      });
      
      // Remove caracteres não numéricos antes de enviar
      const cleanPhone = phone.replace(/\D/g, '');
      
      // Adiciona headers CORS manualmente se necessário
      const result: any = await sendCodeFn({ 
        phone: cleanPhone,
        origin: window.location.origin // Ajuda no CORS
      });
      
      return result.data;
    } catch (error: any) {
      // Tratamento específico para CORS
      if (error.code === 'unavailable' || error.code === 'internal') {
        console.warn('Cloud Function indisponível, usando modo demo');
        throw new Error('SERVICO_INDISPONIVEL');
      }
      
      // Erro de CORS específico
      if (error.message?.includes('CORS') || error.message?.includes('blocked')) {
        console.warn('Erro CORS detectado');
        throw new Error('CORS_ERROR');
      }
      
      throw error;
    }
  },

  /**
   * Valida o código que o usuário digitou
   */
  async verifyCode(phone: string, code: string) {
    try {
      // Usa a mesma região para consistência
      const functions = getFunctions(undefined, 'southamerica-east1');
      const verifyFn = httpsCallable(functions, 'verifyCode', {
        timeout: 30000
      });
      
      const cleanPhone = phone.replace(/\D/g, '');
      const result: any = await verifyFn({ 
        phone: cleanPhone, 
        code,
        origin: window.location.origin
      });
      
      return result.data;
    } catch (error: any) {
      // Tratamento específico para CORS
      if (error.code === 'unavailable' || error.code === 'internal') {
        throw new Error('SERVICO_INDISPONIVEL');
      }
      
      if (error.message?.includes('CORS') || error.message?.includes('blocked')) {
        throw new Error('CORS_ERROR');
      }
      
      throw error;
    }
  }
};