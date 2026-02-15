import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, query, where, orderBy, onSnapshot } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { getStatusConfig } from '../utils/statusConfig';

const Orders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    console.log("[Orders] Iniciando busca de pedidos para UID:", user.uid);

    // TESTE 1: Query sem orderBy para verificar se é problema de índice
    const q = query(
      collection(db, 'pedidos'),
      where('clienteUid', '==', user.uid)
      // orderBy('createdAt', 'desc') // REMOVIDO TEMPORARIAMENTE PARA TESTE
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`[Orders] Snapshot recebido: ${snapshot.docs.length} documentos`);
      
      if (snapshot.empty) {
        console.log("[Orders] Nenhum pedido encontrado para este UID:", user.uid);
        setOrders([]);
      } else {
        const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        console.log("[Orders] Pedidos brutos encontrados:", allOrders.length);
        
        // Ordenação manual no frontend (enquanto não temos índice)
        const sortedOrders = allOrders.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
          return dateB - dateA; // Mais recentes primeiro
        });
        
        const visibleOrders = sortedOrders.filter((order: any) => order.hiddenForClient !== true);
        console.log("[Orders] Pedidos visíveis após filtro:", visibleOrders.length);
        
        setOrders(visibleOrders);
      }
      setLoading(false);
    }, (error) => {
      console.error("[Orders] Erro no Firebase:", error);
      console.error("[Orders] Código do erro:", error.code);
      console.error("[Orders] Mensagem:", error.message);
      setLoading(false);
      toast.error(`Erro ao carregar pedidos: ${error.message}`);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) return <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center text-white">Carregando pedidos...</div>;

  return (
    <div className="min-h-screen bg-[#0F0F0F] p-6 pb-24 animate-in fade-in duration-500">
      <h1 className="text-3xl font-black text-white mb-8">Meus <span className="text-[#FF8C00]">Pedidos</span></h1>
      
      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="text-center py-10 opacity-50">
            <i className="fa-solid fa-receipt text-4xl mb-4"></i>
            <p className="text-gray-400 mb-6">Você ainda não fez nenhum lanche hoje! 🍔</p>
            <button 
              onClick={() => navigate('/')}
              className="bg-[#FF8C00] text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-[#FF8C00]/90 transition-all"
            >
              Fazer meu primeiro pedido
            </button>
          </div>
        ) : (
          orders.map(order => {
            const statusConfig = getStatusConfig(order.status, order.createdAt);
            const pontosGanhos = Math.floor((order.finalTotal || order.total || 0) / 10); // 1 ponto a cada R$10
            
            return (
              <div 
                key={order.id} 
                onClick={() => navigate(`/order/${order.id}`)}
                className={`p-4 rounded-2xl border-2 mb-3 shadow-md cursor-pointer active:scale-95 transition-all ${statusConfig.border} ${statusConfig.bg} ${statusConfig.animation || ''}`}
              >
                {/* CABEÇALHO DO CARD */}
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{statusConfig.icon}</span>
                    <span className={`font-bold text-sm ${statusConfig.color}`}>{statusConfig.label}</span>
                  </div>
                  <span className="text-zinc-500 text-xs font-black uppercase tracking-widest">#{order.id.slice(-4)}</span>
                </div>

                {/* INFORMAÇÕES DO PEDIDO */}
                <div className="mb-3">
                  <h4 className="font-black text-white text-lg mb-1">{order.lojaNome}</h4>
                  <p className="text-zinc-400 text-sm mb-2">
                    {order.itens?.slice(0, 2).map((item: any) => `${item.quantity}x ${item.name}`).join(', ')}
                    {order.itens?.length > 2 && ` +${order.itens.length - 2} itens`}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <i className="fa-solid fa-clock"></i>
                    <span>{order.createdAt?.toDate ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(order.createdAt.toDate()) : 'Data pendente'}</span>
                  </div>
                </div>

                {/* SEÇÃO DE VANTAGENS (Gatilho de Retenção) */}
                <div className="bg-black/20 p-3 rounded-xl flex items-center justify-between border border-white/5 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🪙</span>
                    <div>
                      <p className="text-[10px] text-zinc-300 uppercase font-black">Vantagens deste pedido:</p>
                      <p className="text-green-400 font-bold text-sm">+{pontosGanhos} Pontos Fidelidade</p>
                    </div>
                  </div>
                  {pontosGanhos >= 10 && (
                    <span className="bg-yellow-500/20 text-yellow-400 text-[8px] font-black px-2 py-1 rounded-lg border border-yellow-500/30">
                      BÔNUS +5
                    </span>
                  )}
                </div>

                {/* BOTÃO DE RASTREIO (Se estiver saindo para entrega) */}
                {order.status === 'entrega' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (order.location?.lat && order.location?.lng) {
                        window.open(`https://www.google.com/maps?q=${order.location.lat},${order.location.lng}`, '_blank');
                      } else {
                        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.endereco)}`, '_blank');
                      }
                    }}
                    className="w-full bg-white text-black font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors border-2 border-white/20"
                  >
                    <i className="fa-solid fa-location-dot"></i>
                    📍 ACOMPANHAR ENTREGA
                  </button>
                )}

                {/* RODAPÉ COM TOTAL E STATUS ESPECIAL */}
                <div className="border-t border-white/10 pt-3 flex justify-between items-end">
                  <div>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Total Pago</p>
                    <p className="text-white font-black text-lg">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.finalTotal || order.total || 0)}
                    </p>
                  </div>
                  {order.status === 'concluido' && !order.avaliado && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); navigate(`/order/${order.id}`); }}
                      className="bg-[#FF8C00] text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest animate-bounce-short border border-[#FF8C00]/30"
                    >
                      AVALIAR
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Orders;