import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMemo } from 'react';

/**
 * Hook customizado para gerenciar rotas protegidas e evitar loops infinitos
 */
export const useProtectedRoutes = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Memoizar estado de autenticação para evitar re-renderizações
  const authState = useMemo(() => ({
    isAuthenticated: !!user,
    isProfileComplete: !!(profile?.tipoUsuario),
    userType: profile?.tipoUsuario,
    isLoading: loading,
    needsRedirect: false,
    redirectPath: null as string | null
  }), [user, profile, loading]);

  // Verificar se precisa redirecionar (sem causar loops)
  const checkRedirect = useMemo(() => {
    if (authState.isLoading) return null;
    
    const currentPath = location.pathname;
    
    // DEBUG: Log para rastrear redirecionamentos
    console.log(`🔍 [DEBUG] Usuário tipo: ${authState.userType} | Path atual: ${currentPath}`);
    
    // Se não está autenticado e não está na página de login
    if (!authState.isAuthenticated && currentPath !== '/login') {
      console.log(`🔄 [DEBUG] Redirecionando não autenticado para /login`);
      return { shouldRedirect: true, to: '/login' };
    }
    
    // Se está autenticado mas perfil incompleto
    if (authState.isAuthenticated && !authState.isProfileComplete && currentPath !== '/onboarding') {
      console.log(`🔄 [DEBUG] Redirecionando perfil incompleto para /onboarding`);
      return { shouldRedirect: true, to: '/onboarding' };
    }
    
    // 🔥 REDIRECIONAMENTO CRÍTICO APÓS ONBOARDING
    // Se acabou de completar onboarding e está na raiz, redirecionar para área correta
    if (authState.isAuthenticated && authState.isProfileComplete && currentPath === '/') {
      if (authState.userType === 'vendedor') {
        console.log(`🔄 [DEBUG] REDIRECIONANDO VENDEDOR para /admin (Dashboard)`);
        return { shouldRedirect: true, to: '/admin' };
      } else if (authState.userType === 'entregador') {
        console.log(`🔄 [DEBUG] REDIRECIONANDO ENTREGADOR para /delivery`);
        return { shouldRedirect: true, to: '/delivery' };
      }
      // Cliente permanece na raiz (/)
    }
    
    // Proteção de rotas específicas
    if (currentPath === '/admin' && authState.userType !== 'vendedor') {
      console.log(`🚫 [DEBUG] Bloqueando acesso não-vendedor à /admin`);
      return { shouldRedirect: true, to: '/' };
    }
    
    if (currentPath === '/delivery' && authState.userType !== 'entregador') {
      console.log(`🚫 [DEBUG] Bloqueando acesso não-entregador à /delivery`);
      return { shouldRedirect: true, to: '/' };
    }
    
    console.log(`✅ [DEBUG] Sem redirecionamento necessário`);
    return { shouldRedirect: false, to: null };
  }, [authState, location.pathname]);

  return {
    ...authState,
    checkRedirect,
    canAccessAdmin: authState.userType === 'vendedor',
    canAccessDelivery: authState.userType === 'entregador',
    isClient: authState.userType === 'cliente'
  };
};
