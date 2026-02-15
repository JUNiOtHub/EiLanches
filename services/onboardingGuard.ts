import { paymentProviderService } from './paymentProvider';

export interface OnboardingCheckResult {
  canProceed: boolean;
  requiresOnboarding: boolean;
  userType?: 'cliente' | 'vendedor' | 'entregador';
  redirectUrl?: string;
  message?: string;
}

export class OnboardingGuard {
  /**
   * Verifica se o usuário pode acessar determinada funcionalidade
   * baseado no seu status de onboarding
   */
  static async checkAccess(
    uid: string, 
    requiredFeature: 'dashboard' | 'orders' | 'payments' | 'delivery'
  ): Promise<OnboardingCheckResult> {
    try {
      const status = await paymentProviderService.checkOnboardingStatus(uid);
      
      // Se usuário não fez onboarding
      if (!status.onboarded) {
        return {
          canProceed: false,
          requiresOnboarding: true,
          message: 'Você precisa completar seu cadastro antes de acessar esta funcionalidade',
          redirectUrl: '/onboarding'
        };
      }

      // Verificações específicas por tipo de usuário
      switch (status.userType) {
        case 'vendedor':
          return this.checkVendedorAccess(requiredFeature, status);
          
        case 'entregador':
          return this.checkEntregadorAccess(requiredFeature, status);
          
        case 'cliente':
          return this.checkClienteAccess(requiredFeature, status);
          
        default:
          return {
            canProceed: false,
            requiresOnboarding: true,
            message: 'Tipo de usuário não identificado',
            redirectUrl: '/onboarding'
          };
      }
      
    } catch (error) {
      return {
        canProceed: false,
        requiresOnboarding: true,
        message: 'Erro ao verificar permissões. Faça login novamente.'
      };
    }
  }

  /**
   * Verifica acesso para vendedores
   */
  private static checkVendedorAccess(
    requiredFeature: string, 
    status: any
  ): OnboardingCheckResult {
    switch (requiredFeature) {
      case 'dashboard':
        return {
          canProceed: true,
          requiresOnboarding: false,
          userType: 'vendedor'
        };
        
      case 'orders':
        return {
          canProceed: true,
          requiresOnboarding: false,
          userType: 'vendedor'
        };
        
      case 'payments':
        if (!status.providerAccountId) {
          return {
            canProceed: false,
            requiresOnboarding: true,
            message: 'Você precisa configurar seus dados bancários para receber pagamentos',
            redirectUrl: '/onboarding/vendedor/payment'
          };
        }
        return {
          canProceed: true,
          requiresOnboarding: false,
          userType: 'vendedor'
        };
        
      case 'delivery':
        return {
          canProceed: false,
          requiresOnboarding: false,
          message: 'Acesso não disponível para vendedores',
          redirectUrl: '/vendedor/dashboard'
        };
        
      default:
        return {
          canProceed: true,
          requiresOnboarding: false,
          userType: 'vendedor'
        };
    }
  }

  /**
   * Verifica acesso para entregadores
   */
  private static checkEntregadorAccess(
    requiredFeature: string, 
    status: any
  ): OnboardingCheckResult {
    switch (requiredFeature) {
      case 'dashboard':
        return {
          canProceed: true,
          requiresOnboarding: false,
          userType: 'entregador'
        };
        
      case 'delivery':
        if (!status.providerAccountId) {
          return {
            canProceed: false,
            requiresOnboarding: true,
            message: 'Você precisa configurar seus dados bancários para receber pagamentos',
            redirectUrl: '/onboarding/entregador/payment'
          };
        }
        return {
          canProceed: true,
          requiresOnboarding: false,
          userType: 'entregador'
        };
        
      case 'orders':
        return {
          canProceed: true,
          requiresOnboarding: false,
          userType: 'entregador'
        };
        
      case 'payments':
        if (!status.providerAccountId) {
          return {
            canProceed: false,
            requiresOnboarding: true,
            message: 'Configure seus dados bancários para acessar área financeira',
            redirectUrl: '/onboarding/entregador/payment'
          };
        }
        return {
          canProceed: true,
          requiresOnboarding: false,
          userType: 'entregador'
        };
        
      default:
        return {
          canProceed: true,
          requiresOnboarding: false,
          userType: 'entregador'
        };
    }
  }

  /**
   * Verifica acesso para clientes
   */
  private static checkClienteAccess(
    requiredFeature: string, 
    status: any
  ): OnboardingCheckResult {
    switch (requiredFeature) {
      case 'dashboard':
        return {
          canProceed: true,
          requiresOnboarding: false,
          userType: 'cliente'
        };
        
      case 'orders':
        return {
          canProceed: true,
          requiresOnboarding: false,
          userType: 'cliente'
        };
        
      case 'payments':
        return {
          canProceed: false,
          requiresOnboarding: false,
          message: 'Área financeira disponível apenas para vendedores e entregadores',
          redirectUrl: '/cliente/dashboard'
        };
        
      case 'delivery':
        return {
          canProceed: false,
          requiresOnboarding: false,
          message: 'Área de entregas disponível apenas para entregadores',
          redirectUrl: '/cliente/dashboard'
        };
        
      default:
        return {
          canProceed: true,
          requiresOnboarding: false,
          userType: 'cliente'
        };
    }
  }
}
