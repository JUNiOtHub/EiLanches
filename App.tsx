import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { CartProvider, useCart } from './context/CartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useAuthRouter } from './src/hooks/useAuthRouter';
import SplashScreen from './components/layout/SplashScreen';

// Import Screens
import Home from './screens/Home';
import Menu from './screens/Menu';
import Cart from './screens/Cart';
import Dashboard from './screens/Dashboard'; // Dashboard Principal (Com aba Loja, Preview e Configurações)
import Orders from './screens/Orders';
import OrderDetails from './screens/OrderDetails';
import Login from './screens/Login';
import DeliveryDashboard from './screens/DeliveryDashboard';
import Onboarding from './screens/Onboarding';
import Profile from './screens/Profile';
import Rewards from './screens/Rewards';
import Withdraw from './screens/Withdraw';
import Terms from './screens/Terms';

// --- Customer Header ---
const Header: React.FC<{ cartCount: number; isActive: (path: string) => boolean }> = ({ cartCount, isActive }) => {
  const { profile } = useAuth();

  return (
    <header className="w-full bg-[#141414]/80 backdrop-blur-lg p-4 flex justify-between items-center border-b border-white/5 sticky top-0 z-[100]">
      <Link to="/" className="text-xl font-black text-white flex items-center gap-2">
        <span className="w-8 h-8 bg-gradient-to-br from-[#FF8C00] to-[#FF4500] rounded-lg flex items-center justify-center">
          <i className="fa-solid fa-rocket text-sm"></i>
        </span>
        EiLanches
      </Link>
      <nav className="hidden md:flex items-center gap-6">
        <Link to="/" className={`text-sm font-bold transition-colors ${isActive('/') ? 'text-white' : 'text-gray-500 hover:text-white'}`}>Início</Link>
        <Link to="/orders" className={`text-sm font-bold transition-colors ${isActive('/orders') ? 'text-white' : 'text-gray-500 hover:text-white'}`}>Meus Pedidos</Link>
        <Link to="/rewards" className={`text-sm font-bold transition-colors ${isActive('/rewards') ? 'text-white' : 'text-gray-500 hover:text-white'}`}>Vantagens</Link>
      </nav>
      <div className="flex items-center gap-4">
        <Link to="/cart" className={`relative transition-colors ${isActive('/cart') ? 'text-white' : 'text-gray-500 hover:text-white'}`}>
          <i className="fa-solid fa-bag-shopping text-lg"></i>
          {cartCount > 0 && (
            <div className="absolute -top-2 -right-2 bg-[#FF8C00] text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black border-2 border-[#141414]">
              {cartCount}
            </div>
          )}
        </Link>
        <Link to="/profile">
          <img 
            src={profile?.foto || `https://ui-avatars.com/api/?name=${profile?.nome}&background=222&color=fff&bold=true`} 
            alt="User" 
            className="w-8 h-8 rounded-full border-2 border-white/10 hover:border-[#FF8C00] transition-colors"
          />
        </Link>
      </div>
    </header>
  );
};

// --- Main Content & Router Logic ---
const MainContent: React.FC = () => {
  const authState = useAuthRouter();
  const { items } = useCart();
  const { profile } = useAuth();
  const location = useLocation();
  
  const [showSplash, setShowSplash] = useState(true);
  
  const cartCount = items.reduce((acc, i) => acc + i.quantity, 0);
  const isActive = (path: string) => location.pathname === path;

  const termsVersion = import.meta.env.VITE_TERMS_VERSION || '1.0';

  // Controle da Splash Screen
  useEffect(() => {
    if (authState !== 'LOADING') {
      // Pequeno delay para a animação de saída suave
      const timer = setTimeout(() => setShowSplash(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [authState]);

  // Renderiza Splash enquanto carrega ou enquanto a animação não termina
  if (showSplash || authState === 'LOADING') {
    return <SplashScreen isFadingOut={!showSplash && authState !== 'LOADING'} />;
  }
  
  // --- Roteamento Baseado em Estado ---

  // 1. Não Autenticado -> Login
  if (authState === 'UNAUTHENTICATED') {
    return <Login />;
  }

  // 2. Perfil Incompleto -> Onboarding
  if (authState === 'ONBOARDING') {
    return (
      <Routes>
        <Route path="/terms" element={<Terms />} />
        <Route path="*" element={<Onboarding />} />
      </Routes>
    );
  }

  // 3. Termos não aceitos -> Tela de Termos
  // Força o usuário a aceitar os termos antes de prosseguir para qualquer outra parte do app.
  if (profile?.tipoUsuario && profile.termsAccepted?.[profile.tipoUsuario] !== termsVersion) {
    return (
        <Routes>
            <Route path="/terms" element={<Terms />} />
            {/* Qualquer outra rota redireciona para a tela de termos */}
            <Route path="*" element={<Navigate to="/terms" replace />} />
        </Routes>
    );
  }

  // 4. Vendedor -> Dashboard Admin
  if (authState === 'VENDOR') {
    return (
      <Routes>
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/withdraw" element={<Withdraw />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  // 5. Entregador -> Dashboard Delivery
  if (authState === 'DRIVER') {
    return (
      <Routes>
        <Route path="/delivery" element={<DeliveryDashboard />} />
        <Route path="/withdraw" element={<Withdraw />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/delivery" replace />} />
      </Routes>
    );
  }

  // 6. Cliente -> App Padrão
  return (
    <div className="w-full min-h-screen bg-[#0F0F0F] relative flex flex-col">
      {location.pathname !== '/' && <Header cartCount={cartCount} isActive={isActive} />}
      <main className={`flex-1 ${location.pathname !== '/' ? 'pb-20 md:pb-0' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop/:id" element={<Menu />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/order/:id" element={<OrderDetails />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      
      {/* Bottom Navigation - Mobile Only */}
      {location.pathname !== '/' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#141414]/95 backdrop-blur-lg border-t border-white/5 z-[100]">
          <div className="flex justify-around items-center py-2">
            <Link to="/" className={`flex flex-col items-center p-2 rounded-lg transition-colors ${isActive('/') ? 'text-[#FF8C00]' : 'text-gray-500 hover:text-white'}`}>
              <i className="fa-solid fa-home text-lg mb-1"></i>
              <span className="text-[10px] font-medium">Início</span>
            </Link>
            <Link to="/orders" className={`flex flex-col items-center p-2 rounded-lg transition-colors relative ${isActive('/orders') ? 'text-[#FF8C00]' : 'text-gray-500 hover:text-white'}`}>
              <i className="fa-solid fa-receipt text-lg mb-1"></i>
              <span className="text-[10px] font-medium">Pedidos</span>
            </Link>
            <Link to="/cart" className={`flex flex-col items-center p-2 rounded-lg transition-colors relative ${isActive('/cart') ? 'text-[#FF8C00]' : 'text-gray-500 hover:text-white'}`}>
              <i className="fa-solid fa-bag-shopping text-lg mb-1"></i>
              <span className="text-[10px] font-medium">Carrinho</span>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#FF8C00] text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-black">
                  {cartCount}
                </span>
              )}
            </Link>
            <Link to="/profile" className={`flex flex-col items-center p-2 rounded-lg transition-colors ${isActive('/profile') ? 'text-[#FF8C00]' : 'text-gray-500 hover:text-white'}`}>
              <i className="fa-solid fa-user text-lg mb-1"></i>
              <span className="text-[10px] font-medium">Perfil</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

// --- App Root ---
const App: React.FC = () => {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#FF8C00] selection:text-white flex justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1a1a1a] to-[#050505] overflow-x-hidden">
            <div className="w-full min-h-screen relative">
              <Toaster
                position="top-center"
                reverseOrder={false}
                toastOptions={{
                  className: 'font-sans font-bold',
                  style: { background: '#1E1E1E', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px' },
                  success: { iconTheme: { primary: '#FF8C00', secondary: 'white' } },
                  error: { iconTheme: { primary: '#ef4444', secondary: 'white' } },
                }}
              />
              <MainContent />
            </div>
          </div>
        </Router>
      </CartProvider>
    </AuthProvider>
  );
};

export default App;
