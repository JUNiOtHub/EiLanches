import { httpsCallable } from 'firebase/functions';
import { app } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// Tipos de assinatura
export type SubscriptionPlan = 'prime' | 'premium' | null;

export interface SubscriptionData {
    plan: SubscriptionPlan;
    status: 'active' | 'cancelled' | 'expired' | 'trial';
    startDate: any;
    endDate: any;
    nextBillingDate: any;
    amount: number;
    benefits: string[];
    autoRenew: boolean;
}

export interface SubscriptionPlans {
    prime: {
        name: string;
        price: number;
        billingCycle: 'monthly';
        benefits: string[];
        features: {
            freeDelivery: boolean;
            prioritySupport: boolean;
            exclusiveDiscounts: boolean;
            earlyAccess: boolean;
        };
    };
    premium: {
        name: string;
        price: number;
        billingCycle: 'monthly';
        benefits: string[];
        features: {
            freeDelivery: boolean;
            prioritySupport: boolean;
            exclusiveDiscounts: boolean;
            earlyAccess: boolean;
            cashbackMultiplier: number;
            vipEvents: boolean;
        };
    };
}

// Planos disponíveis
export const SUBSCRIPTION_PLANS: SubscriptionPlans = {
    prime: {
        name: 'EiLanches Prime',
        price: 14.90,
        billingCycle: 'monthly',
        benefits: [
            '🚚 Frete grátis em todas as lojas',
            '⚡ Suporte prioritário',
            '🎯 Descontos exclusivos',
            '📱 Acesso antecipado a novidades'
        ],
        features: {
            freeDelivery: true,
            prioritySupport: true,
            exclusiveDiscounts: true,
            earlyAccess: true
        }
    },
    premium: {
        name: 'EiLanches Premium',
        price: 29.90,
        billingCycle: 'monthly',
        benefits: [
            '🚚 Frete grátis em todas as lojas',
            '⚡ Suporte VIP 24/7',
            '🎯 Super descontos (até 30%)',
            '📱 Acesso antecipado a novidades',
            '💰 2x Cashback em todas as compras',
            '🎟️ Eventos exclusivos'
        ],
        features: {
            freeDelivery: true,
            prioritySupport: true,
            exclusiveDiscounts: true,
            earlyAccess: true,
            cashbackMultiplier: 2,
            vipEvents: true
        }
    }
};

// Serviço de assinaturas
export const subscriptionService = {
    // Verifica assinatura atual do usuário
    async getCurrentSubscription(userId: string): Promise<SubscriptionData | null> {
        try {
            const getSubscription = httpsCallable(app, 'getUserSubscription');
            const result = await getSubscription({ userId });
            return result.data as SubscriptionData;
        } catch (error) {
            console.error('[Subscription] Erro ao buscar assinatura:', error);
            return null;
        }
    },

    // Cria nova assinatura
    async createSubscription(userId: string, plan: SubscriptionPlan, paymentMethod: 'mercadopago' | 'credit_card'): Promise<string> {
        try {
            const createSubscription = httpsCallable(app, 'createSubscription');
            const result = await createSubscription({
                userId,
                plan,
                paymentMethod,
                returnUrl: `${window.location.origin}/subscription/success`
            });

            console.log('[Subscription] Assinatura criada:', result.data);
            return (result.data as any).preferenceId;
        } catch (error: any) {
            console.error('[Subscription] Erro ao criar assinatura:', error);
            throw new Error(error.message || 'Erro ao criar assinatura');
        }
    },

    // Cancela assinatura
    async cancelSubscription(userId: string): Promise<void> {
        try {
            const cancelSubscription = httpsCallable(app, 'cancelSubscription');
            await cancelSubscription({ userId });
            
            console.log('[Subscription] Assinatura cancelada');
            toast.success('Assinatura cancelada com sucesso');
        } catch (error: any) {
            console.error('[Subscription] Erro ao cancelar assinatura:', error);
            throw new Error(error.message || 'Erro ao cancelar assinatura');
        }
    },

    // Reativa assinatura
    async reactivateSubscription(userId: string): Promise<void> {
        try {
            const reactivateSubscription = httpsCallable(app, 'reactivateSubscription');
            await reactivateSubscription({ userId });
            
            console.log('[Subscription] Assinatura reativada');
            toast.success('Assinatura reativada com sucesso');
        } catch (error: any) {
            console.error('[Subscription] Erro ao reativar assinatura:', error);
            throw new Error(error.message || 'Erro ao reativar assinatura');
        }
    },

    // Verifica se usuário tem benefício específico
    hasBenefit(subscription: SubscriptionData | null, benefit: keyof SubscriptionPlans['prime']['features']): boolean {
        if (!subscription || subscription.status !== 'active') return false;
        
        const plan = SUBSCRIPTION_PLANS[subscription.plan as keyof SubscriptionPlans];
        return plan?.features[benefit] || false;
    },

    // Calcula cashback baseado na assinatura
    calculateCashback(subscription: SubscriptionData | null, purchaseAmount: number): number {
        if (!subscription || subscription.status !== 'active') return 0;
        
        const plan = SUBSCRIPTION_PLANS[subscription.plan as keyof SubscriptionPlans];
        const baseCashback = 0.02; // 2% base
        
        if (plan.features.cashbackMultiplier) {
            return purchaseAmount * baseCashback * plan.features.cashbackMultiplier;
        }
        
        return purchaseAmount * baseCashback;
    },

    // Verifica se tem frete grátis
    hasFreeDelivery(subscription: SubscriptionData | null): boolean {
        return this.hasBenefit(subscription, 'freeDelivery');
    },

    // Verifica se tem suporte prioritário
    hasPrioritySupport(subscription: SubscriptionData | null): boolean {
        return this.hasBenefit(subscription, 'prioritySupport');
    },

    // Verifica se tem descontos exclusivos
    hasExclusiveDiscounts(subscription: SubscriptionData | null): boolean {
        return this.hasBenefit(subscription, 'exclusiveDiscounts');
    },

    // Verifica se tem acesso antecipado
    hasEarlyAccess(subscription: SubscriptionData | null): boolean {
        return this.hasBenefit(subscription, 'earlyAccess');
    }
};

// Hook personalizado para assinaturas
export const useSubscription = () => {
    const { user } = useAuth();
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            subscriptionService.getCurrentSubscription(user.uid)
                .then(setSubscription)
                .finally(() => setLoading(false));
        }
    }, [user]);

    return {
        subscription,
        loading,
        isSubscribed: subscription?.status === 'active',
        plan: subscription?.plan,
        benefits: subscription ? SUBSCRIPTION_PLANS[subscription.plan]?.features : null,
        hasFreeDelivery: subscriptionService.hasFreeDelivery(subscription),
        hasPrioritySupport: subscriptionService.hasPrioritySupport(subscription),
        hasExclusiveDiscounts: subscriptionService.hasExclusiveDiscounts(subscription),
        hasEarlyAccess: subscriptionService.hasEarlyAccess(subscription),
        calculateCashback: (amount: number) => subscriptionService.calculateCashback(subscription, amount),
        createSubscription: (plan: SubscriptionPlan, paymentMethod: 'mercadopago' | 'credit_card') => 
            subscriptionService.createSubscription(user?.uid || '', plan, paymentMethod),
        cancelSubscription: () => subscriptionService.cancelSubscription(user?.uid || ''),
        reactivateSubscription: () => subscriptionService.reactivateSubscription(user?.uid || '')
    };
};

export default subscriptionService;
