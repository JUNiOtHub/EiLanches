import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, query, where, onSnapshot } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [featuredShop, setFeaturedShop] = useState<any>(null);
  const [showIdleModal, setShowIdleModal] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
    link.type = 'image/svg+xml';
    link.rel = 'shortcut icon';
    link.href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='32' fill='%23FF8C00'/%3E%3Cpath d='M18 26 C18 18 46 18 46 26 Z' fill='white'/%3E%3Crect x='16' y='29' width='32' height='6' rx='2' fill='white'/%3E%3Cpath d='M18 38 L46 38 C46 44 18 44 18 38 Z' fill='white'/%3E%3C/svg%3E";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    // Busca usuários que são vendedores (lojas)
    const q = query(
      collection(db, 'users'),
      where('tipoUsuario', '==', 'vendedor')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setShops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      // Seleciona uma loja aleatória para ser o "Filme Destaque" (Hero)
      if (!snapshot.empty) {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFeaturedShop(docs[Math.floor(Math.random() * docs.length)]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar lojas:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- INTELIGÊNCIA: DETECTOR DE INATIVIDADE (RECUPERAÇÃO) ---
  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setShowIdleModal(false);
    idleTimerRef.current = setTimeout(() => {
      setShowIdleModal(true);
    }, 30000); // 30 segundos de inatividade
  };

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetIdleTimer));
    resetIdleTimer();
    return () => {
      events.forEach(event => document.removeEventListener(event, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // --- INTELIGÊNCIA: BLOQUEIO F12 (PROTEÇÃO BÁSICA) ---
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-[#141414] flex items-center justify-center">
      <div className="text-white text-2xl font-bold">🍔 EiLanches</div>
    </div>;
  }

  // Função de Fallback Inteligente para Imagens
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.currentTarget;
    // Evita loop infinito se o fallback também falhar
    if (target.src.includes('ui-avatars.com')) return;
    
    const name = target.alt || 'Loja';
    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=FF8C00&color=fff&size=200&font-size=0.5`;
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white pb-24 font-sans selection:bg-[#FF8C00] selection:text-white">
      
      {/* HERO SECTION (ESTILO NETFLIX) */}
      {featuredShop && (
        <div className="relative w-full h-[70vh] sm:h-[80vh]">
          <div className="absolute inset-0">
            <img 
              src={featuredShop.image || featuredShop.foto || "https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=800&q=80"} 
              className="w-full h-full object-cover opacity-80"
              alt="Destaque"
              onError={handleImageError}
            />
            {/* Gradiente Cinematográfico */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#000000] via-[#000000]/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#000000]/80 via-transparent to-transparent" />
          </div>

          <div className="absolute bottom-0 left-0 w-full p-6 sm:p-12 z-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.8 }}
            >
              <span className="inline-block px-3 py-1 mb-3 border border-[#FF8C00] text-[#FF8C00] text-[10px] font-black uppercase tracking-[0.2em] rounded-full bg-black/50 backdrop-blur-md">
                Destaque da Semana
              </span>
              <h1 className="text-5xl sm:text-7xl font-black mb-2 leading-none tracking-tighter">
                {featuredShop.nomeLoja}
              </h1>
              <p className="text-gray-300 text-sm sm:text-lg max-w-md mb-6 font-medium line-clamp-2">
                {featuredShop.description || "O melhor sabor da cidade, entregue na sua porta com a rapidez que você merece."}
              </p>

              {/* GATILHO DE URGÊNCIA */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center text-green-400 text-xs font-bold bg-green-400/10 px-3 py-1.5 rounded-lg border border-green-400/20">
                  <i className="fa-solid fa-clock mr-2 animate-pulse"></i>
                  Sai fornada em 15 min
                </div>
                <div className="flex items-center text-[#FF8C00] text-xs font-bold bg-[#FF8C00]/10 px-3 py-1.5 rounded-lg border border-[#FF8C00]/20">
                  <i className="fa-solid fa-fire mr-2"></i>
                  Alta Demanda
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => navigate(`/shop/${featuredShop.id}`)}
                  className="bg-[#FF8C00] text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#FF4500] transition-all active:scale-95 shadow-[0_0_30px_rgba(255,140,0,0.4)] flex items-center"
                >
                  <i className="fa-solid fa-play mr-2"></i> Quero Agora
                </button>
                <button className="bg-white/10 backdrop-blur-md text-white px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-white/20 transition-all active:scale-95 border border-white/10">
                  <i className="fa-solid fa-plus mr-2"></i> Minha Lista
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* FILEIRA DE BOLINHAS (STORIES/LOJAS) */}
      <div className="mt-4 pl-6 relative z-20">
        <h3 className="text-white font-bold text-sm mb-4 flex items-center">
          <span className="w-1 h-4 bg-[#FF8C00] rounded-full mr-2"></span>
          Lojas Disponíveis
        </h3>
        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar pr-6">
          {shops.map((shop) => (
            <motion.div 
              key={shop.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(`/shop/${shop.id}`)}
              className="flex flex-col items-center gap-2 min-w-[80px] cursor-pointer group"
            >
              <div className={`w-20 h-20 rounded-full p-[2px] ${shop.isOpen ? 'bg-gradient-to-tr from-[#FF8C00] to-yellow-400 shadow-[0_0_15px_rgba(255,140,0,0.5)] animate-pulse-slow' : 'bg-gray-700'}`}>
                <div className="w-full h-full rounded-full border-2 border-black overflow-hidden relative">
                  <img 
                    src={shop.image || shop.foto || "https://cdn-icons-png.flaticon.com/512/3075/3075977.png"} 
                    className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${!shop.isOpen && 'grayscale'}`}
                    alt={shop.nomeLoja}
                    onError={handleImageError}
                  />
                  {!shop.isOpen && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <i className="fa-solid fa-lock text-white/50"></i>
                    </div>
                  )}
                </div>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wide text-center truncate w-full ${shop.isOpen ? 'text-white' : 'text-gray-600'}`}>
                {shop.nomeLoja}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* FILEIRAS DE CONTEÚDO (NETFLIX ROWS) */}
      <div className="space-y-8 mt-6 pl-6 pb-10">
        
        {/* ROW 1: EM ALTA */}
        <section>
          <h3 className="text-gray-200 font-bold text-base mb-3 hover:text-[#FF8C00] transition-colors cursor-pointer flex items-center group">
            Em Alta no Povoado <i className="fa-solid fa-chevron-right text-xs ml-2 opacity-0 group-hover:opacity-100 transition-opacity"></i>
          </h3>
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar pr-6">
            {shops.map((shop) => (
              <motion.div 
                key={`trend-${shop.id}`}
                whileHover={{ scale: 1.05, zIndex: 10 }}
                className="min-w-[160px] aspect-[2/3] bg-[#1E1E1E] rounded-lg overflow-hidden relative cursor-pointer border border-white/5 group"
                onClick={() => navigate(`/shop/${shop.id}`)}
              >
                <img src={shop.image || shop.foto || "https://cdn-icons-png.flaticon.com/512/3075/3075977.png"} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" onError={handleImageError} />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 p-3 w-full">
                  <p className="text-[#FF8C00] text-[9px] font-black uppercase mb-1">
                    {shop.deliveryTime || '30 min'}
                  </p>
                  <h4 className="text-white font-bold text-sm leading-tight">{shop.nomeLoja}</h4>
                </div>
                {/* Badge TOP 10 */}
                <div className="absolute top-2 right-2 bg-[#E50914] text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg">
                  TOP 10
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ROW 2: CATEGORIAS (SIMULADO COM LOJAS POR ENQUANTO) */}
        <section>
          <h3 className="text-gray-200 font-bold text-base mb-3">Para Matar a Fome</h3>
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar pr-6">
             {/* Mock de Categorias Visuais */}
             {['Hambúrguer', 'Pizza', 'Açaí', 'Bebidas', 'Sobremesa'].map((cat, idx) => (
               <div key={idx} className="min-w-[200px] h-28 bg-[#1E1E1E] rounded-xl relative overflow-hidden cursor-pointer border border-white/5 hover:border-[#FF8C00]/50 transition-all group">
                 <div className="absolute inset-0 bg-gradient-to-r from-black to-transparent z-10" />
                 <img src={`https://source.unsplash.com/random/400x200?${cat}`} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700" alt={cat} />
                 <div className="absolute bottom-3 left-4 z-20">
                   <h4 className="text-white font-black text-lg uppercase italic tracking-tighter">{cat}</h4>
                 </div>
               </div>
             ))}
          </div>
        </section>
      </div>

      {/* MODAL DE RECUPERAÇÃO (IDLE) */}
      <AnimatePresence>
        {showIdleModal && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-24 right-4 left-4 sm:left-auto sm:w-80 bg-[#1E1E1E] border border-[#FF8C00] p-6 rounded-3xl shadow-[0_0_50px_rgba(255,140,0,0.3)] z-50"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#FF8C00]/20 rounded-full flex items-center justify-center shrink-0 animate-bounce">
                <i className="fa-solid fa-bell text-[#FF8C00] text-xl"></i>
              </div>
              <div>
                <h4 className="text-white font-black text-sm uppercase mb-1">Ainda com dúvida?</h4>
                <p className="text-gray-400 text-xs mb-3">O Rancho acabou de tirar uma fornada de pães de alho. Não vai perder, né?</p>
                <button 
                  onClick={() => { setShowIdleModal(false); navigate('/shop/rancho-id-mock'); }} // Ajuste o ID conforme necessário
                  className="text-[#FF8C00] text-xs font-black uppercase tracking-widest hover:text-white transition-colors"
                >
                  Ver Oferta <i className="fa-solid fa-arrow-right ml-1"></i>
                </button>
              </div>
              <button onClick={() => setShowIdleModal(false)} className="text-gray-600 hover:text-white">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Home;
