import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, doc, getDoc, setDoc, deleteDoc } from '../firebase';
import toast from 'react-hot-toast';

interface ProductDetailsModalProps {
  item: any;
  shop: any;
  onClose: () => void;
  onAddToCart: (item: any, price: number, addons: any[], obs: string, quantity: number) => void;
}

const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({ item, shop, onClose, onAddToCart }) => {
  const { user } = useAuth();
  const [selectedAddons, setSelectedAddons] = useState<any[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [observation, setObservation] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [loadingFav, setLoadingFav] = useState(false);

  // Limpa os estados quando o item muda
  useEffect(() => {
    setSelectedAddons([]);
    setObservation('');
    setQuantity(1);
    
    // Verifica se já é favorito
    if (user && item) {
      getDoc(doc(db, 'users', user.uid, 'favorites', item.id)).then(snap => {
        setIsFavorite(snap.exists());
      });
    }
  }, [item]);

  const handleToggleFavorite = async () => {
    if (!user) {
      toast.error("Faça login para favoritar!");
      return;
    }
    setLoadingFav(true);
    try {
      const docRef = doc(db, 'users', user.uid, 'favorites', item.id);
      if (isFavorite) {
        await deleteDoc(docRef);
        setIsFavorite(false);
        toast.success("Removido dos favoritos.");
      } else {
        await setDoc(docRef, {
          itemId: item.id,
          name: item.name,
          image: item.image,
          price: item.price,
          shopId: shop.id,
          shopName: shop.nomeLoja,
          addedAt: new Date().toISOString()
        });
        setIsFavorite(true);
        toast.success("Salvo nos favoritos!");
      }
    } catch (e) {
      toast.error("Erro ao atualizar favoritos.");
    } finally {
      setLoadingFav(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.name,
          text: `Olha que delícia: ${item.name} no ${shop.nomeLoja}!`,
          url: window.location.href
        });
      } catch (e) {}
    } else {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(window.location.href);
          toast.success("Link copiado!");
        } else {
          // Fallback para ambientes não seguros (HTTP) ou navegadores antigos
          const textArea = document.createElement("textarea");
          textArea.value = window.location.href;
          textArea.style.position = "fixed"; // Evita scroll
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          if (successful) toast.success("Link copiado!");
          else throw new Error("Falha ao copiar");
        }
      } catch (err) {
        toast.error("Não foi possível copiar o link.");
      }
    }
  };

  if (!item) return null;

  // Adicionais (Usa os do item ou um mock se não houver)
  const availableAddons = item?.addons || [
    { name: "Bacon Extra", price: 4.00 },
    { name: "Queijo Cheddar", price: 3.50 },
    { name: "Molho Especial", price: 2.00 },
    { name: "Ovo", price: 1.50 }
  ];

  const toggleAddon = (addon: any) => {
    if (selectedAddons.find(a => a.name === addon.name)) {
      setSelectedAddons(selectedAddons.filter(a => a.name !== addon.name));
    } else {
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  const basePrice = (item.promoPrice && item.promoPrice < item.price) ? item.promoPrice : item.price;
  const finalPrice = basePrice + selectedAddons.reduce((acc: number, a: any) => acc + a.price, 0);

  const incrementQty = () => setQuantity(q => q + 1);
  const decrementQty = () => setQuantity(q => Math.max(1, q - 1));

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="bg-[#1E1E1E] w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-0 relative z-10 overflow-hidden animate-in slide-in-from-bottom duration-300 shadow-2xl border border-white/10 flex flex-col max-h-[90vh]">
        
        {/* Header com Imagem */}
        <div className="h-64 w-full relative shrink-0">
          <img src={item.image} className="w-full h-full object-cover" alt={item.name} onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=80"} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1E1E1E] via-transparent to-transparent"></div>
          <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-95 hover:bg-black/70 transition-colors"><i className="fa-solid fa-xmark"></i></button>
          
          {/* Botões de Ação (Favoritar e Compartilhar) */}
          <div className="absolute top-4 left-4 flex space-x-2">
            <button 
              onClick={handleToggleFavorite}
              disabled={loadingFav}
              className={`w-10 h-10 backdrop-blur-md rounded-full flex items-center justify-center transition-all active:scale-95 ${isFavorite ? 'bg-red-500/90 text-white shadow-lg shadow-red-500/30' : 'bg-black/50 text-white hover:bg-black/70'}`}
            >
              <i className={`fa-${isFavorite ? 'solid' : 'regular'} fa-heart`}></i>
            </button>
            <button 
              onClick={handleShare}
              className="w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-95 hover:bg-black/70 transition-colors"
            >
              <i className="fa-solid fa-share-nodes"></i>
            </button>
          </div>
        </div>

        {/* Conteúdo Scrollável */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-3xl font-black text-white leading-tight flex-1 mr-4">{item.name}</h2>
            <div className="text-right">
              {item.promoPrice ? (
                <>
                  <p className="text-gray-500 text-xs line-through">R$ {item.price.toFixed(2)}</p>
                  <p className="text-green-500 font-black text-xl">R$ {item.promoPrice.toFixed(2)}</p>
                </>
              ) : (
                <p className="text-[#FF8C00] font-black text-xl">R$ {item.price.toFixed(2)}</p>
              )}
            </div>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">{item.description || "Sem descrição detalhada."}</p>
          
          {/* Lista de Adicionais */}
          {availableAddons.length > 0 && (
          <div className="mb-6">
            <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-3">Adicionais</p>
            <div className="space-y-2">
              {availableAddons.map((addon: any, idx: number) => {
                const isSelected = selectedAddons.find(a => a.name === addon.name);
                return (
                  <div 
                    key={idx}
                    onClick={() => toggleAddon(addon)}
                    className={`flex justify-between items-center p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-[#FF8C00]/10 border-[#FF8C00]' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-[#FF8C00] border-[#FF8C00]' : 'border-gray-600'}`}>
                        {isSelected && <i className="fa-solid fa-check text-white text-xs"></i>}
                      </div>
                      <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-400'}`}>{addon.name}</span>
                    </div>
                    <span className="text-white font-bold text-xs">+ {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(addon.price)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* Campo de Observações */}
          <div className="mb-4">
            <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-3">Observação</p>
            <textarea 
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ex: Sem cebola, capricha no molho..."
              className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white text-sm outline-none focus:border-[#FF8C00] min-h-[80px] resize-none"
            />
          </div>
          
        </div>

        {/* Footer Fixo com Botão */}
        <div className="p-6 border-t border-white/5 bg-[#1E1E1E] shrink-0 z-20 pb-8 sm:pb-6">
          <div className="flex gap-4">
            {/* Quantity Selector */}
            <div className="flex items-center bg-black/40 rounded-2xl border border-white/5 px-2 h-14">
                <button onClick={decrementQty} className="w-10 h-full flex items-center justify-center text-gray-400 hover:text-white text-lg"><i className="fa-solid fa-minus"></i></button>
                <span className="w-8 text-center font-black text-white">{quantity}</span>
                <button onClick={incrementQty} className="w-10 h-full flex items-center justify-center text-[#FF8C00] hover:text-white text-lg"><i className="fa-solid fa-plus"></i></button>
            </div>

            <button 
              onClick={() => onAddToCart(item, finalPrice, selectedAddons, observation, quantity)} 
              className="flex-1 bg-[#FF8C00] text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-[#FF8C00]/20 active:scale-95 transition-all flex flex-col items-center justify-center h-14"
            >
              <span>Adicionar</span>
              <span className="text-[10px] opacity-80">R$ {(finalPrice * quantity).toFixed(2)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailsModal;