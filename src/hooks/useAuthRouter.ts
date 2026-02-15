import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export type AuthRouteState = 'LOADING' | 'UNAUTHENTICATED' | 'ONBOARDING' | 'VENDOR' | 'DRIVER' | 'CLIENT';

export const useAuthRouter = () => {
  const { user, profile, loading } = useAuth();
  const [authState, setAuthState] = useState<AuthRouteState>('LOADING');

  useEffect(() => {
    // 1. Aguarda o Firebase inicializar
    if (loading) {
      setAuthState('LOADING');
      return;
    }

    // 2. Se não tem usuário, manda pro Login
    if (!user) {
      setAuthState('UNAUTHENTICATED');
      return;
    }

    // 3. Se tem usuário mas não tem perfil completo (sem tipo ou nome), manda pro Onboarding
    if (!profile || !profile.tipoUsuario || !profile.nome) {
      setAuthState('ONBOARDING');
      return;
    }

    // 4. Direcionamento por Role (Perfil)
    switch (profile.tipoUsuario) {
      case 'vendedor':
        setAuthState('VENDOR');
        break;
      case 'entregador':
        setAuthState('DRIVER');
        break;
      case 'cliente':
        setAuthState('CLIENT');
        break;
      default:
        setAuthState('ONBOARDING'); // Fallback de segurança
    }
  }, [user, profile, loading]);

  return authState;
};