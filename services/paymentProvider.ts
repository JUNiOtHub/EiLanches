import { ENV } from '../config/env';
import { asaasService } from './asaas';

export interface VendedorData {
  uid: string;
  email: string;
  nomeLoja: string;
  documento: string;
  telefone: string;
  endereco: string;
  cep: string;
  chavePix: string;
  tipoChavePix: string;
  deliveryMode: 'own' | 'app';
  deliveryTime: string;
}

export interface EntregadorData {
  uid: string;
  email: string;
  nomeCompleto: string;
  cpf: string;
  telefone: string;
  chavePix: string;
  tipoChavePix: string;
  vehicleType: 'moto' | 'bike' | 'carro';
  placaVeiculo: string;
  cnhImage: string;
}

export interface ClienteData {
  uid: string;
  email: string;
  nome: string;
  documento?: string;
  telefone?: string;
}

export const paymentProviderService = {
  /**
   * Cria uma subconta para vendedor no Asaas
   */
  async createVendedorAccount(dados: VendedorData) {
    try {
      // 1. Criar subconta no Asaas
      const subaccountResponse = await asaasService.createSubaccount({
        nomeLoja: dados.nomeLoja,
        email: dados.email,
        documento: dados.documento,
        telefone: dados.telefone,
        endereco: dados.endereco,
        cep: dados.cep
      });

      if (subaccountResponse.error) {
        throw new Error(`Erro ao criar subconta: ${subaccountResponse.error}`);
      }

      const providerAccountId = subaccountResponse.id;
      const walletId = subaccountResponse.walletId;

      // 2. Salvar dados no Firestore
      const firestoreData = {
        ...dados,
        providerAccountId,
        walletId,
        onboardedAt: new Date().toISOString(),
        termsAccepted: true,
        termsVersion: import.meta.env.VITE_TERMS_VERSION || '1.0',
        acceptedAt: new Date().toISOString(),
        isActive: true
      };

      // Aqui você faria a chamada para salvar no Firestore
      // await saveUserData(dados.uid, firestoreData);

      return {
        success: true,
        providerAccountId,
        walletId,
        message: 'Conta criada com sucesso'
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  },

  /**
   * Cria conta para entregador no Asaas
   */
  async createEntregadorAccount(dados: EntregadorData) {
    try {
      // 1. Criar cliente no Asaas (entregadores são clientes, não subcontas)
      const customerId = await asaasService.createCustomer({
        nome: dados.nomeCompleto,
        email: dados.email,
        documento: dados.cpf,
        telefone: dados.telefone
      });

      // 2. Salvar dados no Firestore
      const firestoreData = {
        ...dados,
        providerAccountId: customerId,
        onboardedAt: new Date().toISOString(),
        termsAccepted: true,
        termsVersion: import.meta.env.VITE_TERMS_VERSION || '1.0',
        acceptedAt: new Date().toISOString(),
        isActive: true,
        isOnline: false,
        rating: 5.0,
        ratingCount: 0,
        totalDeliveries: 0,
        totalKm: 0
      };

      // Aqui você faria a chamada para salvar no Firestore
      // await saveUserData(dados.uid, firestoreData);

      return {
        success: true,
        providerAccountId: customerId,
        message: 'Conta criada com sucesso'
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  },

  /**
   * Cria ou atualiza conta para cliente no Asaas
   */
  async createClienteAccount(dados: ClienteData) {
    try {
      // 1. Criar cliente no Asaas
      const customerId = await asaasService.createCustomer({
        nome: dados.nome,
        email: dados.email,
        documento: dados.documento,
        telefone: dados.telefone
      });

      // 2. Salvar dados no Firestore
      const firestoreData = {
        ...dados,
        providerAccountId: customerId,
        onboardedAt: new Date().toISOString(),
        termsAccepted: true,
        termsVersion: import.meta.env.VITE_TERMS_VERSION || '1.0',
        acceptedAt: new Date().toISOString(),
        loyaltyPoints: 0
      };

      // Aqui você faria a chamada para salvar no Firestore
      // await saveUserData(dados.uid, firestoreData);

      return {
        success: true,
        providerAccountId: customerId,
        message: 'Conta criada com sucesso'
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  },

  /**
   * Valida chave PIX antes de salvar
   */
  validatePixKey(tipo: string, chave: string): { valid: boolean; message?: string } {
    switch (tipo) {
      case 'cpf':
        const cpfValid = /^\d{11}$/.test(chave.replace(/\D/g, ''));
        return {
          valid: cpfValid,
          message: cpfValid ? undefined : 'CPF inválido'
        };

      case 'email':
        const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chave);
        return {
          valid: emailValid,
          message: emailValid ? undefined : 'E-mail inválido'
        };

      case 'telefone':
        const telValid = /^\d{10,11}$/.test(chave.replace(/\D/g, ''));
        return {
          valid: telValid,
          message: telValid ? undefined : 'Telefone inválido'
        };

      case 'aleatoria':
        const uuidValid = /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/.test(chave);
        return {
          valid: uuidValid,
          message: uuidValid ? undefined : 'Chave aleatória inválida'
        };

      default:
        return {
          valid: false,
          message: 'Tipo de chave PIX inválido'
        };
    }
  },

  /**
   * Verifica se usuário já completou onboarding
   */
  async checkOnboardingStatus(uid: string): Promise<{
    onboarded: boolean;
    userType?: 'cliente' | 'vendedor' | 'entregador';
    providerAccountId?: string;
  }> {
    try {
      // Aqui você faria a consulta no Firestore
      // const userDoc = await getUserData(uid);
      
      // Simulação para desenvolvimento
      
      return {
        onboarded: false,
        userType: undefined,
        providerAccountId: undefined
      };

    } catch (error) {
      return {
        onboarded: false
      };
    }
  },

  /**
   * Atualiza dados da conta no provedor de pagamento
   */
  async updateAccount(uid: string, dados: Partial<VendedorData | EntregadorData | ClienteData>) {
    try {
      // Aqui você implementaria a lógica de atualização no Asaas
      // e no Firestore

      return {
        success: true,
        message: 'Dados atualizados com sucesso'
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }
};
