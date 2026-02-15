import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, doc, getDoc, updateDoc, addDoc, collection, runTransaction, onSnapshot, serverTimestamp, query, orderBy } from '../firebase';
import toast from 'react-hot-toast';
import { paymentService } from '../services/paymentService';
import { ENV } from '../config/env';
import { useCart } from '../context/CartContext';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';

const OrderDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState('');
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingStore, setRatingStore] = useState(5);
  const [ratingCourier, setRatingCourier] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [messages, setMessages] = useState<{ id: string; sender: string; text: string; createdAt: any }[]>([]);
  const ADMIN_PHONE = '5521971977574';
  const { addToCart, clearCart } = useCart();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Função para verificar se pedido está atrasado
  const isDelayed = () => {
    if (!order || !order.createdAt) return false;
    const now = new Date();
    const orderTime = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
    const diffMinutes = Math.floor((now.getTime() - orderTime.getTime()) / (1000 * 60));
    
    // Considera atrasado se passou mais de 45 minutos e não está concluído
    return diffMinutes > 45 && order.status !== 'concluido' && order.status !== 'cancelado';
  };

  // Ícone personalizado para o mapa
  const customIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

  // Mensagens rápidas pré-definidas (cliente -> lojista/entregador)
  const quickMessagesClient = [
    'O pedido saiu para entrega?',
    'Estou no portão.',
    'Qual o tempo estimado?',
    'Já está pronto para retirada?',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!id) return;
    
    console.log("[OrderDetails] Buscando pedido ID:", id);
    
    const unsubscribe = onSnapshot(doc(db, 'pedidos', id), (docSnap) => {
      if (docSnap.exists()) {
        const orderData = { id: docSnap.id, ...docSnap.data() } as any;
        console.log("[OrderDetails] Pedido encontrado:", orderData);
        console.log("[OrderDetails] Tem deliveryCode?", !!orderData.deliveryCode);
        console.log("[OrderDetails] Tem location?", !!orderData.location);
        console.log("[OrderDetails] Tem endereco?", !!orderData.endereco);
        console.log("[OrderDetails] Status:", orderData.status);
        setOrder(orderData);
      } else {
        console.error("[OrderDetails] Pedido não encontrado:", id);
        toast.error("Pedido não encontrado.");
      }
      setLoading(false);
    }, (error) => {
      console.error("[OrderDetails] Erro ao buscar pedido:", error);
      console.error("[OrderDetails] Código:", error.code);
      console.error("[OrderDetails] Mensagem:", error.message);
      setLoading(false);
      toast.error(`Erro ao carregar pedido: ${error.message}`);
    });
    
    return () => unsubscribe();
  }, [id]);

  // Chat de status: mensagens em tempo real (subcoleção pedidos/{id}/messages)
  useEffect(() => {
    if (!id || !db) return;
    const q = query(collection(db, 'pedidos', id, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });
    return () => unsub();
  }, [id]);

  const sendQuickMessage = async (text: string) => {
    if (!id || !order?.clienteUid) return;
    try {
      await addDoc(collection(db, 'pedidos', id, 'messages'), {
        sender: 'cliente',
        text,
        createdAt: serverTimestamp(),
      });
      toast.success('Mensagem enviada.');
    } catch {
      toast.error('Erro ao enviar mensagem.');
    }
  };

  const handleCancelOrder = async () => {
    if (!window.confirm("Tem certeza que deseja cancelar este pedido? O valor será estornado se o pagamento já foi processado.")) return;
    if (!order) return;

    try {
      if (order.paymentMethod === 'pix' && order.asaasPaymentId) {
        const { success, error } = await paymentService.refund(order.asaasPaymentId, "Cancelado pelo cliente");
        if (!success && error) {
          toast.error(error || 'Falha ao estornar PIX.');
          return;
        }
        toast.success("Pagamento PIX estornado com sucesso!");
      }

      await updateDoc(doc(db, 'pedidos', id!), {
        status: 'cancelado',
        canceladoEm: new Date().toISOString(),
        canceladoPor: 'cliente'
      });
      toast.success("Pedido cancelado.");
      setOrder({ ...order, status: 'cancelado' });
    } catch (e) {
      toast.error("Erro ao cancelar o pedido.");
    }
  };

  const handleHideOrder = async () => {
    if (!window.confirm("Apagar este pedido do seu histórico? Esta ação não pode ser desfeita.")) return;
    try {
      await updateDoc(doc(db, 'pedidos', id!), {
        hiddenForClient: true,
      });
      toast.success("Pedido removido do seu histórico.");
      navigate('/orders'); // Navega de volta para a lista de pedidos
    } catch (e) {
      toast.error("Erro ao remover o pedido.");
    }
  };

  const handleEditOrder = async () => {
    if (!window.confirm("Para editar, vamos cancelar este pedido e colocar os itens de volta na sua sacola. Deseja continuar?")) return;
    
    setLoading(true);
    try {
      // 1. Estorno (se necessário)
      if (order.paymentMethod === 'pix' && order.asaasPaymentId) {
        await paymentService.refund(order.asaasPaymentId, "Cancelado para edição");
      }

      // 2. Cancela o pedido atual
      await updateDoc(doc(db, 'pedidos', id!), {
        status: 'cancelado',
        canceladoEm: new Date().toISOString(),
        canceladoPor: 'cliente (edição)'
      });

      // 3. Restaura o carrinho
      clearCart();
      order.itens.forEach((item: any) => {
        // Adiciona cada item de volta ao carrinho
        // Nota: O loop garante que a quantidade seja respeitada se o addToCart somar +1 por chamada
        for (let i = 0; i < item.quantity; i++) {
           addToCart(item, order.lojaId, order.lojaNome);
        }
      });

      toast.success("Itens na sacola! Faça suas alterações.");
      navigate('/cart');
    } catch (e) {
      toast.error("Erro ao editar pedido.");
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#FF8C00] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!order) return <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center text-white">Pedido não encontrado.</div>;

  const confirmReceipt = async () => {
    if (!window.confirm("Confirmar que recebeu o pedido? Isso liberará o pagamento ao vendedor.")) return;
    
    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'pedidos', id!);
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists()) throw "Pedido não existe!";

        const orderData = orderDoc.data();
        // Se já estiver concluído, não faz nada
        if (orderData.status === 'concluido') return;

        // Atualiza o pedido
        transaction.update(orderRef, { 
          status: 'concluido',
          saldoRetido: false,
          confirmadoPeloCliente: true,
          concluidoEm: new Date().toISOString()
        });

        // Aqui você também poderia atualizar o saldo do vendedor se estivesse controlando saldo no documento do usuário
        // Mas como estamos usando o cálculo dinâmico no Dashboard (baseado em pedidos concluídos), 
        // apenas mudar o status para 'concluido' já libera o saldo visualmente lá.
      });

      toast.success("Pedido confirmado! Obrigado.");
      setOrder({ ...order, status: 'concluido' });
    } catch (e) { toast.error("Erro ao confirmar recebimento."); }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText.trim()) return;

    try {
      await updateDoc(doc(db, 'pedidos', id!), { status: 'em_disputa' });
      
      const message = `*RECLAMAÇÃO - PEDIDO #${id?.slice(-4)}*\n\n` +
                      `Cliente: ${order.clienteNome}\n` +
                      `Loja: ${order.lojaNome}\n` +
                      `Entregador: ${order.entregadorNome || 'N/A'}\n\n` +
                      `*Relato:* ${reportText}`;
      
      const whatsappLink = `https://wa.me/${ADMIN_PHONE}?text=${encodeURIComponent(message)}`;
      window.open(whatsappLink, '_blank');
      
      toast.success("Reclamação enviada ao suporte!");
      setOrder({ ...order, status: 'em_disputa' });
      setShowReportModal(false);
    } catch (e) { toast.error("Erro ao enviar reclamação."); }
  };

  const handleRateOrder = async () => {
    if (!order.id) return;
    try {
      // 1. Salva a avaliação na coleção 'avaliacoes'
      await addDoc(collection(db, 'avaliacoes'), {
        pedidoId: order.id,
        clienteId: order.clienteUid,
        lojaId: order.lojaId,
        entregadorId: order.entregadorUid || null,
        notaLoja: ratingStore,
        notaEntregador: ratingCourier,
        comentario: ratingComment,
        data: new Date().toISOString()
      });

      // 2. Atualiza o pedido para não pedir avaliação novamente
      await updateDoc(doc(db, 'pedidos', order.id), { avaliado: true });

      // 3. Atualiza Média da Loja (Cálculo Incremental)
      const lojaRef = doc(db, 'users', order.lojaId);
      const lojaDoc = await getDoc(lojaRef);
      if (lojaDoc.exists()) {
        const lojaData = lojaDoc.data();
        const currentRating = lojaData.rating || 5;
        const ratingCount = lojaData.ratingCount || 0;
        const newCount = ratingCount + 1;
        const newRating = ((currentRating * ratingCount) + ratingStore) / newCount;
        
        await updateDoc(lojaRef, { rating: newRating, ratingCount: newCount });
      }

      toast.success("Avaliação enviada! Obrigado.");
      setOrder({ ...order, avaliado: true });
      setShowRatingModal(false);
    } catch (e) {
      toast.error("Erro ao enviar avaliação.");
    }
  };

  const handleCopyToSupport = () => {
    if (!order) return;
    const text = `*AJUDA PEDIDO #${order.id.slice(-4)}*\nCliente: ${order.clienteNome}\nLoja: ${order.lojaNome}\nItens: ${order.itens.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}\nTotal: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.finalTotal || order.total)}`;
    navigator.clipboard.writeText(text);
    toast.success("Resumo copiado! Cole no WhatsApp do suporte.");
  };

  // Componente de Timeline
  const StatusTimeline = () => {
    const steps = [
      { id: 'pendente', label: 'Recebido', icon: 'fa-clipboard-check' },
      { id: 'preparando', label: 'Preparando', icon: 'fa-fire-burner' },
      { id: 'entrega', label: order.deliveryMode === 'pickup' ? 'Pronto' : 'A Caminho', icon: order.deliveryMode === 'pickup' ? 'fa-bag-shopping' : 'fa-motorcycle' },
      { id: 'concluido', label: 'Entregue', icon: 'fa-check-double' }
    ];

    const currentStepIndex = steps.findIndex(s => s.id === order.status);
    // Mapeamento para status que não estão na timeline linear
    const activeIndex = currentStepIndex === -1 
      ? (order.status === 'pronto_retirada' ? 2 : (order.status === 'cancelado' ? -1 : 0))
      : currentStepIndex;

    if (order.status === 'cancelado') {
      return (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-center mb-6">
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <i className="fa-solid fa-xmark text-red-500 text-xl"></i>
          </div>
          <h3 className="text-red-500 font-black uppercase tracking-widest">Pedido Cancelado</h3>
          <p className="text-red-300 text-xs mt-1">{order.motivoCancelamento || "Cancelado pelo estabelecimento ou cliente."}</p>
        </div>
      );
    }

    return (
      <div className="w-full mb-8 px-2">
        <div className="flex justify-between relative">
          {/* Linha de fundo */}
          <div className="absolute top-1/2 left-0 w-full h-1 bg-white/10 -translate-y-1/2 z-0 rounded-full"></div>
          {/* Linha de progresso */}
          <div 
            className="absolute top-1/2 left-0 h-1 bg-[#FF8C00] -translate-y-1/2 z-0 rounded-full transition-all duration-1000"
            style={{ width: `${(activeIndex / (steps.length - 1)) * 100}%` }}
          ></div>

          {steps.map((step, index) => {
            const isActive = index <= activeIndex;
            const isCurrent = index === activeIndex;
            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${isActive ? 'bg-[#FF8C00] text-white shadow-[0_0_15px_rgba(255,140,0,0.5)]' : 'bg-[#1E1E1E] border-2 border-white/10 text-gray-500'}`}>
                  <i className={`fa-solid ${step.icon} text-[10px]`}></i>
                </div>
                <span className={`text-[9px] font-bold uppercase mt-2 transition-colors ${isActive ? 'text-white' : 'text-gray-600'} ${isCurrent ? 'animate-pulse' : ''}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] pb-32">
      {/* Header Fixo */}
      <header className="flex items-center mb-8 print:hidden">
      <div className="bg-[#141414]/80 backdrop-blur-xl sticky top-0 z-40 border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <h1 className="text-lg font-black text-white">Pedido #{order.id.slice(-4)}</h1>
        <button onClick={handleCopyToSupport} className="w-10 h-10 rounded-full bg-[#FF8C00]/10 text-[#FF8C00] flex items-center justify-center hover:bg-[#FF8C00]/20 transition-colors">
          <i className="fa-solid fa-headset"></i>
        </button>
      </div>
      </header>

      <div className="p-6 max-w-3xl mx-auto space-y-6">
      {isDelayed() && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 p-4 rounded-[32px] flex items-center gap-4 animate-pulse">
          <i className="fa-solid fa-hourglass-half text-red-500 text-2xl ml-2"></i>
          <div>
            <h3 className="text-red-500 font-black text-sm uppercase tracking-widest">Pedido Atrasado</h3>
            <p className="text-red-200 text-xs">Pedimos desculpas pela demora. Estamos priorizando seu pedido!</p>
          </div>
        </div>
      )}

      {/* Status Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#1E1E1E] rounded-[32px] p-0 border border-white/5 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-[#252525] to-[#1E1E1E] p-6 border-b border-white/5">
            <div className="flex justify-between items-start mb-6">
            <div>
                <h2 className="text-2xl font-black text-white leading-tight mb-1">{order.lojaNome}</h2>
                <div className="flex items-center gap-2 text-[#6B7280] text-xs font-medium">
                    <i className="fa-regular fa-calendar"></i>
                    {order.createdAt?.toDate ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(order.createdAt.toDate()) : 'Data indisponível'}
                </div>
            </div>
            <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${order.status === 'concluido' ? 'bg-green-500/10 text-green-500 border-green-500/20' : order.status === 'cancelado' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-[#FF8C00]/10 text-[#FF8C00] border-[#FF8C00]/20'}`}>
                {order.status === 'pronto_retirada' ? 'Pronto p/ Retirada' : order.status}
            </span>
            </div>
            
            <StatusTimeline />
        </div>
        
        <div className="p-6">
            {/* CÓDIGO DE ENTREGA - DIAGNÓSTICO */}
            {order.status !== 'concluido' && order.status !== 'cancelado' && order.status !== 'em_disputa' && (
            <div className="bg-gradient-to-r from-[#FF8C00] to-[#FF4500] p-6 rounded-2xl mb-6 text-center shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-white/10 backdrop-blur-xl"></div>
                <div className="relative z-10">
                <p className="text-white/80 text-[10px] font-black uppercase tracking-[0.3em] mb-2">
                    {order.deliveryCode ? 'Código de Segurança' : 'Aguardando código...'}
                </p>
                {order.deliveryCode ? (
                    <>
                    <div className="bg-white text-black text-4xl font-black tracking-[0.3em] py-3 rounded-xl mb-2 select-all shadow-lg">
                        {order.deliveryCode}
                    </div>
                    <p className="text-white text-xs font-bold flex items-center justify-center gap-2">
                        <i className="fa-solid fa-lock"></i> Informe ao entregador para receber
                    </p>
                    </>
                ) : (
                    <div className="bg-white/20 text-white text-2xl font-black py-4 rounded-xl mb-2">
                    <i className="fa-solid fa-hourglass-half animate-pulse"></i>
                    </div>
                )}
                </div>
            </div>
            )}

            {/* Chat de status: mensagens rápidas */}
            {order.status !== 'cancelado' && order.status !== 'concluido' && (
            <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center">
                <i className="fa-solid fa-comments mr-2 text-[#FF8C00]"></i> Chat Rápido
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                {quickMessagesClient.map((msg) => (
                    <button key={msg} onClick={() => sendQuickMessage(msg)} className="px-3 py-2 rounded-xl bg-white/5 hover:bg-[#FF8C00]/20 text-gray-300 hover:text-white text-[10px] font-bold border border-white/5 hover:border-[#FF8C00]/30 transition-all active:scale-95">
                    {msg}
                    </button>
                ))}
                </div>

                {messages.length > 0 && (
                <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar p-2 bg-black/20 rounded-xl">
                    {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender === 'cliente' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl text-xs ${m.sender === 'cliente' ? 'bg-[#FF8C00]/20 text-white rounded-tr-none' : 'bg-white/10 text-gray-300 rounded-tl-none'}`}>
                        <p>{m.text}</p>
                        <span className="text-[9px] opacity-50 block text-right mt-1">
                            {m.createdAt?.toDate ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(m.createdAt.toDate()) : ''}
                        </span>
                        </div>
                    </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                )}
            </div>
            )}
        </div>
      </motion.div>

      {/* Detalhes da Entrega e Itens */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#1E1E1E] rounded-[32px] p-6 border border-white/5 shadow-xl">
        
        {/* Entregador */}
        {order.entregadorNome && (
          <div className="mb-6 p-4 bg-black/20 rounded-2xl border border-white/5 flex items-center gap-4">
            <div className="w-10 h-10 bg-[#FF8C00]/20 rounded-full flex items-center justify-center text-[#FF8C00]">
              <i className="fa-solid fa-motorcycle"></i>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Entregador</p>
              <p className="text-white font-bold">{order.entregadorNome}</p>
            </div>
          </div>
        )}

        {/* Endereço */}
        <div className="mb-6">
          <h3 className="text-white font-black uppercase text-[10px] tracking-[0.2em] mb-3 flex items-center">
            <i className="fa-solid fa-location-dot mr-2 text-[#FF8C00]"></i> Endereço de Entrega
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed bg-black/20 p-4 rounded-2xl border border-white/5">{order.endereco}</p>
        </div>
        
        {/* DIAGNÓSTICO DE LOCALIZAÇÃO */}
        {order.location ? (
          <div className="mt-4 rounded-2xl overflow-hidden border border-white/10 h-48 relative z-0">
            {/* MAPA INTERATIVO */}
            <MapContainer 
              center={[order.location.lat, order.location.lng]} 
              zoom={15} 
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <Marker 
                position={[order.location.lat, order.location.lng]} 
                icon={customIcon}
              >
                <Popup>
                  <div className="text-center text-black">
                    <p className="font-black text-sm">Local de Entrega</p>
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          </div>
        ) : (
          <div className="mt-3 p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
            <p className="text-[10px] text-yellow-400 font-black uppercase mb-1">⚠️ Sem Coordenadas</p>
            <p className="text-xs text-yellow-200">Localização GPS não foi salva no pedido</p>
          </div>
        )}

        {/* Lista de Itens */}
        <div className="mt-8">
          <h3 className="text-white font-black uppercase text-[10px] tracking-[0.2em] mb-6 flex items-center border-b border-white/5 pb-4">
            <i className="fa-solid fa-receipt mr-2 text-[#FF8C00]"></i> Resumo do Pedido
          </h3>
          <div className="space-y-0">
            {order.itens.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between items-start py-4 border-b border-white/5 last:border-0 group hover:bg-white/[0.02] px-2 rounded-lg transition-colors">
                <div className="flex items-start gap-4">
                  <span className="bg-[#252525] text-white w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 border border-white/5">{item.quantity}x</span>
                  <div>
                    <p className="text-white text-sm font-bold">{item.name}</p>
                    {item.addons?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {item.addons.map((a:any, i:number) => (
                                <span key={i} className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">+ {a.name}</span>
                            ))}
                        </div>
                    )}
                    {item.observation && <p className="text-[10px] text-gray-500 italic mt-1">"{item.observation}"</p>}
                  </div>
                </div>
                <span className="text-white font-bold text-sm">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          
          <div className="bg-[#141414] rounded-2xl p-4 mt-6 border border-white/5 space-y-2">
             <div className="flex justify-between items-center text-xs text-gray-400">
                <span>Subtotal</span>
                <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.subtotal || order.total || 0)}</span>
             </div>
             {order.deliveryFee > 0 && (
                <div className="flex justify-between items-center text-xs text-gray-400">
                    <span>Taxa de Entrega</span>
                    <span>+ {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.deliveryFee)}</span>
                </div>
             )}
             {order.discount > 0 && (
                <div className="flex justify-between items-center text-xs text-green-500">
                    <span>Desconto</span>
                    <span>- {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.discount)}</span>
                </div>
             )}
             <div className="flex justify-between items-center pt-3 mt-2 border-t border-white/10">
                <span className="text-white font-black text-sm uppercase tracking-widest">Total</span>
                <span className="text-[#FF8C00] font-black text-2xl">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.finalTotal || order.total || 0)}</span>
             </div>
          </div>
        </div>
      </motion.div>
      </div>

      {/* Barra de Ações Fixa (Mobile Friendly) */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#141414]/95 backdrop-blur-lg border-t border-white/10 p-4 z-50 flex gap-3 safe-area-bottom">
        {order.status === 'pendente' && (
          <>
            <button
              onClick={handleEditOrder}
              className="flex-1 py-4 bg-[#FF8C00] text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg active:scale-95 transition-all"
            >
              Editar Pedido
            </button>
            <button
              onClick={handleCancelOrder}
              className="flex-1 py-4 bg-red-600/10 text-red-500 border border-red-600/20 font-black text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all"
            >
              Cancelar
            </button>
          </>
        )}

        {order.status === 'concluido' && !order.avaliado && (
          <button 
            onClick={() => setShowRatingModal(true)}
            className="w-full py-4 bg-[#FF8C00] text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg active:scale-95 transition-all"
          >
            Avaliar Pedido
          </button>
        )}

        {(order.status === 'entregue' || order.status === 'pronto_retirada' || order.status === 'em_disputa') && (
          <button 
            onClick={confirmReceipt}
            className="w-full py-4 bg-green-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg active:scale-95 transition-all animate-pulse"
          >
            {order.status === 'em_disputa' ? 'Resolver Disputa / Confirmar Recebimento' : 'Confirmar Recebimento'}
          </button>
        )}
        
        {order.status !== 'concluido' && order.status !== 'cancelado' && (
          <button 
            onClick={() => setShowReportModal(true)}
            className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-gray-400 border border-white/10 active:scale-95"
          >
            <i className="fa-solid fa-triangle-exclamation"></i>
          </button>
        )}

        {(order.status === 'concluido' || order.status === 'cancelado') && (
           <button onClick={handleHideOrder}
            className="w-full py-4 bg-white/5 text-gray-400 font-black text-xs uppercase tracking-widest rounded-2xl border border-white/10 active:scale-95"
           >
             Apagar do Histórico
           </button>
        )}
      </div>

      {/* MODAL DE RECLAMAÇÃO */}
      <AnimatePresence>
      {showReportModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-[#1E1E1E] w-full max-w-sm rounded-[32px] p-6 border border-white/10 shadow-2xl">
            <h3 className="text-[#FFFFFF] font-black text-lg mb-4">Relatar Problema</h3>
            <form onSubmit={handleSubmitReport}>
              <textarea 
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="Descreva o que aconteceu..."
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-red-500 min-h-[120px] mb-4 resize-none"
                required
              />
              <div className="flex space-x-3">
                <button type="button" onClick={() => setShowReportModal(false)} className="flex-1 py-3 bg-white/5 text-gray-400 rounded-xl font-bold text-xs active:scale-95">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-xs active:scale-95">Enviar</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* MODAL DE AVALIAÇÃO (ESTRELAS) */}
      <AnimatePresence>
      {showRatingModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-[#1E1E1E] w-full max-w-sm rounded-[32px] p-8 border border-white/10 shadow-2xl text-center">
            <div className="w-20 h-20 bg-[#FF8C00]/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#FF8C00]/20">
              <i className="fa-solid fa-star text-4xl text-[#FF8C00]"></i>
            </div>
            <h3 className="text-[#FFFFFF] font-black text-2xl mb-2">Como foi?</h3>
            <p className="text-[#6B7280] text-xs font-medium mb-8">Sua opinião ajuda a melhorar o EiLanches.</p>

            <div className="space-y-6 mb-8">
              <div>
                <p className="text-[#6B7280] text-[10px] font-black uppercase tracking-widest mb-3">Avalie a Loja</p>
                <div className="flex justify-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setRatingStore(star)} className={`text-3xl transition-all active:scale-90 ${star <= ratingStore ? 'text-[#FF8C00]' : 'text-[#374151]'}`}>
                      <i className="fa-solid fa-star"></i>
                    </button>
                  ))}
                </div>
              </div>

              {order.entregadorId && (
                <div>
                  <p className="text-[#6B7280] text-[10px] font-black uppercase tracking-widest mb-3">Avalie o Entregador</p>
                  <div className="flex justify-center space-x-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} onClick={() => setRatingCourier(star)} className={`text-3xl transition-all active:scale-90 ${star <= ratingCourier ? 'text-[#FF8C00]' : 'text-[#374151]'}`}>
                        <i className="fa-solid fa-star"></i>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <textarea 
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Deixe um comentário (opcional)..."
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-[#FF8C00] min-h-[80px] resize-none"
              />
            </div>

            <button onClick={handleRateOrder} className="w-full py-4 bg-[#FF8C00] text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all">Enviar Avaliação</button>
            <button onClick={() => setShowRatingModal(false)} className="mt-4 text-[#6B7280] text-xs font-bold hover:text-[#FFFFFF] transition-colors duration-500">Pular</button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
};

export default OrderDetails;
