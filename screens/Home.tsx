import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, query, where, onSnapshot } from '../firebase';
import ShopCard from '../components/ShopCard';
import CategoryPill from '../components/CategoryPill';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { items, total } = useCart();
  const { profile } = useAuth();
  const [shops, setShops] = useState<any[]>([]);
  const [newShops, setNewShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const newShopsRef = useRef<HTMLDivElement>(null);

  const categories = ['Todos', 'Lanches', 'Pizzas', 'Bebidas', 'Açaí', 'Sobremesas', 'Entrega Grátis'];

  useEffect(() => {
    setLoading(true);
    // Busca apenas usuários do tipo 'vendedor' em tempo real
    const q = query(collection(db, 'users'), where('tipoUsuario', '==', 'vendedor'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const shopsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setShops(shopsData);

        // Ordena por data de criação (mais recente primeiro) para o carrossel "New Releases"
        const sortedByDate = [...shopsData].sort((a: any, b: any) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
            return dateB - dateA;
        });
        setNewShops(sortedByDate.slice(0, 5)); // Top 5 mais recentes
        setLoading(false);
    }, (error) => {
        console.error("Erro ao carregar lojas:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredShops = shops.filter(shop => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = (shop.nomeLoja || '').toLowerCase().includes(term) || (shop.category || '').toLowerCase().includes(term);
    
    let matchesCategory = true;
    if (activeCategory === 'Entrega Grátis') {
        matchesCategory = shop.deliveryFee === 0;
    } else if (activeCategory !== 'Todos') {
        // Se a loja tiver categoria, usa ela. Se não, assume 'Lanches' como padrão para não sumir.
        const cat = shop.category || 'Lanches'; 
        matchesCategory = cat === activeCategory;
    }
    return matchesSearch && matchesCategory;
  });

  const scrollToNewShops = () => {
    newShopsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleTrendingClick = () => {
    setSearchTerm('Promoção'); 
    toast('Filtrando as melhores ofertas!', { icon: '🔥', style: { background: '#333', color: '#fff' } });
  };

  const handleCouponClick = () => {
    navigate('/rewards');
  };

  return (
    <div className="h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#FF8C00] selection:text-black overflow-hidden flex flex-col md:flex-row">
      
      {/* LEFT SIDEBAR (NAVIGATION) */}
      <div className="hidden md:flex flex-col w-20 lg:w-64 bg-[#121212] border-r border-white/5 h-full pt-8 px-4 gap-6 shrink-0 z-20">
         <div className="px-2 lg:px-4 mb-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#FF8C00] to-[#FF4500] rounded-xl flex items-center justify-center shadow-lg shadow-[#FF8C00]/20 shrink-0">
                <i className="fa-solid fa-gamepad text-white text-lg"></i>
            </div>
            <div className="hidden lg:block">
                <h1 className="text-xl font-black tracking-tighter italic leading-none">Ei<span className="text-[#FF8C00]">Lanches</span></h1>
                <p className="text-[8px] font-bold text-gray-500 uppercase tracking-[0.3em]">Ultimate</p>
            </div>
         </div>
         
         <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
           {/* Navegação Principal Adicionada */}
           <button onClick={() => navigate('/orders')} className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-all group">
              <span className="text-lg w-6 text-center"><i className="fa-solid fa-receipt group-hover:text-[#FF8C00] transition-colors"></i></span>
              <span className="text-xs font-black uppercase tracking-wide hidden lg:block">Meus Pedidos</span>
           </button>
           <button onClick={() => navigate('/rewards')} className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-all group">
              <span className="text-lg w-6 text-center"><i className="fa-solid fa-crown group-hover:text-[#FF8C00] transition-colors"></i></span>
              <span className="text-xs font-black uppercase tracking-wide hidden lg:block">Vantagens</span>
           </button>
           
           <div className="h-px bg-white/5 my-2 mx-2"></div>

           {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${activeCategory === cat ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
              >
                 {activeCategory === cat && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF8C00]"></div>}
                 <span className="text-lg w-6 text-center"><i className={`fa-solid ${cat === 'Todos' ? 'fa-layer-group' : cat === 'Lanches' ? 'fa-burger' : cat === 'Pizzas' ? 'fa-pizza-slice' : 'fa-utensils'}`}></i></span>
                 <span className="text-xs font-black uppercase tracking-wide z-10 hidden lg:block">{cat}</span>
              </button>
           ))}
         </div>

         <div className="mt-auto mb-8">
            <button onClick={() => navigate('/profile')} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group">
                <img src={profile?.foto || `https://ui-avatars.com/api/?name=${profile?.nome || 'User'}`} className="w-8 h-8 rounded-full border-2 border-white/10 group-hover:border-[#FF8C00]" alt="Profile" />
                <div className="hidden lg:block text-left">
                    <p className="text-xs font-bold text-white truncate w-32">{profile?.nome || 'Visitante'}</p>
                    <p className="text-[9px] text-gray-500 uppercase font-black">Meu Perfil</p>
                </div>
            </button>
         </div>
      </div>

      {/* CENTER CONTENT (DASHBOARD) */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Top Bar */}
        <div className="h-20 flex items-center justify-between px-8 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl z-10">
            <div className="relative w-96">
                <input
                   type="text"
                   placeholder="Buscar loja ou lanche..."
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full bg-[#181818] border border-white/10 focus:border-[#FF8C00] rounded-full px-12 py-3 text-white font-bold outline-none transition-all shadow-inner text-sm"
                />
                <i className="fa-solid fa-search absolute left-5 top-1/2 -translate-y-1/2 text-gray-500"></i>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-[#181818] px-4 py-2 rounded-full border border-white/5">
                    <i className="fa-solid fa-location-dot text-[#FF8C00]"></i>
                    <span className="text-xs font-bold text-gray-300">Itiúba, BA</span>
                </div>
                <button className="w-10 h-10 bg-[#181818] rounded-full flex items-center justify-center text-white hover:text-[#FF8C00] transition-colors border border-white/5">
                    <i className="fa-solid fa-bell"></i>
                </button>
            </div>
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
            {/* WIDGETS ROW */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                {/* Widget 1: Trending */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-[#181818] to-[#121212] p-5 rounded-2xl border border-white/5 relative overflow-hidden group cursor-pointer hover:border-[#FF8C00]/30 transition-all">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <i className="fa-solid fa-fire text-6xl text-[#FF8C00]"></i>
                    </div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Em Alta 🔥</p>
                    <h3 className="text-xl font-black text-white mb-1">O Melhor da Cidade</h3>
                    <p className="text-xs text-gray-400 mb-3">Peça agora o lanche favorito da galera.</p>
                    <button onClick={handleTrendingClick} className="bg-[#FF8C00] text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform">
                        Ver Oferta
                    </button>
                </motion.div>

                {/* Widget 2: Coupons */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="bg-[#FF8C00] p-5 rounded-2xl border border-white/5 relative overflow-hidden group cursor-pointer shadow-[0_0_30px_rgba(255,140,0,0.15)]">
                    <div className="absolute -right-4 -bottom-4 opacity-20">
                        <i className="fa-solid fa-ticket text-8xl text-black"></i>
                    </div>
                    <p className="text-[10px] font-black text-black/60 uppercase tracking-widest mb-1">EiLanches Prime</p>
                    <h3 className="text-xl font-black text-white mb-1">Entrega Grátis</h3>
                    <p className="text-xs text-white/80 mb-3">Resgate seu cupom diário agora.</p>
                    <button onClick={handleCouponClick} className="bg-black text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform">Resgatar</button>
                </motion.div>

                {/* Widget 3: Discovery */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} onClick={scrollToNewShops} className="bg-gradient-to-br from-[#181818] to-[#121212] p-5 rounded-2xl border border-white/5 relative overflow-hidden group cursor-pointer hover:border-blue-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <i className="fa-solid fa-compass text-6xl text-blue-500"></i>
                    </div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Explorar</p>
                    <h3 className="text-xl font-black text-white mb-1">Novas Lojas</h3>
                    <p className="text-xs text-gray-400 mb-3">Confira quem acabou de chegar.</p>
                    <div className="flex -space-x-2">
                        {[1,2,3].map(i => <div key={i} className="w-6 h-6 rounded-full bg-gray-700 border-2 border-[#181818]"></div>)}
                    </div>
                </motion.div>
            </div>

            {/* NEW RELEASES CAROUSEL (GAME PASS STYLE) */}
            {newShops.length > 0 && (
              <div className="mb-10" ref={newShopsRef}>
                <h3 className="text-xl font-black text-white mb-4 uppercase tracking-widest flex items-center gap-2">
                   <i className="fa-solid fa-star text-green-500"></i> Novidades na Área
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                   {newShops.map((shop) => (
                      <div key={shop.id} className="min-w-[280px] md:min-w-[320px]">
                         <ShopCard shop={shop} onClick={() => navigate(`/shop/${shop.id}`)} isNew={true} />
                      </div>
                   ))}
                </div>
              </div>
            )}

            <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3 mt-12">
                <i className="fa-solid fa-store text-[#FF8C00]"></i> Lojas Disponíveis
            </h2>

            {/* SHOP GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                {loading ? (
                    [...Array(8)].map((_, i) => (
                        <div key={i} className="aspect-[16/10] bg-[#181818] rounded-xl animate-pulse border border-white/5"></div>
                    ))
                ) : (
                    filteredShops.map((shop, index) => (
                        <motion.div
                            key={shop.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <ShopCard shop={shop} onClick={() => navigate(`/shop/${shop.id}`)} />
                        </motion.div>
                    ))
                )}
            </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR (CART) - DESKTOP ONLY */}
      <div className="hidden xl:flex flex-col w-80 bg-[#121212] border-l border-white/5 h-full z-20">
         <div className="p-6 border-b border-white/5">
            <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-bag-shopping text-[#FF8C00]"></i> Sacola
            </h2>
         </div>
         
         <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                    <i className="fa-solid fa-basket-shopping text-4xl mb-4"></i>
                    <p className="text-sm font-bold">Sua sacola está vazia</p>
                    <p className="text-xs">Adicione itens para começar</p>
                </div>
            ) : (
                items.map(item => (
                    <div key={item.id} className="bg-[#181818] p-3 rounded-xl border border-white/5 flex gap-3 group hover:border-[#FF8C00]/30 transition-colors">
                        <div className="w-12 h-12 bg-black/40 rounded-lg flex items-center justify-center text-xs font-black text-gray-500">
                            {item.quantity}x
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{item.name}</p>
                            <p className="text-xs text-[#FF8C00] font-bold">R$ {item.price.toFixed(2)}</p>
                        </div>
                    </div>
                ))
            )}
         </div>

         <div className="p-6 bg-[#181818] border-t border-white/5">
            <div className="flex justify-between items-center mb-4">
                <span className="text-gray-400 text-xs font-bold uppercase">Total</span>
                <span className="text-xl font-black text-white">R$ {total.toFixed(2)}</span>
            </div>
            <button 
                onClick={() => navigate('/cart')}
                disabled={items.length === 0}
                className="w-full py-4 bg-[#FF8C00] text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-[#FF8C00]/20 hover:bg-[#FF9900] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Finalizar Pedido
            </button>
         </div>
      </div>

      {/* MOBILE NAV (Visible only on mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#121212]/95 backdrop-blur-xl border-t border-white/5 z-50 px-6 py-3 flex justify-between items-center">
         <button onClick={() => navigate('/')} className="flex flex-col items-center text-[#FF8C00]">
            <i className="fa-solid fa-home text-xl mb-1"></i>
            <span className="text-[9px] font-black uppercase">Início</span>
         </button>
         <button onClick={() => navigate('/orders')} className="flex flex-col items-center text-gray-500 hover:text-white">
            <i className="fa-solid fa-receipt text-xl mb-1"></i>
            <span className="text-[9px] font-black uppercase">Pedidos</span>
         </button>
         <button onClick={() => navigate('/cart')} className="flex flex-col items-center text-gray-500 hover:text-white relative">
            <div className="relative">
                <i className="fa-solid fa-bag-shopping text-xl mb-1"></i>
                {items.length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#FF8C00] rounded-full"></span>}
            </div>
            <span className="text-[9px] font-black uppercase">Sacola</span>
         </button>
         <button onClick={() => navigate('/profile')} className="flex flex-col items-center text-gray-500 hover:text-white">
            <i className="fa-solid fa-user text-xl mb-1"></i>
            <span className="text-[9px] font-black uppercase">Perfil</span>
         </button>
      </div>
    </div>
  );
};

export default Home;