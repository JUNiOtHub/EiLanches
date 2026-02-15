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
  const prevStatusRef = useRef<string>('');

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

  const steps = [
    { status: 'pendente', label: 'Recebido', icon: 'fa-clipboard-check' },
    { status: 'preparando', label: 'Preparando', icon: 'fa-fire-burner' },
    { status: 'entrega', label: 'Saiu', icon: 'fa-motorcycle' },
    { status: 'concluido', label: 'Entregue', icon: 'fa-flag-checkered' }
  ];

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

  if (loading) return <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center text-white">Carregando detalhes...</div>;

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

  return (
    <div className="min-h-screen bg-[#0F0F0F] p-4 sm:p-6 pb-24 animate-in slide-in-from-right duration-700">
      <header className="flex items-center mb-8 print:hidden">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-[#1E1E1E]/80 backdrop-blur-xl rounded-[40px] flex items-center justify-center text-[#FFFFFF] border-2 border-white/5 shadow-[0_20px_50px_rgba(255,140,0,0.4)] hover:shadow-[0_20px_60px_rgba(255,140,0,0.3)] active:scale-95 transition-all duration-500"
        >
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <h1 className="text-xl font-black text-[#FFFFFF] ml-4 flex-1">Detalhes do Pedido</h1>
        <button 
          onClick={handleCopyToSupport}
          className="w-10 h-10 bg-[#1E1E1E]/80 backdrop-blur-xl rounded-[40px] flex items-center justify-center text-[#FF8C00] border-2 border-white/5 shadow-[0_20px_50px_rgba(255,140,0,0.4)] hover:shadow-[0_20px_60px_rgba(255,140,0,0.3)] active:scale-95 transition-all duration-500"
        >
          <i className="fa-solid fa-copy"></i>
        </button>
      </header>

      {isDelayed() && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 p-4 rounded-[32px] flex items-center gap-4 animate-pulse">
          <i className="fa-solid fa-hourglass-half text-red-500 text-2xl ml-2"></i>
          <div>
            <h3 className="text-red-500 font-black text-sm uppercase tracking-widest">Pedido Atrasado</h3>
            <p className="text-red-200 text-xs">Pedimos desculpas pela demora. Estamos priorizando seu pedido!</p>
          </div>
        </div>
      )}

      <div className="bg-[#1E1E1E]/80 backdrop-blur-xl rounded-[40px] p-6 border-2 border-white/5 shadow-[0_20px_50px_rgba(255,140,0,0.4)] mb-6 print:bg-white print:text-black print:border-black print:shadow-none animate-in fade-in zoom-in duration-700">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-black text-[#FFFFFF]">{order.lojaNome}</h2>
            <p className="text-[#6B7280] text-xs mt-1">
              {order.createdAt?.toDate ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(order.createdAt.toDate()) : 'Data indisponível'}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-[40px] text-[10px] font-black uppercase tracking-widest ${order.status === 'concluido' ? 'bg-green-500/20 text-green-500' : order.status === 'cancelado' ? 'bg-red-500/20 text-red-500' : 'bg-[#FF8C00]/10 text-[#FF8C00]'}`}>
            {order.status === 'pronto_retirada' ? 'Pronto p/ Retirada' : order.status}
          </span>
        </div>

        {/* Chat de status: mensagens rápidas (cliente -> lojista/entregador) */}
        {order.status !== 'cancelado' && order.status !== 'concluido' && (
          <div className="bg-[#1A1A1A]/80 backdrop-blur-xl rounded-[40px] p-4 border-2 border-white/5 mb-6">
            <p className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest mb-3 flex items-center">
              <i className="fa-solid fa-comments mr-2 text-[#FF8C00]"></i> Mensagens rápidas
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {quickMessagesClient.map((msg) => (
                <button key={msg} onClick={() => sendQuickMessage(msg)} className="px-3 py-2 rounded-[40px] bg-white/5 hover:bg-[#FF8C00]/20 text-[#D1D5DB] hover:text-white text-xs font-bold border-2 border-white/5 hover:border-[#FF8C00]/30 transition-all active:scale-95">
                  {msg}
                </button>
              ))}
            </div>
            {messages.length > 0 && (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {messages.map((m) => (
                  <div key={m.id} className={`text-xs p-2 rounded-[40px] ${m.sender === 'cliente' ? 'bg-[#FF8C00]/10 ml-0 mr-6' : 'bg-white/5 mr-0 ml-6'}`}>
                    <span className="text-[#6B7280] font-black uppercase text-[9px]">{m.sender === 'cliente' ? 'Você' : 'Loja'}</span>
                    <p className="text-[#FFFFFF]">{m.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MOTIVO DO CANCELAMENTO */}
        {order.status === 'cancelado' && order.motivoCancelamento && (
          <div className="bg-red-500/10 p-4 rounded-[40px] my-6 text-center border-2 border-red-500/20">
            <p className="text-red-400 text-[10px] font-black uppercase tracking-widest mb-2">Motivo do Cancelamento</p>
            <p className="text-[#FFFFFF] text-sm">{order.motivoCancelamento}</p>
          </div>
        )}

        {/* CÓDIGO DE ENTREGA - DIAGNÓSTICO */}
        {order.status !== 'concluido' && order.status !== 'cancelado' && order.status !== 'em_disputa' && (
          <div className="bg-gradient-to-r from-[#FF8C00] to-[#FF4500] p-6 rounded-[40px] mb-6 text-center shadow-[0_20px_60px_rgba(255,140,0,0.3)] relative overflow-hidden animate-in fade-in zoom-in duration-700">
            <div className="absolute top-0 left-0 w-full h-full bg-white/10 backdrop-blur-xl"></div>
            <div className="relative z-10">
              <p className="text-white/80 text-[10px] font-black uppercase tracking-[0.3em] mb-2">
                {order.deliveryCode ? 'Código de Segurança' : 'Aguardando código...'}
              </p>
              {order.deliveryCode ? (
                <>
                  <div className="bg-white text-black text-5xl font-black tracking-[0.5em] py-4 rounded-[40px] mb-2 select-all shadow-[0_20px_50px_rgba(255,140,0,0.4)]">
                    {order.deliveryCode}
                  </div>
                  <p className="text-white text-xs font-bold flex items-center justify-center gap-2">
                    <i className="fa-solid fa-lock"></i> Informe ao entregador para receber
                  </p>
                </>
              ) : (
                <div className="bg-white/20 text-white text-2xl font-black py-4 rounded-[40px] mb-2">
                  <i className="fa-solid fa-hourglass-half animate-pulse"></i>
                </div>
              )}
            </div>
          </div>
        )}

        {/* NOME DO ENTREGADOR */}
        {order.entregadorNome && (
          <div className="mb-6 p-3 bg-[#1A1A1A]/80 backdrop-blur-xl rounded-[40px] border-2 border-white/5 flex items-center print:bg-gray-100 print:border-gray-300 hover:border-[#FF8C00]/30 transition-all duration-500">
            <div className="w-8 h-8 bg-[#FF8C00]/20 rounded-[40px] flex items-center justify-center mr-3">
              <i className="fa-solid fa-motorcycle text-[#FF8C00] text-xs"></i>
            </div>
            <div>
              <p className="text-[9px] text-[#6B7280] font-black uppercase tracking-widest">Seu Entregador</p>
              <p className="text-[#FFFFFF] font-bold text-sm print:text-black">{order.entregadorNome}</p>
            </div>
          </div>
        )}

        {/* RESUMO DE ITENS (ESTILO CUPOM) */}
        <div className="space-y-4 mb-6 bg-black/20 p-4 rounded-2xl border border-white/5 font-mono text-sm">
          {order.itens.map((item: any, idx: number) => (
            <div key={idx} className="flex justify-between items-center">
              <div className="flex items-center">
                <span className="text-[#6B7280] mr-3 font-bold">{item.quantity}x</span>
                <span className="text-[#D1D5DB]">{item.name}</span>
              </div>
              <span className="text-[#FFFFFF] font-bold text-sm">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 pt-4 flex justify-between items-end">
          <span className="text-[#6B7280] text-xs font-black uppercase tracking-widest">Total Pago</span>
          <span className="text-[#FF8C00] font-black text-2xl tracking-tighter">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.finalTotal || order.total || 0)}
          </span>
        </div>
      </div>

      <div className="bg-[#1E1E1E]/80 backdrop-blur-xl rounded-[40px] p-6 border-2 border-white/5 shadow-[0_20px_50px_rgba(255,140,0,0.4)] animate-in fade-in zoom-in duration-700">
        <h3 className="text-[#FFFFFF] font-black uppercase text-[10px] tracking-[0.2em] mb-4 flex items-center">
          <i className="fa-solid fa-location-dot mr-2 text-[#6B7280]"></i> Entrega
        </h3>
        <p className="text-[#D1D5DB] text-sm leading-relaxed mb-2">{order.endereco}</p>
        
        {/* DIAGNÓSTICO DE LOCALIZAÇÃO */}
        {order.location ? (
          <div className="mt-3 p-3 bg-black/40 rounded-2xl border border-white/10">
            <p className="text-[10px] text-gray-400 font-black uppercase mb-1">Coordenadas Salvas</p>
            <p className="text-xs text-green-400 font-mono">
              Lat: {order.location.lat?.toFixed(6)} | Lng: {order.location.lng?.toFixed(6)}
            </p>
            
            {/* MAPA INTERATIVO */}
            <div className="mt-3 h-48 rounded-xl overflow-hidden border border-white/10">
              <MapContainer 
                center={[order.location.lat, order.location.lng]} 
                zoom={15} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <Marker 
                  position={[order.location.lat, order.location.lng]} 
                  icon={customIcon}
                >
                  <Popup>
                    <div className="text-center">
                      <p className="font-black text-sm">Local de Entrega</p>
                      <p className="text-xs text-gray-600">{order.endereco}</p>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        ) : (
          <div className="mt-3 p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
            <p className="text-[10px] text-yellow-400 font-black uppercase mb-1">⚠️ Sem Coordenadas</p>
            <p className="text-xs text-yellow-200">Localização GPS não foi salva no pedido</p>
          </div>
        )}
      </div>

      <div className="print:hidden space-y-3 mt-6">
        {order.status === 'pendente' && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleEditOrder}
              className="py-4 bg-gradient-to-r from-[#FF8C00] to-[#FF4500] text-white font-black text-xs uppercase tracking-widest rounded-[40px] shadow-[0_20px_60px_rgba(255,140,0,0.3)] hover:shadow-[0_20px_60px_rgba(255,140,0,0.4)] active:scale-95 transition-all duration-500 border-2 border-white/5"
            >
              Editar Pedido
            </button>
            <button
              onClick={handleCancelOrder}
              className="py-4 bg-red-600/10 text-red-500 border-2 border-red-600/20 font-black text-xs uppercase tracking-widest rounded-[40px] active:scale-95 transition-all duration-500 hover:bg-red-600 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        )}

        {order.status === 'concluido' && !order.avaliado && (
          <button 
            onClick={() => setShowRatingModal(true)}
            className="w-full py-4 bg-gradient-to-r from-[#FF8C00] to-[#FF4500] text-white font-black text-xs uppercase tracking-widest rounded-[40px] shadow-[0_20px_60px_rgba(255,140,0,0.3)] hover:shadow-[0_20px_60px_rgba(255,140,0,0.4)] active:scale-95 transition-all duration-500 border-2 border-white/5 animate-bounce-short"
          >
            Avaliar Pedido
          </button>
        )}
        {(order.status === 'entregue' || order.status === 'pronto_retirada' || order.status === 'em_disputa') && (
          <button 
            onClick={confirmReceipt}
            className="w-full py-4 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white font-bold text-xs uppercase tracking-widest rounded-[40px] shadow-[0_20px_60px_rgba(34,197,94,0.3)] hover:shadow-[0_20px_60px_rgba(34,197,94,0.4)] active:scale-95 transition-all duration-500 border-2 border-white/5 animate-pulse"
          >
            {order.status === 'em_disputa' ? 'Resolver Disputa / Confirmar Recebimento' : 'Confirmar Recebimento'}
          </button>
        )}
        
        {order.status !== 'concluido' && order.status !== 'cancelado' && (
          <button 
            onClick={() => setShowReportModal(true)}
            className="w-full py-3 text-[#6B7280] font-bold text-[10px] uppercase tracking-widest hover:bg-white/5 hover:text-white rounded-[40px] transition-all duration-500 border-2 border-white/5 flex items-center justify-center gap-2"
          >
            <i className="fa-brands fa-whatsapp"></i> Problemas com este pedido?
          </button>
        )}

        {(order.status === 'concluido' || order.status === 'cancelado') && (
           <button onClick={handleHideOrder}
            className="w-full py-3 text-[#6B7280] font-bold text-[10px] uppercase tracking-widest hover:bg-white/5 hover:text-[#FFFFFF] rounded-[40px] transition-all duration-500 border-2 border-white/5"
           >
             Apagar do Histórico
           </button>
        )}
      </div>

      {/* MODAL DE RECLAMAÇÃO */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="bg-[#1E1E1E]/80 backdrop-blur-xl w-full max-w-sm rounded-[40px] p-6 border-2 border-white/5 shadow-[0_20px_50px_rgba(255,140,0,0.4)]">
            <h3 className="text-[#FFFFFF] font-black text-lg mb-4">Relatar Problema</h3>
            <form onSubmit={handleSubmitReport}>
              <textarea 
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="Descreva o que aconteceu..."
                className="w-full bg-black/40 border-2 border-white/5 rounded-[40px] p-4 text-white text-sm outline-none focus:border-red-500 min-h-[120px] mb-4 resize-none"
                required
              />
              <div className="flex space-x-3">
                <button type="button" onClick={() => setShowReportModal(false)} className="flex-1 py-3 bg-white/5 text-[#6B7280] rounded-[40px] font-bold text-xs active:scale-95 transition-all duration-500 border-2 border-white/5">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-[40px] font-bold text-xs shadow-[0_20px_60px_rgba(239,68,68,0.3)] hover:shadow-[0_20px_60px_rgba(239,68,68,0.4)] active:scale-95 transition-all duration-500 border-2 border-white/5">Enviar ao Suporte</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE AVALIAÇÃO (ESTRELAS) */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-[#1E1E1E]/80 backdrop-blur-xl w-full max-w-sm rounded-[40px] p-8 border-2 border-white/5 shadow-[0_20px_50px_rgba(255,140,0,0.4)] text-center">
            <div className="w-20 h-20 bg-[#FF8C00]/10 rounded-[40px] flex items-center justify-center mx-auto mb-6 border-2 border-[#FF8C00]/20">
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
                className="w-full bg-black/40 border-2 border-white/5 rounded-[40px] p-4 text-white text-sm outline-none focus:border-[#FF8C00] min-h-[80px] resize-none"
              />
            </div>

            <button onClick={handleRateOrder} className="w-full py-4 bg-gradient-to-r from-[#FF8C00] to-[#FF4500] text-white rounded-[40px] font-black uppercase text-xs tracking-widest shadow-[0_20px_60px_rgba(255,140,0,0.3)] hover:shadow-[0_20px_60px_rgba(255,140,0,0.4)] active:scale-95 transition-all duration-500 border-2 border-white/5">Enviar Avaliação</button>
            <button onClick={() => setShowRatingModal(false)} className="mt-4 text-[#6B7280] text-xs font-bold hover:text-[#FFFFFF] transition-colors duration-500">Pular</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetails;
