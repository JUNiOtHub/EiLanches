import React, { useState, useEffect, useMemo } from 'react';
import { db, doc, getDoc, updateDoc } from '../firebase';
import toast from 'react-hot-toast';

interface SellerOrderModalProps {
  order: any;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  onNotifyDriver: (id: string) => void;
  onNotifyPickup: (id: string) => void;
  onCancelOrder: (id: string, reason: string) => void; // Para cancelar pedidos
  onDeleteOrder: (id: string) => void; // Para deletar pedidos permanentemente
}

const SellerOrderModal: React.FC<SellerOrderModalProps> = ({ 
  order, onClose, onUpdateStatus, onNotifyDriver, onNotifyPickup, onCancelOrder, onDeleteOrder
}) => {
  const [clientStats, setClientStats] = useState<any>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [showCancelOptions, setShowCancelOptions] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [loading, setLoading] = useState(false);

  // Cronômetro Otimizado
  useEffect(() => {
    const calculateTime = () => {
      if (!order?.createdAt) return;
      const created = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      const diff = Math.floor((Date.now() - created.getTime()) / 60000);
      setElapsedMinutes(Math.max(0, diff));
    };
    calculateTime();
    const interval = setInterval(calculateTime, 60000);
    return () => clearInterval(interval);
  }, [order?.createdAt]);

  // Busca dados do cliente
  useEffect(() => {
    if (order?.clienteUid) {
      getDoc(doc(db, 'users', order.clienteUid)).then(snap => {
        if (snap.exists()) setClientStats(snap.data());
      }).catch(err => console.error("Erro ao buscar cliente:", err));
    }
  }, [order?.clienteUid]);

  const handleCopyTicket = () => {
    const currency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const itensStr = order.itens?.map((i: any) => (
      `✅ ${i.quantity}x ${i.name.toUpperCase()}` +
      `${i.addons?.length ? `\n   └ Extras: ${i.addons.map((a:any) => a.name).join(', ')}` : ''}` +
      `${i.observation ? `\n   ⚠️ OBS: ${i.observation}` : ''}`
    )).join('\n\n');

    const text = `*PEDIDO #${order.id.slice(-4)}* 🍔\n` +
                 `━━━━━━━━━━━━━━━━━━\n` +
                 `👤 *CLIENTE:* ${order.clienteNome}\n` +
                 `📍 *ENTREGA:* ${order.endereco}\n` +
                 `💰 *TOTAL:* ${currency(order.finalTotal || order.total)}\n` +
                 `━━━━━━━━━━━━━━━━━━\n` +
                 `${itensStr}\n` +
                 `━━━━━━━━━━━━━━━━━━\n` +
                 `*EiLanches - Delivery Premium*`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      toast.success("WhatsApp Ticket copiado!");
    } else {
      toast.error("Erro: Copia requer HTTPS ou Localhost.");
    }
  };

  const handleDelay = async (minutes: number) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'pedidos', order.id), {
        deliverySchedule: `Atraso: +${minutes} min`,
        statusMessage: `O restaurante avisou que levará mais ${minutes} min.`
      });
      toast.success(`Atraso de ${minutes}min notificado.`);
    } catch (e) { toast.error("Erro ao atualizar."); }
    finally { setLoading(false); }
  };

  const handleAddItem = async () => {
    if (!newItemName || !newItemPrice) return;
    setLoading(true);
    try {
      const price = parseFloat(newItemPrice.replace(',', '.'));
      const newItem = {
        name: newItemName,
        price: price,
        quantity: 1,
        addons: [],
        observation: 'Adicionado pelo restaurante'
      };

      const updatedItems = [...(order.itens || []), newItem];
      const currentTotal = order.finalTotal || order.total || 0;
      const newTotal = currentTotal + price;

      await updateDoc(doc(db, 'pedidos', order.id), {
        itens: updatedItems,
        finalTotal: newTotal,
        total: newTotal,
        netValue: (order.netValue || 0) + price
      });
      
      toast.success("Item adicionado!");
      setNewItemName('');
      setNewItemPrice('');
      setShowAddForm(false);
    } catch (e) {
      toast.error("Erro ao adicionar item.");
    } finally {
      setLoading(false);
    }
  };

  const nextAction = useMemo(() => {
    const statusMap: any = {
      'pendente': { label: 'Iniciar Preparo', icon: 'fa-fire-burner', color: 'bg-[#FF8C00]', action: () => onUpdateStatus(order.id, 'preparando') },
      'preparando': order.deliveryMode === 'pickup' 
        ? { label: 'Pronto p/ Retirada', icon: 'fa-bag-shopping', color: 'bg-green-600', action: () => onNotifyPickup(order.id) }
        : { label: 'Chamar Entregador', icon: 'fa-motorcycle', color: 'bg-blue-600', action: () => onNotifyDriver(order.id) },
      'entrega': { label: 'Finalizar Pedido', icon: 'fa-check-double', color: 'bg-green-600', action: () => onUpdateStatus(order.id, 'concluido') },
      'pronto_retirada': { label: 'Entregue ao Cliente', icon: 'fa-user-check', color: 'bg-green-600', action: () => onUpdateStatus(order.id, 'concluido') }
    };
    return statusMap[order.status] || null;
  }, [order.status, order.deliveryMode]);

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="bg-[#18181B] w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] border border-white/10 relative z-10 flex flex-col max-h-[90vh] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* HEADER */}
        <div className="p-6 border-b border-white/5 bg-[#202024]">
          <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Pedido em andamento</p>
                <h2 className="text-4xl font-black text-white tracking-tighter">#{order.id.slice(-4)}</h2>
              </div>
              <div className="flex flex-col items-end">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 shadow-sm ${elapsedMinutes > 20 ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-green-500/20 text-green-500'}`}>
                  <i className="fa-solid fa-clock mr-1"></i> {elapsedMinutes} min
                </span>
                <span className="text-gray-500 text-[10px] font-bold">{new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
          </div>

          <div className="flex items-center justify-between bg-black/30 p-3 rounded-2xl border border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF8C00] to-[#FF5500] flex items-center justify-center text-white font-black shadow-lg">
                {order.clienteNome.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight truncate max-w-[150px]">{order.clienteNome}</p>
                <p className="text-gray-500 text-[10px] font-bold flex items-center gap-1 mt-0.5">
                   {clientStats?.loyaltyPoints > 50 && <i className="fa-solid fa-crown text-[#FF8C00]"></i>}
                   {clientStats?.loyaltyPoints || 0} pts acumulados
                </p>
              </div>
            </div>
            <button onClick={handleCopyTicket} className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 hover:bg-green-500 hover:text-white transition-all active:scale-90" title="Copiar para WhatsApp">
               <i className="fa-brands fa-whatsapp text-lg"></i>
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-[#18181B]">
          <div className="space-y-4">
            {order.itens?.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between items-start py-3 border-b border-white/5 last:border-0">
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <span className="bg-[#FF8C00] text-white w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 shadow-lg shadow-[#FF8C00]/20">
                      {item.quantity}
                    </span>
                    <div className="flex-1">
                      <p className="text-white font-bold text-base leading-tight line-clamp-2">{item.name}</p>
                      {item.addons?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.addons.map((addon: any, aIdx: number) => (
                            <span key={aIdx} className="text-[9px] text-[#FF8C00] bg-[#FF8C00]/10 px-2 py-0.5 rounded-md font-black border border-[#FF8C00]/10">
                              + {addon.name.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.observation && (
                        <p className="mt-3 text-yellow-500 text-[11px] font-bold bg-yellow-500/5 p-2 rounded-xl border border-yellow-500/10 flex items-start gap-2 italic">
                          <i className="fa-solid fa-quote-left text-[8px] mt-1 opacity-50"></i>
                          {item.observation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-white font-black text-sm whitespace-nowrap ml-4">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>
          
          <div className="mt-8 pt-4 border-t-2 border-dashed border-white/5 flex justify-between items-end">
             <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">Resumo Financeiro</p>
             <div className="text-right">
                <p className="text-white/40 text-[10px] font-bold mb-[-4px]">Valor Total</p>
                <p className="text-[#FF8C00] text-3xl font-black tracking-tighter">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.finalTotal || order.total)}
                </p>
             </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-6 bg-[#202024] border-t border-white/5 space-y-4">
           {nextAction && (
             order.status === 'entrega' && order.deliveryMode === 'delivery' ? (
               <div className="w-full py-5 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-3 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                 <i className="fa-solid fa-lock"></i> Aguardando Validação do PIN
               </div>
             ) : (
               <button 
                 disabled={loading}
                 onClick={() => { nextAction.action(); onClose(); }}
                 className={`w-full py-5 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl active:scale-[0.97] transition-all flex items-center justify-center gap-3 ${nextAction.color} text-white hover:brightness-110 disabled:opacity-50`}
               >
                 {loading ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <>{nextAction.label} <i className={`fa-solid ${nextAction.icon}`}></i></>}
               </button>
             )
           )}

          {showAddForm && (
            <div className="p-4 bg-black/20 rounded-xl border border-white/5 animate-in slide-in-from-bottom-2">
               <h4 className="text-white font-bold text-xs mb-3">Adicionar Item Extra</h4>
               <div className="flex gap-2 mb-3">
                 <input 
                   placeholder="Ex: Coca-Cola Lata" 
                   value={newItemName}
                   onChange={e => setNewItemName(e.target.value)}
                   className="flex-[2] bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-[#FF8C00]"
                 />
                 <input 
                   type="number" 
                   placeholder="R$ 0,00" 
                   value={newItemPrice}
                   onChange={e => setNewItemPrice(e.target.value)}
                   className="flex-1 bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-[#FF8C00]"
                 />
               </div>
               <button 
                 onClick={handleAddItem}
                 disabled={loading || !newItemName || !newItemPrice}
                 className="w-full bg-[#FF8C00] text-white py-3 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-[#e68a00] transition-colors disabled:opacity-50"
               >
                 Adicionar ao Pedido
               </button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <button 
              disabled={loading} 
              onClick={() => handleDelay(15)} 
              className="py-3 bg-[#27272A] border border-white/5 rounded-xl text-gray-300 font-black text-[10px] uppercase hover:bg-white/5 hover:text-white transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-sm"
            >
              <i className="fa-solid fa-clock-rotate-left text-sm"></i> Atrasar
            </button>
            <button 
              onClick={() => setShowAddForm(!showAddForm)} 
              className={`py-3 border border-white/5 rounded-xl font-black text-[10px] uppercase transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-sm ${showAddForm ? 'bg-[#FF8C00] text-white' : 'bg-[#27272A] text-gray-300 hover:text-white'}`}
            >
              <i className="fa-solid fa-pen-to-square text-sm"></i> Editar
            </button>
            {order.status === 'cancelado' ? (
              <button 
                onClick={() => onDeleteOrder(order.id)} 
                className="py-3 bg-red-600/10 border border-red-600/20 rounded-xl text-red-600 font-black text-[10px] uppercase hover:bg-red-600 hover:text-white transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-sm"
              >
                <i className="fa-solid fa-trash text-sm"></i> Excluir
              </button>
            ) : (
              <button onClick={() => setShowCancelOptions(!showCancelOptions)} className="py-3 bg-red-500/5 border border-red-500/10 rounded-xl text-red-500 font-black text-[10px] uppercase hover:bg-red-500 hover:text-white transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-sm">
                <i className="fa-solid fa-circle-xmark text-sm"></i> Cancelar
              </button>
            )}
          </div>

          {showCancelOptions && (
            <div className="grid grid-cols-2 gap-2 pt-2 animate-in slide-in-from-top-2 fade-in">
              {['Sem Estoque', 'Loja Lotada', 'Área Risco', 'Outro'].map(r => (
                <button key={r} onClick={() => onCancelOrder(order.id, r)} className="bg-red-600 text-white py-2 rounded-xl text-[9px] font-black uppercase hover:bg-red-700 transition-all active:scale-95">{r}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SellerOrderModal;