import React, { useMemo } from 'react';

interface SmartUpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: any) => void;
  upsellItems: any[];
  total: number;
  minOrder: number;
}

const SmartUpsellModal: React.FC<SmartUpsellModalProps> = ({ 
  isOpen, onClose, onAdd, upsellItems, total, minOrder 
}) => {
  // Cálculos de progresso e valores faltantes
  const missingAmount = useMemo(() => Math.max(0, minOrder - total), [minOrder, total]);
  const progress = useMemo(() => Math.min(100, (total / minOrder) * 100), [total, minOrder]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (!isOpen) return null;

  // O primeiro item é a sugestão "matadora" (geralmente o de menor preço que cobre a meta)
  const bestOptionId = upsellItems.length > 0 ? upsellItems[0].id : null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6 bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#1C1C1E] w-full max-w-sm rounded-[40px] p-8 border border-white/10 text-center shadow-[0_0_50px_-12px_rgba(255,140,0,0.3)] relative overflow-hidden">
        
        {/* Efeito visual de fundo */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#FF8C00] opacity-20 blur-[80px] pointer-events-none"></div>

        {upsellItems.length > 0 ? (
          <>
            <div className="w-20 h-20 bg-gradient-to-br from-[#FF8C00] to-[#FF5500] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#FF8C00]/20 animate-bounce-short">
              <i className="fa-solid fa-rocket text-3xl text-white"></i>
            </div>

            <h3 className="text-white font-black text-2xl mb-2 tracking-tight">Quase lá!</h3>
            
            {/* Barra de Progresso Visual */}
            <div className="w-full bg-white/10 h-2.5 rounded-full mb-2 overflow-hidden border border-white/5">
                <div 
                  className="bg-gradient-to-r from-[#FF8C00] to-[#FFA500] h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(255,140,0,0.5)]" 
                  style={{ width: `${progress}%` }}
                ></div>
            </div>
            
            <p className="text-gray-400 text-xs mb-6 font-medium">
                Faltam apenas <span className="text-white font-bold">{formatCurrency(missingAmount)}</span> para o pedido mínimo.
            </p>

            <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-left px-2">
                Sugestões Inteligentes:
            </p>

            <div className="space-y-3 mb-8 max-h-[280px] overflow-y-auto custom-scrollbar pr-2">
              {upsellItems.map((item) => (
                <button 
                  key={item.id}
                  onClick={() => onAdd(item)}
                  className={`w-full p-3 rounded-[24px] flex items-center justify-between border transition-all group active:scale-95 relative overflow-hidden ${
                    item.id === bestOptionId 
                    ? 'bg-[#FF8C00]/10 border-[#FF8C00] hover:bg-[#FF8C00]/20 shadow-[0_0_20px_rgba(255,140,0,0.1)]' 
                    : 'bg-[#252529] border-transparent hover:bg-[#2C2C2E]'
                  }`}
                >
                  {item.id === bestOptionId && (
                      <div className="absolute top-0 right-0 bg-[#FF8C00] text-white text-[9px] font-black px-3 py-1 rounded-bl-xl tracking-tighter shadow-sm">
                          IDEAL
                      </div>
                  )}
                  
                  <div className="flex items-center space-x-4">
                    <img 
                      src={item.image} 
                      className="w-12 h-12 rounded-xl object-cover shadow-md group-hover:scale-105 transition-transform" 
                      alt={item.name} 
                      onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150&q=80"} 
                    />
                    <div className="text-left">
                      <p className="text-white font-bold text-sm line-clamp-1 group-hover:text-[#FF8C00] transition-colors">{item.name}</p>
                      <p className="text-[#FF8C00] font-black text-xs">{formatCurrency(item.price)}</p>
                    </div>
                  </div>

                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-inner ${
                    item.id === bestOptionId 
                    ? 'bg-[#FF8C00] text-white' 
                    : 'bg-white/10 text-gray-400 group-hover:bg-[#FF8C00] group-hover:text-white'
                  }`}>
                    <i className="fa-solid fa-plus text-xs"></i>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="py-8">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
              <i className="fa-solid fa-triangle-exclamation text-3xl text-red-500"></i>
            </div>
            <h3 className="text-white font-black text-xl mb-2">Pedido Mínimo</h3>
            <p className="text-gray-400 text-sm mb-8 px-4 font-medium leading-relaxed">
              Sua sacola está em <span className="text-white">{formatCurrency(total)}</span>. <br/>
              Adicione mais itens para chegar em <span className="text-white font-bold">{formatCurrency(minOrder)}</span>.
            </p>
          </div>
        )}

        <button 
          onClick={onClose} 
          className="w-full bg-white/5 text-gray-500 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-white/10 hover:text-white transition-all active:scale-95"
        >
          Escolher Manualmente
        </button>
      </div>
    </div>
  );
};

export default SmartUpsellModal;