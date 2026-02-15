import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { db, doc, collection, onSnapshot, query } from '../firebase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import ProductDetailsModal from '../components/ProductDetailsModal';
import ProductCard from '../components/ProductCard';
import CategoryPill from '../components/CategoryPill';

const Menu: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [shop, setShop] = useState<any>(null);
  const [menu, setMenu] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    
    const unsubscribe = onSnapshot(doc(db, 'users', id), (docSnap) => {
        if (docSnap.exists()) {
          setShop({ id: docSnap.id, ...docSnap.data() });
        } else {
          toast.error('Loja não encontrada');
          navigate('/');
        }
        setLoading(false);
    }, (error) => {
        console.error('Erro ao buscar loja:', error);
        toast.error('Erro ao carregar loja');
        setLoading(false);
    });

    return () => unsubscribe();
  }, [id, navigate]);

  useEffect(() => {
    if (!shop || !id) return;
    const q = query(collection(db, 'users', id, 'cardapio'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const menuData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMenu(menuData);
    }, (error) => {
      console.error("Erro ao carregar cardápio (Permissões ou Rede):", error);
      // Não exibimos toast de erro aqui para não poluir a tela do usuário caso seja apenas um delay de permissão
    });
    return unsubscribe;
  }, [shop, id]);

  const filteredMenu = useMemo(() => {
    if (!searchTerm) return menu;
    return menu.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [menu, searchTerm]);

  const categories = useMemo(() => {
    return ['Todos', ...new Set(menu.map(item => item.category).filter(Boolean))];
  }, [menu]);

  const filteredMenuByCategory = useMemo(() => {
    if (activeCategory === 'Todos') return filteredMenu;
    return filteredMenu.filter(item => item.category === activeCategory);
  }, [filteredMenu, activeCategory]);

  const groupedMenu = useMemo(() => {
    return filteredMenuByCategory.reduce((acc, item) => {
      const cat = item.category || 'Geral';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, any[]>);
  }, [filteredMenuByCategory]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity }} className="text-[#FF8C00] text-3xl font-black">
          🍔 EiLanches
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white pb-24 font-sans">
      {/* Hero Section Imersivo */}
      <div className="relative h-72 w-full">
        <div className="absolute inset-0">
          <img 
            src={shop?.image || shop?.foto || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80"} 
            alt={shop?.nomeLoja} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F] via-[#0F0F0F]/60 to-transparent"></div>
        </div>
        
        <div className="absolute top-4 left-4 z-50">
          <button 
            onClick={() => navigate('/')}
            className="w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-[#FF8C00] transition-colors"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-6">
          <div className="flex items-end gap-4">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-24 h-24 rounded-2xl border-2 border-[#FF8C00] overflow-hidden bg-black shadow-2xl shrink-0"
            >
              <img 
                src={shop?.image || shop?.foto || "https://cdn-icons-png.flaticon.com/512/3075/3075977.png"} 
                alt="Logo" 
                className="w-full h-full object-cover"
              />
            </motion.div>
            <div className="flex-1 mb-1">
              <motion.h1 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-3xl font-black text-white leading-none mb-2 drop-shadow-lg"
              >
                {shop?.nomeLoja || shop?.name}
              </motion.h1>
              <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-gray-300">
                <span className="flex items-center gap-1 bg-[#FF8C00] text-white px-2 py-0.5 rounded-md font-bold">
                  <i className="fa-solid fa-star text-[10px]"></i> {shop?.rating ? shop.rating.toFixed(1) : '5.0'}
                </span>
                <span className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-2 py-0.5 rounded-md">
                  <i className="fa-solid fa-clock text-[#FF8C00]"></i> {shop?.deliveryTime || '30-40 min'}
                </span>
                <span className={shop?.isOpen ? 'text-green-500 font-bold bg-green-500/10 px-2 py-0.5 rounded-md' : 'text-red-500 font-bold bg-red-500/10 px-2 py-0.5 rounded-md'}>
                  {shop?.isOpen ? 'Aberto' : 'Fechado'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Categories Sticky */}
      <div className="sticky top-0 z-40 bg-[#0F0F0F]/95 backdrop-blur-xl border-b border-white/5 shadow-lg pt-4 pb-2 px-4">
        <div className="relative mb-4 max-w-7xl mx-auto">
          <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
          <input
            type="text"
            placeholder="Buscar no cardápio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#202020] border-2 border-transparent rounded-full pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:border-[#FF8C00] transition-all text-sm font-bold outline-none"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar max-w-7xl mx-auto">
          {categories.map(category => (
            <CategoryPill
              key={category}
              label={category}
              isActive={activeCategory === category}
              onClick={() => setActiveCategory(category)}
            />
          ))}
        </div>
      </div>

      {/* Grid de Itens */}
      <div className="p-4 space-y-8 min-h-[50vh] max-w-7xl mx-auto">
        {(Object.entries(groupedMenu) as [string, any[]][]).map(([category, items]) => (
          <div key={category} className="scroll-mt-32">
            <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tighter italic flex items-center gap-2">
              <span className="text-[#FF8C00]">#</span> {category}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item) => (
                <ProductCard 
                  key={item.id} 
                  product={item}
                  onClick={() => item.isAvailable && setSelectedItem(item)}
                  onAdd={(e) => {
                    e.stopPropagation();
                    addToCart(item, shop.id, shop.nomeLoja);
                    toast.success(`${item.name} adicionado!`, {
                      icon: '🛒',
                      style: { borderRadius: '10px', background: '#333', color: '#fff' }
                    });
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Glassmorphism */}
      {selectedItem && (
        <ProductDetailsModal 
          item={selectedItem} 
          shop={shop} 
          onClose={() => setSelectedItem(null)} 
          onAddToCart={(item, price, addons, obs, quantity) => {
            const itemToAdd = {
              ...item,
              price: price,
              addons: addons,
              observation: obs
            };
            
            // Adiciona a quantidade selecionada
            for(let i=0; i<quantity; i++) {
                addToCart(itemToAdd, shop.id, shop.nomeLoja);
            }
            
            toast.success(`${quantity}x ${item.name} adicionado!`, {
                icon: '🛒',
                style: { borderRadius: '10px', background: '#333', color: '#fff' }
            });
            setSelectedItem(null);
          }} 
        />
      )}
    </div>
  );
};

export default Menu;