import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { db, doc, getDoc, collection, onSnapshot, query } from '../firebase';
// import ProductDetailsModal from '../components/ProductDetailsModal';
import toast from 'react-hot-toast';

const Menu: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, items } = useCart();
  const [shop, setShop] = useState<any>(null);
  const [menu, setMenu] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchShop = async () => {
      try {
        const shopDoc = await getDoc(doc(db, 'users', id));
        if (shopDoc.exists()) {
          setShop(shopDoc.data());
        } else {
          toast.error('Loja não encontrada');
          navigate('/');
        }
      } catch (error) {
        console.error('Erro ao buscar loja:', error);
        toast.error('Erro ao carregar loja');
      } finally {
        setLoading(false);
      }
    };

    fetchShop();
  }, [id, navigate]);

  useEffect(() => {
    if (!shop) return;

    const q = query(collection(db, `users/${id}/menu`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const menuData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMenu(menuData);
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
    const cats = ['Todos', ...new Set(menu.map(item => item.category).filter(Boolean))];
    return cats;
  }, [menu]);

  const filteredMenuByCategory = useMemo(() => {
    if (activeCategory === 'Todos') return filteredMenu;
    
    return filteredMenu.filter(item => item.category === activeCategory);
  }, [filteredMenu, activeCategory]);

  if (loading) {
    return <div className="min-h-screen bg-[#141414] flex items-center justify-center">
      <div className="text-white text-2xl font-bold">🍔 EiLanches</div>
    </div>;
  }

  if (!shop) {
    return <div className="min-h-screen bg-[#141414] flex items-center justify-center">
      <div className="text-white text-xl">Loja não encontrada</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Header */}
      <div className="bg-[#1a1a1a] p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="text-white hover:text-orange-500 transition-colors"
          >
            <i className="fa-solid fa-arrow-left mr-2"></i>
            Voltar
          </button>
          <h1 className="text-xl font-bold text-white">{shop.name}</h1>
          <div className="flex items-center space-x-4">
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button className="bg-orange-500 text-white p-2 rounded-lg hover:bg-orange-600">
              <i className="fa-solid fa-search"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="p-4">
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                activeCategory === category 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <div className="p-4">
        {Object.entries(
          filteredMenuByCategory.reduce((acc, item) => {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
            return acc;
          }, {} as Record<string, any[]>)
        ).map(([category, items]) => (
          <div key={category} className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">{category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(item => (
                <div key={item.id} className="bg-white/10 backdrop-blur-lg rounded-xl p-4 hover:bg-white/20 transition-all cursor-pointer"
                     onClick={() => setSelectedItem(item)}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-white">{item.name}</h3>
                    <span className="text-2xl font-bold text-orange-500">R$ {item.price?.toFixed(2)}</span>
                  </div>
                  <p className="text-white/80 text-sm mb-4">{item.description}</p>
                  {item.available ? (
                    <button 
                      onClick={() => {
                        addToCart(item, shop.id);
                        setSelectedItem(null);
                        toast.success(`${item.name} adicionado!`);
                      }}
                      className="w-full bg-orange-500 text-white py-3 rounded-lg font-bold hover:bg-orange-600"
                    >
                      <i className="fa-solid fa-plus mr-2"></i>
                      Adicionar ao Carrinho
                    </button>
                  ) : (
                    <span className="text-[10px] font-black text-red-500 uppercase border border-red-500/30 px-2 py-1 rounded">Esgotado</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* MODAL DE DETALHES DO PRODUTO */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">{selectedItem.name}</h3>
            <p className="text-gray-600 mb-4">{selectedItem.description}</p>
            <p className="text-2xl font-bold text-orange-500 mb-6">
              R$ {selectedItem.price?.toFixed(2)}
            </p>
            <button
              onClick={() => {
                addToCart(selectedItem, shop.id);
                setSelectedItem(null);
                toast.success(`${selectedItem.name} adicionado!`);
              }}
              className="w-full bg-orange-500 text-white py-3 rounded-lg font-bold hover:bg-orange-600"
            >
              Adicionar ao Carrinho
            </button>
            <button
              onClick={() => setSelectedItem(null)}
              className="w-full mt-2 text-gray-500 py-2"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Menu;
