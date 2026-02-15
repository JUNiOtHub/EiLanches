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

  const isDelayed = () => {
    if (!order || !order.createdAt) return false;
    const now = new Date();
    const orderTime = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
    const diffMinutes = Math.floor((now.getTime() - orderTime.getTime()) / (1000 * 60));
    return diffMinutes > 45 && order.status !== 'concluido' && order.status !== 'cancelado';
  };

  const customIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

  const quickMessagesClient = [
    'O pedido saiu para entrega?',
    'Estou no portão.',
    'Qual o tempo estimado?',
    'Já está pronto para retirada?',
  ];

  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, 'pedidos', id), (docSnap) => {
      if (docSnap.exists()) {
        setOrder({ id: docSnap.id, ...docSnap.data() });
      } else {
        toast.error("Pedido não encontrado.");
      }
      setLoading(false);
    }, (error) => {
      setLoading(false);
      toast.error(`Erro ao carregar pedido: ${error.message}`);
    });
    return () => unsubscribe();
  }, [id]);

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
    if (!window.confirm("Tem certeza que deseja cancelar este pedido?")) return;
    if (!order) return;
    try {
      if (order.paymentMethod === 'pix' && order.asaasPaymentId) {
        await paymentService.refund(order.asaasPaymentId, "Cancelado pelo cliente");
      }
      await updateDoc(doc(db, id!), {
        status: 'cancelado',
        canceladoEm: new Date().toISOString(),
        canceladoPor: 'cliente'
      });
      toast.success("Pedido cancelado.");
    } catch (e) {
      toast.error("Erro ao cancelar o pedido.");
    }
  };

  const handleEditOrder = async () => {
    if (!window.confirm("Deseja cancelar e editar?")) return;
    setLoading(true);
    try {
      if (order.paymentMethod === 'pix' && order.asaasPaymentId) {
        await paymentService.refund(order.asaasPaymentId, "Cancelado para edição");
      }
      await updateDoc(doc(db, 'pedidos', id!), {
        status: 'cancelado',
        canceladoEm: new Date().toISOString(),
        canceladoPor: 'cliente (edição)'
      });
      clearCart();
      order.itens.forEach((item: any) => {
        for (let i = 0; i < item.quantity; i++) {
           addToCart(item, order.lojaId, order.lojaNome);
        }
      });
      toast.success("Itens na sacola!");
      navigate('/cart');
    } catch (e) {
      toast.error("Erro ao editar pedido.");
      setLoading(false);
    }
  };

  const confirmReceipt = async () => {
    if (!window.confirm("Confirmar recebimento?")) return;
    try {
      await updateDoc(doc(db, 'pedidos', id!), { 
        status: 'concluido',
        confirmadoPeloCliente: true,
        concluidoEm: new Date().toISOString()
      });
      toast.success("Pedido confirmado!");
    } catch (e) { toast.error("Erro ao confirmar."); }
  };

  const handleCopyToSupport = () => {
    if (!order) return;
    const text = `AJUDA PEDIDO #${order.id.slice(-4)}`;
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendente': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      case 'preparando': return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      case 'entrega': return 'bg-purple-500/20 text-purple-500 border-purple-500/30';
      case 'concluido': return 'bg-green-500/20 text-green-500 border-green-500/30';
      case 'cancelado': return 'bg-red-500/20 text-red-500 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-500 border-gray-500/30';
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center text-white">Carregando...</div>;
  if (!order) return <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center text-white">Não encontrado.</div>;

  const statusStyle = getStatusColor(order.status);

  return (
    <div className="min-h-screen bg-[#0F0F0F] p-4 sm:p-6 pb-24">
      <header className="flex items-center mb-8">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-[#1E1E1E] rounded-full flex items-center justify-center text-white border border-white/5"><i className="fa-solid fa-arrow-left"></i></button>
        <h1 className="text-xl font-black text-white ml-4 flex-1">Detalhes</h1>
        <button onClick={handleCopyToSupport} className="w-10 h-10 bg-[#1E1E1E] rounded-full flex items-center justify-center text-[#FF8C00] border border-white/5"><i className="fa-solid fa-copy"></i></button>
      </header>

      <div className="bg-[#1E1E1E] rounded-[40px] p-6 border border-white/5 shadow-xl mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-black text-white">{order.lojaNome}</h2>
            <p className="text-gray-500 text-xs">{order.createdAt?.toDate ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(order.createdAt.toDate()) : 'Data indisponível'}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusStyle}`}>{order.status}</span>
        </div>

        <div className="space-y-4 mb-6 bg-black/20 p-4 rounded-2xl border border-white/5 font-mono text-sm">
          {order.itens?.map((item: any, idx: number) => (
            <div key={idx} className="flex justify-between items-center text-white">
              <span>{item.quantity}x {item.name}</span>
              <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 pt-4 flex justify-between items-end">
          <span className="text-gray-500 text-xs font-black uppercase">Total</span>
          <span className="text-[#FF8C00] font-black text-2xl">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(order.finalTotal || order.total || 0))}</span>
        </div>
      </div>

      <div className="bg-[#1E1E1E] rounded-[40px] p-6 border border-white/5 shadow-xl">
        <h3 className="text-white font-black uppercase text-[10px] tracking-widest mb-4">Entrega</h3>
        <p className="text-gray-300 text-sm">{order.endereco}</p>
      </div>

      <div className="space-y-3 mt-6">
        {order.status === 'pendente' && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleEditOrder} className="py-4 bg-[#FF8C00] text-white font-black text-xs uppercase rounded-full">Editar</button>
            <button onClick={handleCancelOrder} className="py-4 bg-red-600/10 text-red-500 border border-red-600/20 font-black text-xs uppercase rounded-full">Cancelar</button>
          </div>
        )}
        {order.status === 'entrega' && (
          <button onClick={confirmReceipt} className="w-full py-4 bg-[#FF8C00] text-white font-black text-xs uppercase rounded-full">Recebi o Pedido</button>
        )}
      </div>
    </div>
  );
};

export default OrderDetails;
