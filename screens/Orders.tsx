import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, query, where, orderBy, onSnapshot } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { getStatusConfig } from '../utils/statusConfig';
import { motion, AnimatePresence } from 'framer-motion';

const Orders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  useEffect(() => {
    if (!user) return;

    console.log("[Orders] Iniciando busca de pedidos para UID:", user.uid);

    // TESTE 1: Query sem orderBy para verificar se é problema de índice
    const q = query(
      collection(db, 'pedidos'),
      where('clienteUid', '==', user.uid)
      // orderBy('createdAt', 'desc') // Removido: A ordenação já é feita no frontend (linhas 39-43) para evitar erro de índice
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

  const activeOrders = orders.filter(o => ['pendente', 'preparando', 'entrega', 'pronto_retirada'].includes(o.status));
  const historyOrders = orders.filter(o => ['concluido', 'cancelado', 'recusado', 'falha_pagamento'].includes(o.status));

  const displayedOrders = activeTab === 'active' ? activeOrders : historyOrders;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#FF8C00] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-24 md:pb-10 md:pt-6">
      {/* Header */}
      <div className="bg-[#0a0a0a]/90 backdrop-blur-xl sticky top-0 z-40 border-b border-white/5 px-6 py-4 md:bg-transparent md:border-none md:static md:max-w-7xl md:mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-4xl font-black text-white tracking-tighter">Meus <span className="text-[#FF8C00]">Pedidos</span></h1>
          <div className="bg-[#181818] rounded-full px-4 py-1.5 border border-white/5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{orders.length} Total</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-black/40 rounded-xl border border-white/5 relative">
          <button 
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all relative z-10 ${activeTab === 'active' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Em Andamento ({activeOrders.length})
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all relative z-10 ${activeTab === 'history' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Histórico
          </button>
          
          {/* Tab Indicator */}
          <motion.div 
            layoutId="tab-indicator"
            className="absolute top-1 bottom-1 bg-[#FF8C00] rounded-lg shadow-lg shadow-[#FF8C00]/20"
            initial={false}
            animate={{ 
              left: activeTab === 'active' ? '4px' : '50%', 
              width: 'calc(50% - 6px)' 
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-6 md:max-w-7xl md:mx-auto">
        <AnimatePresence mode='wait'>
          {displayedOrders.length === 0 ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-24 h-24 bg-[#181818] rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
                <i className={`fa-solid ${activeTab === 'active' ? 'fa-motorcycle' : 'fa-clock-rotate-left'} text-4xl text-gray-700`}></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {activeTab === 'active' ? 'Nenhum pedido em andamento' : 'Histórico vazio'}
              </h3>
              <p className="text-gray-500 text-sm max-w-[200px] mb-8">
                {activeTab === 'active' ? 'Seus pedidos ativos aparecerão aqui.' : 'Seus pedidos anteriores ficam salvos aqui.'}
              </p>
              {activeTab === 'active' && (
                <button 
                  onClick={() => navigate('/')}
                  className="bg-[#FF8C00] text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-[#FF8C00]/20 hover:scale-105 transition-transform"
                >
                  Fazer Pedido
                </button>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedOrders.map((order, index) => {
              const statusConfig = getStatusConfig(order.status, order.createdAt);
              const pontosGanhos = Math.floor((order.finalTotal || order.total || 0) / 10);
              
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/order/${order.id}`)}
                  className="bg-[#181818] border border-white/5 rounded-2xl p-0 relative overflow-hidden group cursor-pointer hover:border-[#FF8C00]/30 transition-all active:scale-[0.98] shadow-lg flex flex-col"
                >
                  {/* Status Bar */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusConfig.bg.replace('bg-', 'bg-').replace('/10', '')} group-hover:w-2 transition-all`}></div>

                  <div className="p-5 flex-1 pl-6">
                    {/* Header Card */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${statusConfig.bg} ${statusConfig.color} border border-white/5 shadow-inner`}>
                          {statusConfig.icon}
                        </div>
                        <div>
                          <h3 className="font-black text-white text-base leading-tight">{order.lojaNome}</h3>
                          <p className="text-xs text-gray-500 font-medium mt-0.5 flex items-center gap-1">
                            <i className="fa-regular fa-clock text-[10px]"></i>
                            {order.createdAt?.toDate 
                              ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(order.createdAt.toDate()) 
                              : 'Data pendente'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                    </div>

                    {/* Items Preview */}
                    <div className="mb-4">
                      <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                        <p className="text-gray-300 text-sm line-clamp-2 leading-relaxed">
                          {order.itens?.map((item: any) => `${item.quantity}x ${item.name}`).join(', ')}
                        </p>
                        {order.itens?.length > 2 && (
                           <p className="text-[10px] text-gray-500 mt-1 font-bold">+{order.itens.length - 2} outros itens</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Info */}
                  <div className="bg-[#141414] p-4 border-t border-white/5 pl-6">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-0.5">Total</p>
                        <div className="flex items-center gap-2">
                            <p className="text-white font-black text-lg">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.finalTotal || order.total || 0)}
                            </p>
                            {pontosGanhos > 0 && (
                                <div className="flex items-center gap-1 bg-[#FF8C00]/10 px-2 py-0.5 rounded-md border border-[#FF8C00]/20">
                                    <i className="fa-solid fa-crown text-[#FF8C00] text-[9px]"></i>
                                    <span className="text-[9px] font-bold text-[#FF8C00]">+{pontosGanhos}</span>
                                </div>
                            )}
                        </div>
                      </div>

                      {/* Action Buttons based on Status */}
                      <div className="flex gap-2">
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
                            className="px-4 py-2 bg-white text-black rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-colors flex items-center gap-2"
                          >
                            <i className="fa-solid fa-map-location-dot"></i> Rastrear
                          </button>
                        )}
                        
                        {order.status === 'concluido' && !order.avaliado && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); navigate(`/order/${order.id}`); }}
                            className="px-4 py-2 bg-[#FF8C00]/10 text-[#FF8C00] border border-[#FF8C00]/30 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#FF8C00] hover:text-white transition-all"
                          >
                            Avaliar
                          </button>
                        )}

                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:bg-[#FF8C00] group-hover:text-white transition-all shadow-lg">
                          <i className="fa-solid fa-chevron-right text-xs"></i>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Orders;