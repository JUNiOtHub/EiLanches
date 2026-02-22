import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';

// Contextos e Hooks
import { CartProvider, useCart } from './context/CartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useAuthRouter } from './src/hooks/useAuthRouter';
import SplashScreen from './components/layout/SplashScreen';

// Telas
import Home from './screens/Home';
import Menu from './screens/Menu';
import Cart from './screens/Cart';
import Dashboard from './screens/Dashboard';
import Orders from './screens/Orders';
import OrderDetails from './screens/OrderDetails';
import Login from './screens/Login';
import DeliveryDashboard from './screens/DeliveryDashboard';
import Onboarding from './screens/Onboarding';
import Profile from './screens/Profile';
import Rewards from './screens/Rewards';
import Withdraw from './screens/Withdraw';
import Terms from './screens/Terms';

// --- Configurações de Navegação ---
const DESKTOP_NAV_LINKS = [
  { path: '/', label: 'Início' },
  { path: '/orders', label: 'Meus Pedidos' },
  { path: '/rewards', label: 'Vantagens' }
];

const MOBILE_NAV_CONFIG = [
  { path: '/', icon: 'fa-house-chimney', label: 'Início' },
  { path: '/orders', icon: 'fa-receipt', label: 'Pedidos' },
  { path: '/rewards', icon: 'fa-gift', label: 'Mimos' },
  { path: '/cart', icon: 'fa-cart-shopping', label: 'Sacola', isCart: true },
  { path: '/profile', icon: 'fa-circle-user', label: 'Perfil' }
];

// --- Sub-componente: Monitor de Conexão ---
const NetworkStatus: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); toast.success('Conexão restabelecida!'); };
    const handleOffline = () => { setIsOnline(false); toast.error('Você está offline no momento.'); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;
  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[150] bg-red-600 text-white px-6 py-2 rounded-full text-xs font-black animate-bounce shadow-2xl border border-white/20">
      <i className="fa-solid fa-wifi-slash mr-2"></i> SEM INTERNET
    </div>
  );
};

// --- Header Desktop Premium ---
const Header: React.FC<{ cartCount: number; isActive: (p: string) => boolean }> = React.memo(({ cartCount, isActive }) => {
  const { profile, signOut } = useAuth();
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 30);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };

    document.addEventListener('mousedown', clickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', clickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <header className={`w-full transition-all duration-500 p-4 hidden md:flex justify-between items-center border-b sticky top-0 z-[100] ${
      scrolled ? 'bg-[#141414]/95 backdrop-blur-xl border-white/10 py-3 shadow-2xl' : 'bg-transparent border-transparent py-6'
    }`}>
      <div className="flex items-center gap-10">
        <Link to="/" aria-label="Ir para página inicial" className="text-2xl font-black text-white flex items-center gap-2 group">
          <div className="w-10 h-10 bg-gradient-to-br from-[#FF8C00] to-[#FF4500] rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform duration-300" aria-hidden="true">
            <i className="fa-solid fa-rocket text-sm text-white"></i>
          </div>
          <span className="tracking-tighter">EiLanches</span>
        </Link>
        
        <nav className="flex items-center gap-8" aria-label="Navegação Principal">
          {DESKTOP_NAV_LINKS.map(link => (
            <Link 
              key={link.path} 
              to={link.path} 
              aria-current={isActive(link.path) ? 'page' : undefined}
              className={`text-sm font-bold transition-all relative ${isActive(link.path) ? 'text-white' : 'text-gray-500 hover:text-white'}`}
            >
              {link.label}
              {isActive(link.path) && <span className="absolute -bottom-2 left-0 w-full h-1 bg-[#FF8C00] rounded-full shadow-[0_0_10px_#FF8C00]" aria-hidden="true" />}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-6">
        <Link 
          to="/cart" 
          aria-label={`Sacola de compras, ${cartCount} itens`}
          className={`relative p-2 transition-transform hover:scale-110 ${isActive('/cart') ? 'text-[#FF8C00]' : 'text-gray-400'}`}
        >
          <i className="fa-solid fa-bag-shopping text-xl" aria-hidden="true"></i>
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#FF8C00] text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black border-2 border-[#141414]">
              {cartCount}
            </span>
          )}
        </Link>

        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setDropdownOpen(!isDropdownOpen)} 
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
            aria-label="Menu do usuário"
            className="flex items-center gap-3 p-1 pr-4 rounded-full bg-white/5 border border-white/10 hover:border-[#FF8C00]/50 transition-all"
          >
            <img 
              src={profile?.foto || `https://ui-avatars.com/api/?name=${profile?.nome || 'User'}&background=FF8C00&color=fff&bold=true`} 
              className="w-9 h-9 rounded-full object-cover" 
              alt={`Foto de perfil de ${profile?.nome || 'Usuário'}`}
            />
            <span className="text-xs font-black text-gray-200 uppercase tracking-widest">{profile?.nome?.split(' ')[0]}</span>
            <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>

          {isDropdownOpen && (
            <div 
              role="menu"
              className="absolute right-0 mt-4 w-52 bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl py-2 z-[110] animate-in fade-in slide-in-from-top-2"
            >
              <Link 
                to="/profile" 
                role="menuitem"
                onClick={() => setDropdownOpen(false)} 
                className="flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-[#FF8C00] hover:text-white transition-colors"
              >
                <i className="fa-solid fa-user-circle w-6" aria-hidden="true"></i> Meu Perfil
              </Link>
              <button 
                role="menuitem"
                onClick={() => { signOut(); setDropdownOpen(false); }} 
                className="flex items-center w-full px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors font-bold"
              >
                <i className="fa-solid fa-power-off w-6" aria-hidden="true"></i> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
});

// --- Roteador Principal da Aplicação ---
const AppRouter: React.FC = () => {
  const authState = useAuthRouter();
  const { items } = useCart();
  const { profile } = useAuth();
  const location = useLocation();

  const cartCount = useMemo(() => items.reduce((acc, i) => acc + i.quantity, 0), [items]);
  const isActive = (path: string) => location.pathname === path;
  const termsVersion = import.meta.env.VITE_TERMS_VERSION || '1.0';

  // Definição de perfis para clareza e segurança
  const isCustomer = authState === 'cliente' || authState === 'CUSTOMER';
  const isVendor = authState === 'vendedor' || authState === 'VENDOR';
  const isDriver = authState === 'entregador' || authState === 'DRIVER';

  // 1. Estado de Login
  if (authState === 'UNAUTHENTICATED') {
    return <Login />;
  }

  // 2. Bloqueio de Segurança: Onboarding e Termos
  const needsOnboarding = authState === 'ONBOARDING' || (authState !== 'UNAUTHENTICATED' && !profile?.tipoUsuario);
  const needsTerms = profile?.tipoUsuario && profile.termsAccepted?.[profile.tipoUsuario] !== termsVersion;

  if (needsOnboarding || needsTerms) {
    return (
      <Routes>
        <Route path="/terms" element={<Terms />} />
        <Route path="*" element={needsOnboarding ? <Onboarding /> : <Navigate to="/terms" replace />} />
      </Routes>
    );
  }

  // 3. Layout Principal para Usuários Autenticados
  return (
    <div className="w-full h-full bg-[#0A0A0A] relative flex flex-col overflow-hidden">
      <NetworkStatus />
      
      {/* Header e Navegação condicional para Clientes */}
      {isCustomer && <Header cartCount={cartCount} isActive={isActive} />}
      
      <main className={`flex-1 flex flex-col min-h-0 relative ${isCustomer ? 'pb-32 md:pb-10' : ''}`}>
        <Routes>
          {/* --- ÁREA DO VENDEDOR (BLINDADA) --- */}
          {isVendor && (
            <>
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/withdraw" element={<Withdraw />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </>
          )}

          {/* --- ÁREA DO ENTREGADOR (BLINDADA) --- */}
          {isDriver && (
            <>
              <Route path="/delivery" element={<DeliveryDashboard />} />
              <Route path="/withdraw" element={<Withdraw />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="*" element={<Navigate to="/delivery" replace />} />
            </>
          )}

          {/* --- ÁREA DO CLIENTE (APP PADRÃO) --- */}
          {isCustomer && (
            <>
              <Route path="/" element={<Home />} />
              <Route path="/shop/:id" element={<Menu />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/order/:id" element={<OrderDetails />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </main>
      
      {isCustomer && (
      <nav className="md:hidden fixed bottom-6 left-6 right-6 bg-[#141414]/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] z-[100] px-4 py-3">
        <div className="flex justify-around items-center">
          {MOBILE_NAV_CONFIG.map((link) => (
            <Link key={link.path} to={link.path} className={`flex flex-col items-center gap-1 transition-all duration-300 relative ${isActive(link.path) ? 'text-[#FF8C00] -translate-y-2' : 'text-gray-500'}`}>
              <div className="relative">
                <i className={`fa-solid ${link.icon} text-xl`}></i>
                {link.isCart && cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-gradient-to-r from-[#FF8C00] to-[#FF4500] text-white text-[9px] min-w-[16px] h-4 rounded-full flex items-center justify-center font-black border border-[#0F0F0F]">{cartCount}</span>
                )}
              </div>
              <span className={`text-[8px] font-black uppercase tracking-widest ${isActive(link.path) ? 'opacity-100' : 'opacity-40'}`}>{link.label}</span>
              {isActive(link.path) && <div className="absolute -bottom-2 w-1.5 h-1.5 bg-[#FF8C00] rounded-full shadow-[0_0_12px_#FF8C00]"></div>}
            </Link>
          ))}
        </div>
      </nav>
      )}
    </div>
  );
};

// --- Main Content & Router Core ---
const MainContent: React.FC = () => {
  const authState = useAuthRouter();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (authState !== 'LOADING') {
      const timer = setTimeout(() => setShowSplash(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [authState]);

  if (showSplash || authState === 'LOADING') return <SplashScreen isFadingOut={!showSplash} />;
  
  // AppRouter agora controla toda a lógica de qual tela ou layout renderizar.
  return <AppRouter />;
};

// --- Root App ---
const App: React.FC = () => (
  <AuthProvider>
    <CartProvider>
      <Router>
        <div className="h-screen bg-[#050505] text-white font-sans flex justify-center selection:bg-[#FF8C00]/30 overflow-hidden">
          <div className="w-full max-w-7xl h-full relative flex flex-col">
            <Toaster position="top-center" toastOptions={{
              className: 'font-bold',
              style: { background: '#1A1A1A', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px' }
            }} />
            <MainContent />
          </div>
        </div>
      </Router>
    </CartProvider>
  </AuthProvider>
);

export default App;