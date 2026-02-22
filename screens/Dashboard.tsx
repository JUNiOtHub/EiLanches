import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Cropper from 'react-easy-crop';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { motion, AnimatePresence } from 'framer-motion';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, collection, onSnapshot, query, where, orderBy, updateDoc, doc, firebaseConfig, addDoc, deleteDoc, getDocs, writeBatch, serverTimestamp, getDoc } from '../firebase';
import { useAuth } from '../context/AuthContext';
// import { asaasService } from '@/services/asaas'; // Removido - migramos para Mercado Pago
import ConfirmationModal from '../components/ConfirmationModal';
// import SellerOrderModal from '../components/dashboard/SellerOrderModal'; // Temporariamente desativado
import { ENV } from '../config/env';
import { getStatusConfig } from '../utils/statusConfig';

// Chave de API do Unsplash (Fallback garantido)
const UNSPLASH_ACCESS_KEY = ENV.UNSPLASH.accessKey;

// --- ÍCONES PRONTOS (GALERIA) ---
const GALLERY_ICONS = [
  { id: 'burger', url: 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png', label: 'Burger' },
  { id: 'pizza', url: 'https://cdn-icons-png.flaticon.com/512/1404/1404945.png', label: 'Pizza' },
  { id: 'drink', url: 'https://cdn-icons-png.flaticon.com/512/2405/2405597.png', label: 'Bebida' },
  { id: 'dessert', url: 'https://cdn-icons-png.flaticon.com/512/3081/3081967.png', label: 'Doce' },
  { id: 'hotdog', url: 'https://cdn-icons-png.flaticon.com/512/2252/2252075.png', label: 'Hot Dog' },
  { id: 'fries', url: 'https://cdn-icons-png.flaticon.com/512/1046/1046784.png', label: 'Fritas' },
  { id: 'sushi', url: 'https://cdn-icons-png.flaticon.com/512/2252/2252054.png', label: 'Sushi' },
  { id: 'acai', url: 'https://cdn-icons-png.flaticon.com/512/5029/5029236.png', label: 'Açaí' },
  { id: 'combo', url: 'https://cdn-icons-png.flaticon.com/512/1357/1357257.png', label: 'Combo' },
  { id: 'pastel', url: 'https://cdn-icons-png.flaticon.com/512/3348/3348078.png', label: 'Pastel' }
];

// --- COMPONENTES MENORES (Refatoração) ---

const DailyMetrics: React.FC<{ metrics: any; onExport: (format: 'json' | 'csv') => void }> = ({ metrics, onExport }) => (
  <div className="space-y-4">
    <div className="bg-[#1E1E1E] p-4 sm:p-6 rounded-[32px] border border-white/5 shadow-xl">
      <div className="flex items-center space-x-4 mb-6">
        <div className="w-12 h-12 bg-[#FF8C00]/10 rounded-2xl flex items-center justify-center">
          <i className="fa-solid fa-sack-dollar text-[#FF8C00] text-xl"></i>
        </div>
        <div>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Faturamento Hoje</p>
          <h3 className="text-3xl font-black text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.faturamentoLiquidoHoje)}</h3>
          <p className="text-xs text-gray-500">Bruto: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.faturamentoBrutoHoje)}</p>
        </div>
      </div>
      <div className="h-[1px] bg-white/5 w-full mb-6"></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Pedidos</p>
          <p className="text-xl font-black text-white">{metrics.totalPedidos}</p>
        </div>
        <div>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Ticket Médio</p>
          <p className="text-lg font-black text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.ticketMedio)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Upsell</p>
          <p className="text-lg font-black text-[#FF8C00]">{metrics.taxaConversaoUpsell ?? 0}%</p>
          <p className="text-[9px] text-gray-500">{metrics.pedidosComUpsell ?? 0} aceitaram</p>
        </div>
        <div>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Tempo Preparo</p>
          <p className="text-lg font-black text-white">{Math.round(metrics.tempoMedioPreparoMin ?? 0)} min</p>
        </div>
      </div>
    </div>
    <div className="flex gap-2">
      <button onClick={() => onExport('json')} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95 flex items-center justify-center gap-2">
        <i className="fa-solid fa-file-code"></i> Exportar JSON
      </button>
      <button onClick={() => onExport('csv')} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95 flex items-center justify-center gap-2">
        <i className="fa-solid fa-file-csv"></i> Exportar CSV
      </button>
    </div>
  </div>
);

// --- COMPONENTES NOVOS (SÓCIO) ---

const PushNotification = ({ show, onClose, title, message, time }: any) => {
  if (!show) return null;
  
  return (
    <div className="fixed top-6 right-6 z-[9999] animate-in slide-in-from-right duration-500 fade-in">
      <div className="bg-[#1E1E1E]/95 backdrop-blur-xl border-l-4 border-[#FF8C00] rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] p-4 w-80 flex items-start gap-4 relative overflow-hidden group cursor-pointer hover:scale-105 transition-transform" onClick={onClose}>
        <div className="absolute inset-0 bg-gradient-to-r from-[#FF8C00]/10 to-transparent opacity-50" />
        
        <div className="w-12 h-12 bg-[#FF8C00] rounded-full flex items-center justify-center shrink-0 z-10 shadow-lg shadow-[#FF8C00]/30 animate-bounce-short">
           <i className="fa-solid fa-bell text-white text-lg"></i>
        </div>
        
        <div className="flex-1 z-10">
           <div className="flex justify-between items-start">
             <h4 className="text-white font-black text-sm uppercase tracking-wide">{title}</h4>
             <span className="text-gray-500 text-[9px] font-bold">{time}</span>
           </div>
           <p className="text-gray-300 text-xs mt-1 font-medium leading-relaxed">{message}</p>
        </div>
        
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }} 
          className="absolute top-2 right-2 text-gray-600 hover:text-white transition-colors z-20"
        >
           <i className="fa-solid fa-xmark text-xs"></i>
        </button>
      </div>
    </div>
  );
};

const StorePreview = ({ profile, storeSettings, isKitchenBusy }: { profile: any, storeSettings: any, isKitchenBusy: boolean }) => (
  <div className="mt-6 p-4 border border-[#FF8C00]/30 rounded-[32px] bg-black/40 relative overflow-hidden group">
    <div className="absolute top-0 right-0 bg-[#FF8C00] text-black text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest z-10">
      Preview do Cliente
    </div>
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 rounded-full border-2 border-[#FF8C00] p-1 relative">
        <img 
          src={profile.image || "https://cdn-icons-png.flaticon.com/512/3075/3075977.png"} 
          alt="Logo" 
          className="w-full h-full object-cover rounded-full" 
        />
        <div className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-[#1E1E1E] ${storeSettings?.isOpen ? 'bg-green-500' : 'bg-red-500'}`}></div>
      </div>
      <div>
        <h4 className="text-white font-black text-lg leading-tight">{profile.nomeLoja || 'Nome da Sua Loja'}</h4>
        <p className="text-gray-400 text-xs line-clamp-1 mt-1">{profile.description || 'Descrição da loja...'}</p>
        <div className="flex items-center gap-2 mt-2">
           <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${storeSettings?.isOpen ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
             {storeSettings?.isOpen ? 'Aberto Agora' : 'Fechado'}
           </span>
           <span className="text-[9px] font-bold text-[#FF8C00] bg-[#FF8C00]/10 px-2 py-0.5 rounded">
             <i className="fa-solid fa-star mr-1"></i> 5.0
           </span>
           {isKitchenBusy && (
             <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-red-500/20 text-red-500 animate-pulse flex items-center">
               <i className="fa-solid fa-fire mr-1"></i> Alta Demanda
             </span>
           )}
        </div>
      </div>
    </div>
  </div>
);

const BusinessHours = ({ hours, setHours }: any) => {
  const days = [
    { key: 'seg', label: 'Segunda' },
    { key: 'ter', label: 'Terça' },
    { key: 'qua', label: 'Quarta' },
    { key: 'qui', label: 'Quinta' },
    { key: 'sex', label: 'Sexta' },
    { key: 'sab', label: 'Sábado' },
    { key: 'dom', label: 'Domingo' },
  ];

  const handleChange = (day: string, field: string, value: any) => {
    setHours((prev: any) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  return (
    <div className="bg-[#1E1E1E] p-6 rounded-[32px] border border-white/5 mt-6">
      <h3 className="text-white font-black uppercase text-[10px] tracking-[0.2em] mb-6 flex items-center">
        <i className="fa-solid fa-clock mr-2 text-[#FF8C00]"></i> Horário de Funcionamento
      </h3>
      <div className="space-y-3">
        {days.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between bg-black/20 p-3 rounded-2xl border border-white/5">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={hours[key]?.active}
                  onChange={(e) => handleChange(key, 'active', e.target.checked)}
                />
                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FF8C00]"></div>
              </label>
              <span className={`text-xs font-bold uppercase w-16 ${hours[key]?.active ? 'text-white' : 'text-gray-600'}`}>{label}</span>
            </div>
            
            {hours[key]?.active ? (
              <div className="flex items-center gap-2">
                <input 
                  type="time" 
                  value={hours[key]?.open}
                  onChange={(e) => handleChange(key, 'open', e.target.value)}
                  className="bg-[#1E1E1E] text-white text-xs font-bold p-2 rounded-lg border border-white/10 outline-none focus:border-[#FF8C00]" 
                />
                <span className="text-gray-500 text-[10px]">às</span>
                <input 
                  type="time" 
                  value={hours[key]?.close}
                  onChange={(e) => handleChange(key, 'close', e.target.value)}
                  className="bg-[#1E1E1E] text-white text-xs font-bold p-2 rounded-lg border border-white/10 outline-none focus:border-[#FF8C00]" 
                />
              </div>
            ) : (
              <span className="text-gray-600 text-[10px] font-black uppercase tracking-widest pr-4">Fechado</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const ProductionQueue: React.FC<{ 
  orders: any[]; 
  onUpdateStatus: (id: string, status: string) => void;
  onNotifyDriver: (id: string) => void;
  onNotifyPickup: (id: string) => void;
  profile: any;
  onSelectOrder: (order: any) => void; // Para abrir o modal de detalhes
  selectedOrderId?: string; // Para destacar o pedido selecionado
  onDeleteOrder: (orderId: string) => void; // Para deletar pedidos
}> = ({ orders, onUpdateStatus, onNotifyDriver, onNotifyPickup, profile, onSelectOrder, selectedOrderId, onDeleteOrder }) => {
  const [filter, setFilter] = useState('todos');
  
  const getTimeAgo = (date: any) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    const diffMinutes = (new Date().getTime() - d.getTime()) / 1000 / 60;
    if (diffMinutes < 1) return 'Agora';
    return `${Math.floor(diffMinutes)} min atrás`;
  };

  const filteredOrders = orders.filter(o => {
    if (filter === 'todos') return true;
    if (filter === 'pendente') return o.status === 'pendente';
    if (filter === 'preparando') return o.status === 'preparando';
    if (filter === 'prontos') return ['entrega', 'pronto_retirada'].includes(o.status);
    return true;
  });

  const handleCopyTicket = (order: any) => {
     const text = `*PEDIDO #${order.id.slice(-4)}*\nCliente: ${order.clienteNome}\nItens: ${order.itens.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}\nTotal: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.finalTotal || order.total)}`;
     navigator.clipboard.writeText(text);
     toast.success("Ticket copiado!");
  };

  const handleOpenMaps = (order: any) => {
    if (order.location?.lat && order.location?.lng) {
      window.open(`https://www.google.com/maps?q=${order.location.lat},${order.location.lng}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.endereco)}`, '_blank');
    }
  };

  const handleWhatsApp = (order: any) => {
    const phone = order.clienteTelefone?.replace(/\D/g, '');
    if (phone) {
      window.open(`https://wa.me/55${phone}`, '_blank');
    } else {
      toast.error("Telefone do cliente não disponível");
    }
  };

  const getStatusConfigAdmin = (status: string, isDelayed: boolean) => {
    if (isDelayed) return { icon: '🔥', color: 'text-red-500', border: 'border-red-600', bg: 'bg-red-600/10', label: 'URGENTE: ATRASADO', pulse: true };
    
    switch(status) {
      case 'pendente': return { icon: '🔔', color: 'text-yellow-400', border: 'border-yellow-400', bg: 'bg-yellow-400/5', label: 'Novo Pedido', pulse: true };
      case 'preparando': return { icon: '🍳', color: 'text-blue-400', border: 'border-blue-500', bg: 'bg-blue-500/5', label: 'Na Cozinha', pulse: false };
      case 'entrega': return { icon: '🛵', color: 'text-purple-400', border: 'border-purple-500', bg: 'bg-purple-500/5', label: 'Em Rota', pulse: false };
      case 'pronto_retirada': return { icon: '🛍️', color: 'text-green-400', border: 'border-green-500', bg: 'bg-green-500/5', label: 'Pronto p/ Retirada', pulse: false };
      case 'falha_pagamento': return { icon: '💳❌', color: 'text-zinc-400', border: 'border-zinc-500', bg: 'bg-zinc-800', label: 'ERRO NO PAGAMENTO', pulse: false };
      case 'concluido': return { icon: '✅', color: 'text-green-500', border: 'border-green-500', bg: 'bg-green-500/5', label: 'Concluído', pulse: false };
      case 'cancelado': return { icon: '🚫', color: 'text-red-400', border: 'border-red-500', bg: 'bg-red-500/5', label: 'Cancelado', pulse: false };
      default: return { icon: '❓', color: 'text-gray-400', border: 'border-gray-500', bg: 'bg-gray-500/5', label: status, pulse: false };
    }
  };

  const isDelayed = (pedido: any) => {
    const diffMinutes = (new Date().getTime() - (pedido.createdAt?.toDate ? pedido.createdAt.toDate() : new Date(pedido.createdAt)).getTime()) / 1000 / 60;
    return (pedido.status === 'pendente' || pedido.status === 'preparando') && diffMinutes > 30;
  };

  const isPendingDelayed = (pedido: any) => {
    const diffMinutes = (new Date().getTime() - (pedido.createdAt?.toDate ? pedido.createdAt.toDate() : new Date(pedido.createdAt)).getTime()) / 1000 / 60;
    return pedido.status === 'pendente' && diffMinutes > 5;
  };

  // Ordenação inteligente: Atrasados/Pendentes primeiro
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const aDelayed = isDelayed(a) || isPendingDelayed(a);
    const bDelayed = isDelayed(b) || isPendingDelayed(b);
    if (aDelayed && !bDelayed) return -1;
    if (!aDelayed && bDelayed) return 1;
    if (a.status === 'pendente' && b.status !== 'pendente') return -1;
    if (a.status !== 'pendente' && b.status === 'pendente') return 1;
    return 0; // Mantém a ordem original (por data) para o resto
  });

  return (
    <div>
      {/* FILTROS DE TOPO */}
      <div className="flex space-x-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
        {[
            { id: 'todos', label: 'Todos' },
            { id: 'pendente', label: 'Pendentes' },
            { id: 'preparando', label: 'Preparando' },
            { id: 'prontos', label: 'Prontos/Saiu' }
        ].map(f => (
            <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${filter === f.id ? 'bg-white text-black' : 'bg-[#1E1E1E] text-gray-500 border border-white/5 hover:bg-white/5'}`}
            >
                {f.label}
            </button>
        ))}
      </div>

      {/* LISTA DE PEDIDOS (BLOCK - Responsivo) */}
      <div className="space-y-4">
        {sortedOrders.map(pedido => {
            const delayed = isDelayed(pedido) || isPendingDelayed(pedido);
            const isSelected = pedido.id === selectedOrderId;
            const statusConfig = getStatusConfigAdmin(pedido.status, delayed);
            
            return (
            <div 
              key={pedido.id} 
              onClick={() => onSelectOrder(pedido)}
              className={`bg-[#1A1A1A] rounded-2xl p-4 flex flex-col justify-between h-auto relative overflow-hidden group cursor-pointer hover:border-white/20 transition-all active:scale-[0.99] ${statusConfig.pulse ? 'animate-pulse' : ''} ${isSelected ? 'border-2 border-[#FF8C00] shadow-lg' : 'border border-white/5'}`}
            >
                
                {/* Status Tag (Barra Lateral) */}
                <div className={`absolute left-0 top-0 bottom-0 w-2 ${statusConfig.border.replace('border-', 'bg-')}`}></div>

                {/* Topo: ID e Tempo */}
                <div className="flex justify-between items-center mb-4 pl-3">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{statusConfig.icon}</span>
                        <div>
                            <span className={`font-black uppercase text-xs ${statusConfig.color}`}>{statusConfig.label}</span>
                            <p className="text-white font-black text-lg leading-none">#{pedido.id.slice(-4)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyTicket(pedido);
                          }}
                          className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                          title="Copiar Ticket"
                        >
                            <i className="fa-solid fa-print text-xs"></i>
                        </button>
                        <span className="text-gray-500 text-[10px] font-bold uppercase bg-white/5 px-2 py-1 rounded-lg">{getTimeAgo(pedido.createdAt)}</span>
                    </div>
                </div>

                {/* Corpo: Cliente e Itens */}
                <div className="flex-1 mb-4 pl-3">
                    <div className="mb-3">
                      <p className="text-white font-bold text-sm truncate leading-tight">{pedido.clienteNome}</p>
                      {pedido.clienteDocumentoMasked && (
                        <p className="text-gray-500 text-[9px] font-mono mt-0.5 flex items-center"><i className="fa-solid fa-shield-halved mr-1.5 text-[#FF8C00]"></i> CPF: {pedido.clienteDocumentoMasked}</p>
                      )}
                    </div>
                    
                    {/* ALERTA DE ERRO DE PAGAMENTO */}
                    {pedido.status === 'falha_pagamento' && (
                        <div className="mb-3 p-2 bg-red-600/20 border border-red-600 rounded-lg text-xs text-red-500 font-bold flex items-center gap-2 animate-pulse">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        O pagamento via Pix expirou ou foi recusado. Não prepare este pedido!
                        </div>
                    )}

                    {pedido.itens.map((item: any, idx: number) => (
                        <div key={idx} className="text-sm">
                            <div className="flex items-start">
                                <span className="text-gray-200 font-bold">
                                    {item.quantity}x {item.name}
                                </span>
                            </div>
                            {/* Adicionais */}
                            {item.addons && item.addons.length > 0 && (
                                <div className="pl-0 mt-1 text-xs text-[#FF8C00] flex flex-wrap gap-2">
                                    {item.addons.map((addon: any, aIdx: number) => (
                                        <span key={aIdx} className="flex items-center"><i className="fa-solid fa-plus text-[8px] mr-1"></i>{addon.name}</span>
                                    ))}
                                </div>
                            )}
                            {/* Observação */}
                            {item.observation && (
                                <p className="mt-1 text-[10px] text-red-400 italic">"{item.observation}"</p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Rodapé Fixo */}
                <div className="border-t border-white/5 pt-3 pl-3">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-gray-500 text-[10px] font-black uppercase">Total</span>
                        <div className="text-right">
                            <span className="text-white font-black text-sm block">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.finalTotal || pedido.total || 0)}</span>
                            <span className="text-[9px] text-gray-400 italic">{pedido.paymentMethod === 'pix' ? '💠 PIX' : '💵 Dinheiro'}</span>
                        </div>
                    </div>

                    {pedido.status === 'pendente' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onUpdateStatus(pedido.id, 'preparando'); }}
                          className="w-full py-3 sm:py-4 bg-[#FF8C00] text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            Aceitar <i className="fa-solid fa-arrow-right"></i>
                        </button>
                    )}
                    {pedido.status === 'preparando' && (
                        pedido.deliveryMode === 'pickup' ? (
                            <button 
                              onClick={(e) => { e.stopPropagation(); onNotifyPickup(pedido.id); }} 
                              className="w-full py-3 sm:py-4 bg-green-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                Pronto p/ Retirada <i className="fa-solid fa-check"></i>
                            </button>
                        ) : (
                            profile?.deliveryMode === 'own' ? (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); onUpdateStatus(pedido.id, 'entrega'); }} 
                                  className="w-full py-3 sm:py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    Saiu p/ Entrega <i className="fa-solid fa-motorcycle"></i>
                                </button>
                            ) : (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); onNotifyDriver(pedido.id); }} 
                                  className="w-full py-3 sm:py-4 bg-[#FF8C00] text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    Chamar Motoboy <i className="fa-solid fa-bullhorn"></i>
                                </button>
                            )
                        )
                    )}
                    {(pedido.status === 'entrega' || pedido.status === 'pronto_retirada') && (
                        pedido.deliveryMode === 'delivery' && pedido.status === 'entrega' ? (
                           <div className="w-full py-3 bg-yellow-500/10 text-yellow-500 rounded-xl font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 border border-yellow-500/20">
                              <i className="fa-solid fa-lock"></i> Aguardando PIN do Cliente
                           </div>
                        ) : (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onUpdateStatus(pedido.id, 'concluido'); }} 
                            className="w-full py-3 sm:py-4 bg-green-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                          >
                              Concluir <i className="fa-solid fa-flag-checkered"></i>
                          </button>
                        )
                    )}

                    {/* Botão de Excluir para pedidos cancelados */}
                    {pedido.status === 'cancelado' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDeleteOrder(pedido.id); }} 
                          className="w-full py-3 sm:py-4 bg-red-600/10 text-red-500 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
                        >
                            Excluir <i className="fa-solid fa-trash"></i>
                        </button>
                    )}

                </div>
            </div>
            );
        })}
      </div>
      
      {filteredOrders.length === 0 && (
        <div className="text-center py-20 opacity-50">
            <i className="fa-solid fa-mug-hot text-4xl mb-4 text-gray-600"></i>
            <p className="text-gray-500 text-sm">Nenhum pedido nesta etapa.</p>
        </div>
      )}
    </div>
  );
};

const DashboardSidebar: React.FC<{ tab: string; setTab: (tab: any) => void; profile: any; signOut: () => void; }> = ({ tab, setTab, profile, signOut }) => (
  <div className="hidden md:flex flex-col w-20 lg:w-64 bg-[#121212] border-r border-white/5 h-full pt-8 px-4 gap-2 shrink-0 z-20">
    <div className="px-2 lg:px-4 mb-8 flex items-center gap-3">
      <div className="w-10 h-10 bg-gradient-to-br from-[#FF8C00] to-[#FF4500] rounded-xl flex items-center justify-center shadow-lg shadow-[#FF8C00]/20 shrink-0">
        <i className="fa-solid fa-store text-white text-lg"></i>
      </div>
      <div className="hidden lg:block">
        <h1 className="text-xl font-black tracking-tighter italic leading-none">Painel</h1>
        <p className="text-[8px] font-bold text-gray-500 uppercase tracking-[0.3em]">Vendedor</p>
      </div>
    </div>
    
    <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
      {[
        { id: 'pedidos', label: 'Pedidos', icon: 'fa-list-check' },
        { id: 'metricas', label: 'Métricas', icon: 'fa-chart-pie' },
        { id: 'carteira', label: 'Carteira', icon: 'fa-wallet' },
        { id: 'loja', label: 'Loja', icon: 'fa-store' },
        { id: 'cupons', label: 'Cupons', icon: 'fa-ticket' },
      ].map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id as any)}
          className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${tab === t.id ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
        >
          {tab === t.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF8C00]"></div>}
          <span className="text-lg w-6 text-center"><i className={`fa-solid ${t.icon}`}></i></span>
          <span className="text-xs font-black uppercase tracking-wide z-10 hidden lg:block">{t.label}</span>
        </button>
      ))}
    </div>

    <div className="mt-auto mb-8">
      <button onClick={() => signOut()} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 text-red-500 transition-colors group">
        <img src={profile?.image || `https://ui-avatars.com/api/?name=${profile?.nomeLoja || 'User'}`} className="w-8 h-8 rounded-full border-2 border-white/10 group-hover:border-red-500" alt="Profile" />
        <div className="hidden lg:block text-left">
          <p className="text-xs font-bold text-white truncate w-32">{profile?.nomeLoja || 'Visitante'}</p>
          <p className="text-[9px] text-red-500 uppercase font-black">Sair</p>
        </div>
      </button>
    </div>
  </div>
);

const SellerOrderDetailPanel: React.FC<{ order: any; onClose: () => void; onUpdateStatus: (id: string, status: string) => void; onVerifyPin: (orderId: string, pin: string) => void; }> = ({ order, onClose, onUpdateStatus, onVerifyPin }) => {
  if (!order) return null;

  const statusConfig = getStatusConfig(order.status, false);
  const [inputPin, setInputPin] = useState('');

  // Limpa o PIN quando o pedido selecionado muda
  useEffect(() => { setInputPin(''); }, [order]);

  return (
    <div className="w-full h-full bg-[#121212] border-l border-white/5 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-lg font-black text-white">Pedido #{order.id.slice(-4)}</h3>
          <p className="text-xs text-gray-400">{order.clienteNome}</p>
        </div>
        <button onClick={onClose} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {/* Status */}
        <div className={`p-4 rounded-2xl border ${statusConfig.border} ${statusConfig.bg}`}>
          <p className={`text-[10px] font-black uppercase tracking-widest ${statusConfig.color}`}>Status</p>
          <p className={`text-lg font-black ${statusConfig.color}`}>{statusConfig.label}</p>
        </div>

        {/* Items */}
        <div>
          <h4 className="text-gray-400 text-xs font-black uppercase tracking-widest mb-3">Itens</h4>
          <div className="space-y-3">
            {order.itens.map((item: any, idx: number) => (
              <div key={idx} className="bg-black/40 p-3 rounded-xl border border-white/5 flex gap-3">
                <span className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-xs font-black text-gray-400">{item.quantity}x</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{item.name}</p>
                </div>
                <p className="text-sm font-bold text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.quantity)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Financials */}
        <div>
          <h4 className="text-gray-400 text-xs font-black uppercase tracking-widest mb-3">Financeiro</h4>
          <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-gray-400">Subtotal</span> <span className="text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.subtotal || 0)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Taxa de Entrega</span> <span className="text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.deliveryFee || 0)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Taxa do App</span> <span className="text-red-400">- {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.appFee || 0)}</span></div>
            <div className="flex justify-between items-center pt-2 border-t border-white/10 mt-2">
              <span className="text-white font-bold text-sm">SEU LUCRO</span>
              <span className="text-green-500 font-black text-lg">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.netValue || 0)}</span>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div>
          <h4 className="text-gray-400 text-xs font-black uppercase tracking-widest mb-3">Cliente & Entrega</h4>
          <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-3">
            <p className="text-sm text-gray-300"><i className="fa-solid fa-location-dot w-5 text-center text-[#FF8C00] mr-2"></i>{order.endereco}</p>
            <p className="text-sm text-gray-300"><i className="fa-brands fa-whatsapp w-5 text-center text-green-500 mr-2"></i>{order.clienteTelefone || 'Não informado'}</p>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-white/5 shrink-0 space-y-3">
        {order.status === 'pendente' && (
          <button onClick={() => onUpdateStatus(order.id, 'preparando')} className="w-full py-4 bg-[#FF8C00] text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95">Aceitar Pedido</button>
        )}
        {order.status === 'preparando' && (
          <button onClick={() => onUpdateStatus(order.id, order.deliveryMode === 'pickup' ? 'pronto_retirada' : 'entrega')} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95">
            {order.deliveryMode === 'pickup' ? 'Pronto para Retirada' : 'Saiu para Entrega'}
          </button>
        )}
        {order.status === 'entrega' && (
          <div className="w-full py-3 text-center bg-green-500/10 text-green-500 rounded-xl font-bold uppercase text-[10px] tracking-widest border border-green-500/20">
            Aguardando Confirmação do Entregador
          </div>
        )}
        {/* LÓGICA DE PIN PARA RETIRADA NA LOJA */}
        {order.status === 'pronto_retirada' && (
          <div className="space-y-3">
            <p className="text-center text-xs text-gray-400 font-bold">Solicite o PIN ao cliente para finalizar.</p>
            <input 
              type="number" 
              value={inputPin}
              placeholder="PIN do Cliente"
              className="w-full p-4 rounded-2xl bg-black/20 border border-white/10 placeholder:text-gray-600 font-black text-center text-2xl tracking-[0.3em] outline-none focus:border-[#FF8C00] transition-all text-white"
              onChange={(e) => {
                const val = e.target.value.slice(0, 4);
                setInputPin(val);
                if(val.length === 4) onVerifyPin(order.id, val);
              }}
            />
            <button onClick={() => onVerifyPin(order.id, inputPin)} disabled={inputPin.length !== 4} className="w-full py-3 bg-green-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 disabled:opacity-50">
              Confirmar Retirada
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Dashboard: React.FC = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [completedOrders, setCompletedOrders] = useState<any[]>([]); // Mantido para métricas
  const [error, setError] = useState<string | null>(null);
  const [isConfigError, setIsConfigError] = useState(false);
  const [showPix, setShowPix] = useState(false);
  const [tab, setTab] = useState<'pedidos' | 'metricas' | 'loja' | 'carteira' | 'cupons'>('pedidos');
  const [walletFilter, setWalletFilter] = useState<'today' | 'week' | 'month'>('today');
  const [pushNotif, setPushNotif] = useState<{show: boolean, title: string, message: string, time: string} | null>(null);
  
  // Estados da Loja e Cardápio
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageDeleteUrl, setImageDeleteUrl] = useState('');
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [isStoreImageSearch, setIsStoreImageSearch] = useState(false); // Identifica se a busca é para a Loja
  const [showIconSelector, setShowIconSelector] = useState(false); // Novo estado para ícones
  const [isKitchenBusy, setIsKitchenBusy] = useState(false); // Status "Cozinha Lotada"
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [imageSearchResults, setImageSearchResults] = useState<any[]>([]);
  const [unsplashPage, setUnsplashPage] = useState(1);
  // Estado para gerenciar adicionais durante a edição/criação
  const [currentAddons, setCurrentAddons] = useState<{name: string, price: string}[]>([]);
  const [isAvailable, setIsAvailable] = useState(true); // Novo estado para o toggle do formulário

  // Estado de Horários e Meta
  const [businessHours, setBusinessHours] = useState({
    seg: { open: '08:00', close: '18:00', active: true },
    ter: { open: '08:00', close: '18:00', active: true },
    qua: { open: '08:00', close: '18:00', active: true },
    qui: { open: '08:00', close: '18:00', active: true },
    sex: { open: '08:00', close: '18:00', active: true },
    sab: { open: '08:00', close: '23:00', active: true },
    dom: { open: '10:00', close: '22:00', active: true },
  });
  const [dailyGoal, setDailyGoal] = useState(500);

  // Estado do Perfil da Loja
  const [storeProfile, setStoreProfile] = useState({
    nomeLoja: '',
    description: '',
    endereco: '',
    image: ''
  });

  // Estados de Cupons
  const [coupons, setCoupons] = useState<any[]>([]);
  const [newCoupon, setNewCoupon] = useState({ code: '', discount: '', type: 'percent', minOrder: '' });
  
  // Estados para Cancelamento com Motivo
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderToDeleteId, setOrderToDeleteId] = useState<string | null>(null); // Novo estado para deletar
  const [draggedItem, setDraggedItem] = useState<any>(null); // Estado para Drag and Drop
  const [menuSearch, setMenuSearch] = useState(''); // Estado para busca no cardápio
  const [shopRating, setShopRating] = useState({ rating: 5, count: 0 }); // Estado para avaliação da loja

  // Estados para Crop de Imagem
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  // Estado para Modais de Confirmação
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'deleteItem' | 'deleteCoupon' | 'deleteOrder' | null;
    id: string | null; // Pode ser ID do item, cupom ou pedido
  }>({ isOpen: false, type: null, id: null });

  const prevPendingCount = useRef(0);
  const isFirstLoad = useRef(true);
  const audioAlert = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));
  const audioCancelAlert = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/23/23-preview.mp3'));
  const prevOrdersRef = useRef<any[]>([]);
  const alertIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Métricas Calculadas
  const metrics = useMemo(() => {
    // Filtra apenas os pedidos de HOJE para os cards de resumo
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ordersToday = completedOrders.filter(o => {
      if (!o.createdAt) return false;
      const d = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      return d >= today;
    });

    // Cálculo corrigido: Bruto (Total pago pelo cliente) vs Líquido (Recebido pelo lojista)
    const faturamentoBrutoHoje = ordersToday.reduce((acc, p) => acc + (p.finalTotal || p.total || 0), 0);
    const faturamentoLiquidoHoje = ordersToday.reduce((acc, p) => acc + (p.netValue || 0), 0);
    const totalPedidos = ordersToday.length;
    const ticketMedio = totalPedidos > 0 ? faturamentoBrutoHoje / totalPedidos : 0;
    const pedidosPendentes = activeOrders.length;

    // Taxa de conversão de upsell: pedidos em que o cliente aceitou a sugestão do SmartUpsellModal
    const pedidosComUpsell = ordersToday.filter((o: any) => o.upsellAccepted === true).length;
    const taxaConversaoUpsell = totalPedidos > 0 ? Math.round((pedidosComUpsell / totalPedidos) * 100) : 0;

    // Tempo médio de preparo (minutos): entregaEm - preparandoEm (ou createdAt se preparandoEm ausente)
    const pedidosComTempo = ordersToday.filter((o: any) => o.entregaEm || (o.entregaEm === undefined && (o.status === 'concluido' || o.status === 'entrega')));
    const temposPreparo = ordersToday
      .filter((o: any) => o.preparandoEm && o.entregaEm)
      .map((o: any) => {
        const start = new Date(o.preparandoEm).getTime();
        const end = new Date(o.entregaEm).getTime();
        return (end - start) / 1000 / 60; // minutos
      });
    const tempoMedioPreparoMin = temposPreparo.length > 0 ? temposPreparo.reduce((a: number, b: number) => a + b, 0) / temposPreparo.length : 0;

    // Prepara dados para o Gráfico (Últimos 7 dias)
    const labels = [];
    const data = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('pt-BR');
      const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' });
      
      labels.push(dayName.replace('.', '')); // Ex: "seg"
      
      const dayTotal = completedOrders.reduce((acc, o) => {
        if (!o.createdAt) return acc;
        const od = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        if (od.toLocaleDateString('pt-BR') === dateStr) {
          return acc + (o.finalTotal || o.total || 0);
        }
        return acc;
      }, 0);
      
      data.push(dayTotal);
    }

    // Cálculo de Mais Vendidos
    const productCounts: {[key: string]: number} = {};
    completedOrders.forEach(order => {
      order.itens?.forEach((item: any) => {
        productCounts[item.name] = (productCounts[item.name] || 0) + item.quantity;
      });
    });
    
    const bestSellers = Object.entries(productCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const chartData = {
      labels,
      datasets: [
        {
          label: 'Vendas (R$)',
          data,
          backgroundColor: '#FF8C00',
          borderRadius: 6,
          hoverBackgroundColor: '#FFA500',
        },
      ],
    };

    return {
      faturamentoBrutoHoje, faturamentoLiquidoHoje, totalPedidos, ticketMedio, pedidosPendentes,
      taxaConversaoUpsell, tempoMedioPreparoMin, pedidosComUpsell,
      chartData, bestSellers, ordersToday,
    };
  }, [activeOrders, completedOrders]);

  // Relatório de "Lanches Esquecidos" (Inteligência de Vendas)
  const forgottenItems = useMemo(() => {
    if (menuItems.length === 0 || completedOrders.length === 0) return [];
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentOrders = completedOrders.filter(o => {
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      return d >= sevenDaysAgo;
    });

    const soldItemIds = new Set();
    recentOrders.forEach(o => {
      o.itens?.forEach((i: any) => soldItemIds.add(i.id));
    });

    // Retorna itens disponíveis que não foram vendidos nos últimos 7 dias (Top 4)
    return menuItems.filter(item => item.isAvailable && !soldItemIds.has(item.id)).slice(0, 4);
  }, [menuItems, completedOrders]);

  // Cálculo da Carteira
  const wallet = useMemo(() => {
    // Usa o netValue (valor líquido) se existir, senão usa o total (fallback)
    const liberado = completedOrders.reduce((acc, p) => acc + (p.netValue || p.finalTotal || p.total || 0), 0);
    const retido = activeOrders.reduce((acc, p) => acc + (p.netValue || p.finalTotal || p.total || 0), 0);
    
    const now = new Date();
    const history = completedOrders.filter(order => {
      const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      if (walletFilter === 'today') {
        return date.toDateString() === now.toDateString();
      } else if (walletFilter === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        return date >= oneWeekAgo;
      } else { // month
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }
    }).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    // Dados para o Gráfico de Evolução do Saldo (acumulado)
    const chartLabels = [];
    const chartData = [];
    let runningBalance = 0;

    // Ordena do mais antigo para o mais novo para calcular o acumulado
    const sortedForChart = [...completedOrders].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

    // Pega os últimos 10 pontos de dados para não poluir o gráfico
    const recentOrders = sortedForChart.slice(-10);

    recentOrders.forEach(order => {
      const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      chartLabels.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
      runningBalance += (order.finalTotal || order.total || 0);
      chartData.push(runningBalance);
    });

    return { liberado, retido, history, chartLabels, chartData };
  }, [activeOrders, completedOrders, walletFilter]);

  // Regra dos 3 Dias (Verificação Automática)
  useEffect(() => {
    const checkForgottenOrders = async () => {
      if (!profile?.lojaId) return;
      
      try {
        // Busca pedidos que estão "Em Entrega" (potencialmente esquecidos)
        const q = query(
          collection(db, 'pedidos'),
          where('lojaId', '==', profile.lojaId),
          where('status', '==', 'entregue') // Busca pedidos já entregues mas não concluídos
        );
        
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        let count = 0;
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const entregueEm = data.entregueEm ? new Date(data.entregueEm) : new Date();
          
          if (entregueEm < threeDaysAgo) {
            batch.update(doc.ref, { status: 'concluido', statusPagamento: 'liberado', saldoRetido: false, autoConcluidoEm: new Date().toISOString() });
            count++;
          }
        });

        if (count > 0) {
          await batch.commit();
          toast.success(`${count} pedidos antigos foram liberados automaticamente!`);
        }
      } catch (e) { console.error("Erro na verificação automática:", e); }
    };

    checkForgottenOrders();
  }, [profile?.lojaId]);

  // Sincroniza a URL da imagem quando abrir a edição
  useEffect(() => {
    if (editingItem) {
      setImageUrl(editingItem.image || '');
      setImageDeleteUrl(editingItem.imageDeleteUrl || ''); // Carrega a URL de deleção para edição
      setCurrentAddons(editingItem.addons || []);
      setIsAvailable(editingItem.isAvailable !== false); // Default true se undefined
    } else {
      setImageUrl('');
      setImageDeleteUrl('');
      setCurrentAddons([]);
      setIsAvailable(true);
    }
  }, [editingItem]);

  // Listener para Configurações da Loja e Cardápio
  useEffect(() => {
    if (!profile?.uid) return;

    // 1. Dados da Loja (Aberto/Fechado, Horários)
    const unsubStore = onSnapshot(doc(db, 'users', profile.uid), (doc) => {
      setStoreSettings(doc.data());
      const data = doc.data();
      if (data) {
        setStoreProfile(prev => ({
          ...prev,
          nomeLoja: data.nomeLoja || '',
          description: data.description || '',
          endereco: data.endereco || '',
          // Garante que a imagem venha de qualquer campo possível
          image: data.image || data.foto || ''
        }));
        setShopRating({ rating: data.rating || 5, count: data.ratingCount || 0 });
        if (data.businessHours) setBusinessHours(data.businessHours);
        if (data.isKitchenBusy) setIsKitchenBusy(data.isKitchenBusy);
        if (data.dailyGoal) setDailyGoal(data.dailyGoal);
      }
    });

    // 2. Cardápio
    const unsubMenu = onSnapshot(collection(db, 'users', profile.uid, 'cardapio'), (snap) => {
      setMenuItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Cupons
    const unsubCoupons = onSnapshot(collection(db, 'users', profile.uid, 'coupons'), (snap) => {
      setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubStore(); unsubMenu(); unsubCoupons(); };
  }, [profile?.uid]);

  // Listener de Pedidos
  useEffect(() => {
    if (!profile?.lojaId || !db) {
      if (profile && !profile.lojaId) setError("Configurando acesso da loja...");
      return;
    }

    setError(null);
    setIsConfigError(false);

    try {
      // Query UNIFICADA para todos os pedidos da loja.
      // Isso corrige o problema das métricas zeradas por falta de índices compostos no Firestore.
      // Buscamos tudo e filtramos em memória (seguro para MVP).
      const qAllOrders = query(
        collection(db, 'pedidos'),
        where('lojaId', '==', profile.lojaId)
      );

      const unsubscribe = onSnapshot(qAllOrders, (snapshot) => {
        const allDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
        
        // 1. Separa Pedidos Ativos (Cozinha/Entrega)
        const active = allDocs.filter((d: any) => d.status !== 'concluido');
        // Ordena por data (mais recentes primeiro)
        active.sort((a: any, b: any) => {
           const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
           const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
           return dateB.getTime() - dateA.getTime();
        });

        // 2. Separa Pedidos Concluídos (Para Métricas e Gráficos)
        const completed = allDocs.filter((d: any) => d.status === 'concluido');

        // Notificação de Novo Pedido
        const pendingCount = active.filter((d: any) => d.status === 'pendente').length;

        // Som de Campainha Persistente para Pedidos Pendentes
        if (pendingCount > 0) {
          if (!alertIntervalRef.current) {
            alertIntervalRef.current = setInterval(() => {
              audioAlert.current.currentTime = 0;
              audioAlert.current.play().catch(() => {});
            }, 30000); // Toca a cada 30s
          }
        } else if (alertIntervalRef.current) {
          clearInterval(alertIntervalRef.current);
          alertIntervalRef.current = null;
        }

        // Toca o som apenas se não for o primeiro carregamento e se o número de pendentes aumentou
        if (!isFirstLoad.current && pendingCount > prevPendingCount.current) {
          audioAlert.current.currentTime = 0; // Reinicia o som para tocar imediatamente
          audioAlert.current.play().catch(e => console.log('Audio notify error:', e));
          
          // Show Simulated Push
          setPushNotif({
            show: true,
            title: 'Novo Pedido!',
            message: `Você tem ${pendingCount} pedido(s) aguardando aceite.`,
            time: 'Agora'
          });
          
          // Auto hide
          setTimeout(() => setPushNotif(null), 6000);
        }

        // Notificação de Pedido Cancelado
        if (!isFirstLoad.current) {
          const previousOrders = prevOrdersRef.current;
          allDocs.forEach(currentOrder => {
            const previousOrder = previousOrders.find(p => p.id === currentOrder.id);
            if (currentOrder.status === 'cancelado' && previousOrder && previousOrder.status !== 'cancelado') {
              audioCancelAlert.current.currentTime = 0;
              audioCancelAlert.current.play().catch(e => console.log('Audio cancel error:', e));
              toast.error(`Pedido #${currentOrder.id.slice(-4)} foi cancelado!`, { duration: 6000 });
            }
          });
        }
        
        isFirstLoad.current = false;
        prevPendingCount.current = pendingCount;
        prevOrdersRef.current = allDocs; // Atualiza a referência para a próxima verificação
        
        setActiveOrders(active);
        setCompletedOrders(completed);
      }, (err) => {
        console.error("Erro no Listener Dashboard:", err);
        if (err.message?.includes('firestore.googleapis.com') || err.code === 'permission-denied') {
          setIsConfigError(true);
          setError("Configuração necessária no Cloud Console.");
        } else {
          setError("Conexão instável. Tentando reconectar...");
        }
      });

      return () => unsubscribe();
    } catch (e: any) {
       setError("Falha ao carregar pedidos.");
    }
  }, [profile]);

  useEffect(() => {
    return () => { if (alertIntervalRef.current) clearInterval(alertIntervalRef.current); };
  }, []);

  const updateStatus = async (pedidoId: string, newStatus: string) => {
    try {
      const pedidoRef = doc(db, 'pedidos', pedidoId);
      const updateData: any = { status: newStatus };
      const now = new Date().toISOString();

      if (newStatus === 'preparando') {
        updateData.deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();
        updateData.preparandoEm = now; // Métrica: tempo de preparo
      }
      if (newStatus === 'entrega' || newStatus === 'pronto_retirada') {
        updateData.entregaEm = now; // Métrica: tempo até sair
      }

      await updateDoc(pedidoRef, updateData);
    } catch (err) {
      toast.error("Erro ao atualizar o status do pedido.");
    }
  };

  const handleCancelOrderFromShop = async (pedidoId: string, reason: string) => {
    if (!reason.trim()) {
      toast.error("Por favor, informe um motivo para o cancelamento.");
      return;
    }
    try {
      const pedidoRef = doc(db, 'pedidos', pedidoId);
      await updateDoc(pedidoRef, { 
        status: 'cancelado', 
        canceladoPor: 'loja',
        motivoCancelamento: reason 
      });
      toast.success("Pedido cancelado com sucesso.");
      setOrderToCancel(null);
      setCancellationReason('');
    } catch (err) {
      toast.error("Erro ao cancelar o pedido.");
    }
  };

  const notifyDriver = async (pedidoId: string) => {
    try {
      const pedidoRef = doc(db, 'pedidos', pedidoId);
      // Atualiza o status para 'preparando' (se não estiver) e marca como pronto para coleta
      await updateDoc(pedidoRef, { status: 'preparando', readyForPickup: true });
      toast.success("Entregadores próximos notificados!");
    } catch (err) {
      toast.error("Erro ao notificar entregadores.");
    }
  };

  const notifyReadyForPickup = async (pedidoId: string) => {
    try {
      const pedidoRef = doc(db, 'pedidos', pedidoId);
      // Atualiza status para um estado especial ou usa 'concluido' se preferir simplificar
      await updateDoc(pedidoRef, { status: 'pronto_retirada' });
      toast.success("Cliente notificado para retirada!");
    } catch (err) {
      toast.error("Erro ao notificar cliente.");
    }
  };

  // --- LÓGICA DE DRAG AND DROP (REORDENAR CARDÁPIO) ---
  const handleDragStart = (item: any) => {
    setDraggedItem(item);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessário para permitir o drop
  };

  const handleDrop = async (e: React.DragEvent, targetItem: any) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetItem.id) return;
    if (!profile?.uid) return;

    const category = targetItem.category || 'Geral';
    // Só permite reordenar dentro da mesma categoria para evitar confusão
    if ((draggedItem.category || 'Geral') !== category) return;

    // Pega os itens da categoria e ordena pela ordem atual
    const categoryItems = menuItems
      .filter(i => (i.category || 'Geral') === category)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    const draggedIdx = categoryItems.findIndex(i => i.id === draggedItem.id);
    const targetIdx = categoryItems.findIndex(i => i.id === targetItem.id);

    if (draggedIdx === -1 || targetIdx === -1) return;

    // Reordena o array localmente
    const newItems = [...categoryItems];
    const [removed] = newItems.splice(draggedIdx, 1);
    newItems.splice(targetIdx, 0, removed);

    // Salva a nova ordem no Firestore em lote
    const batch = writeBatch(db);
    newItems.forEach((item, index) => {
      const ref = doc(db, 'users', profile.uid, 'cardapio', item.id);
      batch.update(ref, { orderIndex: index });
    });

    try {
      await batch.commit();
      toast.success("Ordem atualizada!");
    } catch (err) {
      toast.error("Erro ao salvar nova ordem.");
    }
    setDraggedItem(null);
  };

  const handleDeleteOrder = async (orderId: string) => {
    setOrderToDeleteId(orderId);
    setConfirmModal({
      isOpen: true,
      type: 'deleteOrder', // Novo tipo para o modal de confirmação
      id: orderId
    });
  };

  // Função para confirmar a exclusão do pedido
  const confirmDeleteOrder = async () => {
    if (!orderToDeleteId) return;
    try {
      await deleteDoc(doc(db, 'pedidos', orderToDeleteId));
      toast.success("Pedido excluído permanentemente.");
      setOrderToDeleteId(null);
      setConfirmModal({ isOpen: false, type: null, id: null });
      setSelectedOrder(null); // Fecha o modal de detalhes se o pedido for excluído
    } catch (e) {
      toast.error("Erro ao excluir pedido.");
    }
  };

  const handlePrint = (pedido: any) => {
    toast("Função de impressão em desenvolvimento", { icon: '🖨️' });
  };

  const toggleStoreOpen = async () => {
    if (!profile?.uid) return;
    const newState = !storeSettings?.isOpen;
    try {
      await updateDoc(doc(db, 'users', profile.uid), { isOpen: newState });
      toast.success(newState ? "Loja Aberta!" : "Loja Fechada!");
    } catch (e) {
      toast.error("Erro ao alterar status da loja.");
    }
  };

  // Função para chamar a Cloud Function de validação de PIN
  const verifyPinWithCloudFunction = async (orderId: string, pin: string) => {
    const toastId = toast.loading("Validando PIN...");
    try {
      const functions = getFunctions(firebaseConfig as any, 'southamerica-east1');
      const validateDeliveryPIN = httpsCallable(functions, 'validateDeliveryPIN');
      
      const result: any = await validateDeliveryPIN({ orderId, pin });
      
      if (result.data.success) {
        toast.success("Entrega confirmada com sucesso!", { id: toastId });
        setSelectedOrder(null); // Fecha o painel de detalhes
      } else {
        toast.error(result.data.message || "PIN incorreto.", { id: toastId });
      }
    } catch (error: any) {
      console.error("Erro ao validar PIN:", error);
      const message = error.message || "Falha na comunicação com o servidor.";
      toast.error(`Erro: ${message}`, { id: toastId });
    }
  };


  const handleSaveStoreProfile = async () => {
    if (!profile?.uid) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        ...storeProfile,
        businessHours,
        isKitchenBusy,
        dailyGoal,
        updatedAt: serverTimestamp()
      });
      toast.success("Loja Atualizada com Sucesso!");
      // Opcional: Reload forçado se o usuário sentir que "travou", mas o onSnapshot deve cuidar disso.
      // window.location.reload(); 
    } catch (e: any) { 
      console.error("Erro ao salvar perfil:", e);
      toast.error(`Erro ao salvar perfil: ${e.message || "Tente novamente."}`); 
    }
  };

  // Função auxiliar para upload no ImgBB (reutilizável)
  const uploadToImgBB = async (file: Blob) => {
    const formData = new FormData();
    formData.append("image", file);
    const apiKey = ENV.IMGBB.key;

    if (!apiKey || apiKey === 'your_imgbb_key') {
      throw new Error("Chave de API do ImgBB inválida. Configure VITE_IMGBB_KEY no arquivo .env");
    }
    
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: formData,
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.error?.message || "Falha no upload");
    return data.data;
  };

  const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    // 1. Validação de Tipo (MIME Type)
    if (!file.type.startsWith('image/')) {
      toast.error("Por favor, selecione um arquivo de imagem válido.");
      return;
    }

    // 2. Validação de Tamanho (Ex: Máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem é muito grande. O limite é 5MB.");
      return;
    }

    // Lê o arquivo para exibir no Cropper
    const reader = new FileReader();
    reader.addEventListener('load', () => setCropImageSrc(reader.result as string));
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropConfirm = async () => {
    if (!cropImageSrc || !croppedAreaPixels) return;
    
    setUploading(true);
    try {
      // 1. Gera o Blob da imagem recortada
      const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels);
      
      // 2. Envia para o ImgBB
      const imgData = await uploadToImgBB(croppedBlob);
      
      setImageUrl(imgData.url);
      setImageDeleteUrl(imgData.delete_url);
      setCropImageSrc(null); // Fecha o modal de crop
      toast.success("Imagem recortada e enviada!");

    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Erro ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  };

  const searchUnsplashImages = async (page = 1, term = imageSearchQuery) => {
    if (!term.trim()) return;
    setUploading(true);
    try {
      // ⚠️ A chave de demonstração anterior expirou (Erro 401).
      // Para corrigir: Crie uma conta em https://unsplash.com/developers, crie um App e cole sua Access Key abaixo.
      const accessKey = UNSPLASH_ACCESS_KEY; 
      
      const response = await fetch(`https://api.unsplash.com/search/photos?page=${page}&query=${encodeURIComponent(term)}&per_page=12&client_id=${accessKey}`);
      
      if (response.status === 401 || response.status === 403) {
        throw new Error("Chave Unsplash inválida ou limite excedido. Configure uma nova chave.");
      }

      const data = await response.json();
      if (data.results) {
        if (page === 1) {
          setImageSearchResults(data.results);
        } else {
          setImageSearchResults(prev => [...prev, ...data.results]);
        }
        setUnsplashPage(page);
        if (term !== imageSearchQuery) setImageSearchQuery(term);
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao buscar imagens.");
    } finally {
      setUploading(false);
    }
  };

  // Função "Gerar Foto Profissional" (Busca Automática)
  const handleAutoGenerateStoreImage = async () => {
    if (!storeProfile.nomeLoja) {
      toast.error("Preencha o nome da loja primeiro!");
      return;
    }
    
    const searchTerm = storeProfile.nomeLoja.split(' ')[0] + " food"; // Pega a primeira palavra + food
    setUploading(true);
    try {
      const accessKey = UNSPLASH_ACCESS_KEY;
      const response = await fetch(`https://api.unsplash.com/search/photos?page=1&query=${encodeURIComponent(searchTerm)}&per_page=1&client_id=${accessKey}`);
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        setStoreProfile(prev => ({ ...prev, image: data.results[0].urls.regular }));
        toast.success("Foto profissional gerada!");
      } else {
        toast.error("Nenhuma foto encontrada automaticamente.");
      }
    } catch (e) { toast.error("Erro ao gerar foto."); } finally { setUploading(false); }
  };

  const handleSelectUnsplashImage = async (url: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", url);
      
      const apiKey = ENV.IMGBB.key;

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        if (isStoreImageSearch) {
          setStoreProfile(prev => ({ ...prev, image: data.data.url }));
        } else {
          setImageUrl(data.data.url);
          setImageDeleteUrl(data.data.delete_url); 
        }
        setShowImageSearch(false);
        setShowIconSelector(false);
        toast.success(isStoreImageSearch ? "Logo da loja atualizada!" : "Imagem importada e salva!");
      } else {
        throw new Error(data.error?.message || "Falha ao salvar imagem no ImgBB");
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Erro ao salvar imagem.");
    } finally {
      setUploading(false);
    }
  };

  // Funções para gerenciar adicionais no formulário
  const addAddonField = () => {
    setCurrentAddons([...currentAddons, { name: '', price: '' }]);
  };

  const removeAddonField = (index: number) => {
    const newAddons = [...currentAddons];
    newAddons.splice(index, 1);
    setCurrentAddons(newAddons);
  };

  const updateAddonField = (index: number, field: 'name' | 'price', value: string) => {
    const newAddons = [...currentAddons];
    newAddons[index] = { ...newAddons[index], [field]: value };
    setCurrentAddons(newAddons);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const data = {
      name: formData.get('name'),
      description: formData.get('description'),
      price: parseFloat((formData.get('price') as string).replace(',', '.')) || 0,
      promoPrice: formData.get('promoPrice') ? parseFloat((formData.get('promoPrice') as string).replace(',', '.')) : null,
      category: formData.get('category'),
      image: imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150&q=80',
      isAvailable: isAvailable,
      prepTime: formData.get('prepTime') || '20', // Novo campo
      imageDeleteUrl: imageDeleteUrl, // Salva a URL de deleção no documento
      addons: currentAddons.filter(a => a.name && a.price).map(a => ({
        name: a.name,
        price: parseFloat(a.price.replace(',', '.')) || 0
      }))
    };

    try {
      if (editingItem) {
        await updateDoc(doc(db, 'users', profile.uid, 'cardapio', editingItem.id), data);
        toast.success("Produto atualizado!");
      } else {
        await addDoc(collection(db, 'users', profile.uid, 'cardapio'), data);
        toast.success("Produto adicionado!");
      }
      setShowItemForm(false);
      setEditingItem(null);
    } catch (err) {
      toast.error("Erro ao salvar produto.");
    }
  };

  const handleDuplicateItem = async (item: any) => {
    if (!profile?.uid) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...itemData } = item;
    try {
      await addDoc(collection(db, 'users', profile.uid, 'cardapio'), {
        ...itemData,
        name: `${itemData.name} (Cópia)`,
        isAvailable: false // Começa pausado por segurança
      });
      toast.success("Produto duplicado!");
    } catch (err) {
      toast.error("Erro ao duplicar.");
    }
  };

  const toggleKitchenBusy = async () => {
    if (!profile?.uid) return;
    const newState = !isKitchenBusy;
    setIsKitchenBusy(newState);
    try {
      // Se ativar cozinha lotada, aumenta o tempo de entrega visualmente (lógica de backend pode ser adicionada depois)
      await updateDoc(doc(db, 'users', profile.uid), { isKitchenBusy: newState });
      toast(newState ? "Modo Cozinha Lotada ATIVADO! Clientes avisados." : "Modo Cozinha Lotada DESATIVADO.", { icon: newState ? '🔥' : '👍' });
    } catch (e) { toast.error("Erro ao atualizar status."); }
  };

  const handleDeleteItem = async (id: string) => {
    if (!profile?.uid) return;
    try {
      const itemToDelete = menuItems.find(item => item.id === id);

      // A Cloud Function 'onMenuItemDelete' cuidará de apagar a imagem no ImgBB automaticamente
      // assim que este documento for removido.
      await deleteDoc(doc(db, 'users', profile.uid, 'cardapio', id));
      toast.success("Item removido com sucesso!");
      setConfirmModal({ isOpen: false, type: null, id: null });
    } catch (error) {
      console.error("Erro ao deletar item:", error);
      toast.error("Falha ao remover o item. A imagem pode não ter sido deletada.");
      setConfirmModal({ isOpen: false, type: null, id: null });
    }
  };

  const toggleAvailability = async (item: any) => {
    if (!profile?.uid) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid, 'cardapio', item.id), {
        isAvailable: !item.isAvailable
      });
      toast.success(`Produto ${!item.isAvailable ? 'ativado' : 'pausado'}!`);
    } catch (e) { toast.error("Erro ao atualizar estoque."); }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    if (!newCoupon.code || !newCoupon.discount) {
      toast.error("Preencha o código e o valor do desconto.");
      return;
    }

    try {
      await addDoc(collection(db, 'users', profile.uid, 'coupons'), {
        code: newCoupon.code.toUpperCase().trim(),
        discount: parseFloat(newCoupon.discount),
        type: newCoupon.type, // 'percent' ou 'fixed'
        minOrder: parseFloat(newCoupon.minOrder) || 0,
        active: true,
        createdAt: serverTimestamp()
      });
      setNewCoupon({ code: '', discount: '', type: 'percent', minOrder: '' });
      toast.success("Cupom criado com sucesso!");
    } catch (err) {
      toast.error("Erro ao criar cupom.");
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!profile?.uid) return;
    try {
      await deleteDoc(doc(db, 'users', profile.uid, 'coupons', id));
      toast.success("Cupom removido.");
      setConfirmModal({ isOpen: false, type: null, id: null });
    } catch (e) { toast.error("Erro ao remover cupom."); setConfirmModal({ isOpen: false, type: null, id: null }); }
  };

  const handleRequestWithdraw = async () => {
    if (wallet.liberado < 50) {
      toast.error("O valor mínimo para saque é R$ 50,00");
      return;
    }
    
    try {
      await addDoc(collection(db, 'saques'), {
        lojaId: profile?.lojaId,
        valor: wallet.liberado,
        status: 'pendente',
        solicitadoEm: serverTimestamp(),
        chavePix: profile?.chavePix
      });
      toast.success("Solicitação de saque enviada! O valor cairá na sua conta em até 24h.");
    } catch (error) {
      toast.error("Erro ao solicitar saque.");
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150&q=80";
  };

  // Exportação do fechamento do dia (JSON ou CSV)
  const handleExportDay = useCallback((format: 'json' | 'csv') => {
    const orders = metrics.ordersToday || [];
    const sanitize = (o: any) => {
      const created = o.createdAt?.toDate ? o.createdAt.toDate().toISOString() : (o.createdAt || '');
      return { ...o, id: o.id, createdAt: created, status: o.status, finalTotal: o.finalTotal || o.total, netValue: o.netValue };
    };
    const rows = orders.map(sanitize);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `eilanches-fechamento-${dateStr}`;
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${filename}.json`; a.click(); URL.revokeObjectURL(url);
    } else {
      const headers = ['id', 'status', 'clienteNome', 'finalTotal', 'netValue', 'createdAt'];
      const csvContent = [headers.join(';'), ...rows.map((r: any) => headers.map(h => (r[h] ?? '')).join(';'))].join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click(); URL.revokeObjectURL(url);
    }
    toast.success(`Exportado: ${rows.length} pedidos`);
  }, [metrics.ordersToday]);

  const getStatusColor = (status: string) => {
    const config = getStatusConfig(status);
    // Retorna classes compatíveis com o uso no Dashboard (fundo sólido para badges)
    return `${config.bg.replace('/10', '/20')} ${config.color} ${config.border}`;
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white p-4 sm:p-6 pb-24 flex flex-col">
      {/* PUSH NOTIFICATION COMPONENT */}
      {pushNotif && (
        <PushNotification 
          show={pushNotif.show} 
          title={pushNotif.title} 
          message={pushNotif.message} 
          time={pushNotif.time}
          onClose={() => setPushNotif(null)} 
        />
      )}

      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 shrink-0 gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">{profile?.nomeLoja || "Gerente"}</h1>
          <button 
            className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity mt-1 bg-white/5 px-3 py-1 rounded-full border border-white/10"
            onClick={toggleStoreOpen}
          >
            <span className={`w-2 h-2 rounded-full ${storeSettings?.isOpen ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse' : 'bg-red-500'}`}></span>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{storeSettings?.isOpen ? 'Loja Aberta' : 'Loja Fechada'}</p>
          </button>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => setShowPix(!showPix)}
            className="w-10 h-10 bg-[#1E1E1E] rounded-xl flex items-center justify-center text-[#FF8C00] border border-white/10 shadow-lg active:scale-95"
          >
            <i className="fa-solid fa-qrcode"></i>
          </button>
          <button 
            onClick={() => signOut()}
            className="w-10 h-10 bg-[#1E1E1E] rounded-xl flex items-center justify-center text-red-500 border border-white/10 shadow-lg active:scale-95"
          >
            <i className="fa-solid fa-power-off"></i>
          </button>
        </div>
      </header>

      {/* ABAS DE NAVEGAÇÃO */}
      <div className="flex bg-[#1A1A1A] p-1.5 rounded-2xl mb-8 border border-white/5 overflow-x-auto custom-scrollbar gap-2">
        {[
          { id: 'pedidos', label: 'Pedidos', icon: 'fa-list-check' },
          { id: 'metricas', label: 'Métricas', icon: 'fa-chart-pie' },
          { id: 'carteira', label: 'Carteira', icon: 'fa-wallet' },
          { id: 'loja', label: 'Loja', icon: 'fa-store' },
          { id: 'cupons', label: 'Cupons', icon: 'fa-ticket' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`flex-1 min-w-[100px] py-3 rounded-xl flex items-center justify-center space-x-2 transition-all whitespace-nowrap ${tab === t.id ? 'bg-[#FF8C00] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <i className={`fa-solid ${t.icon} text-xs`}></i>
            <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
          </button>
        ))}
      </div>

      {/* MODAL PIX - Z-INDEX CORRIGIDO */}
      {showPix && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#1E1E1E] w-full max-w-xs rounded-[40px] p-8 border border-white/10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
            <h3 className="text-white font-black mb-6 uppercase tracking-widest text-sm">Meu PIX</h3>
            <div className="bg-white p-4 rounded-3xl inline-block mb-6 shadow-2xl">
              <img 
                src={`https://chart.googleapis.com/chart?cht=qr&chl=${profile?.chavePix}&chs=180x180&choe=UTF-8&chld=L|2`} 
                alt="PIX QR" 
                className="w-44 h-44"
              />
            </div>
            <p className="text-white font-black mb-8 break-all px-4 py-3 bg-black/40 rounded-xl border border-white/5 text-xs">{profile?.chavePix}</p>
            <button 
              onClick={() => setShowPix(false)}
              className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95"
            >
              Fechar Painel
            </button>
          </div>
        </div>
      )}

      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#1E1E1E] rounded-[40px] border border-white/5 shadow-2xl">
          <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mb-6">
            <i className="fa-solid fa-triangle-exclamation text-red-600 text-2xl sm:text-3xl"></i>
          </div>
          <p className="text-white font-bold mb-6 text-sm leading-relaxed">{error}</p>
          {isConfigError && (
            <a 
              href={`https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=${firebaseConfig.projectId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl"
            >
              Ativar Firestore
            </a>
          )}
        </div>
      ) : (
        <>
          {/* CONTEÚDO DA ABA: PEDIDOS */}
          {tab === 'pedidos' && (
            <div className="space-y-6 flex-1 overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Resumo Rápido no Topo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
                <div className="bg-[#1E1E1E] p-4 rounded-2xl border border-white/5">
                  <p className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-1">Fila</p>
                  <p className="text-2xl font-black text-white">{metrics.pedidosPendentes}</p>
                </div>
                <div className="bg-[#1E1E1E] p-4 rounded-2xl border border-white/5">
                  <p className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-1">Vendido Hoje</p>
                  <p className="text-2xl font-black text-[#FF8C00]">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.faturamentoBrutoHoje)}</p>
                </div>
              </div>

              <div className="flex justify-between items-center px-2 mt-6">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Fila de Produção</h2>
              </div>

              <ProductionQueue 
                orders={activeOrders} 
                onUpdateStatus={updateStatus} 
                onNotifyDriver={notifyDriver} 
                onNotifyPickup={notifyReadyForPickup}
                profile={profile}
                selectedOrderId={selectedOrder?.id}
                onDeleteOrder={handleDeleteOrder} // Passa a função de deletar
                onSelectOrder={setSelectedOrder}
              />
            </div>
          )}

          {/* CONTEÚDO DA ABA: MÉTRICAS */}
          <AnimatePresence>
            {tab === 'metricas' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 space-y-6">
                
                {/* META DIÁRIA (GAMIFICATION) */}
                <div className="bg-gradient-to-r from-[#1E1E1E] to-[#252525] p-6 rounded-[32px] border border-white/5 shadow-lg">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Meta Diária</p>
                      <h3 className="text-white font-black text-xl">R$ {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.faturamentoBrutoHoje)} <span className="text-gray-600 text-sm">/ {dailyGoal}</span></h3>
                    </div>
                    <p className="text-[#FF8C00] font-black text-lg">{Math.min(100, Math.round((metrics.faturamentoBrutoHoje / dailyGoal) * 100))}%</p>
                  </div>
                  <div className="h-3 bg-black/50 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-gradient-to-r from-[#FF8C00] to-[#FF4500] transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, (metrics.faturamentoBrutoHoje / dailyGoal) * 100)}%` }}></div>
                  </div>
                  <p className="text-gray-500 text-[10px] mt-2 text-right">{metrics.faturamentoBrutoHoje >= dailyGoal ? "🎉 Meta batida! Parabéns!" : `Faltam R$ ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dailyGoal - metrics.faturamentoBrutoHoje)} para a meta.`}</p>
                </div>

                {/* RELATÓRIO DE ITENS ESQUECIDOS (OPORTUNIDADE) */}
                {forgottenItems.length > 0 && (
                  <div className="bg-[#1E1E1E] p-6 rounded-[32px] border border-white/5 shadow-xl">
                    <h3 className="text-white font-bold mb-4 text-sm flex items-center">
                      <i className="fa-solid fa-ghost text-gray-500 mr-2"></i>
                      Lanches "Esquecidos" <span className="text-gray-600 text-[10px] ml-2 font-normal">(Sem vendas há 7 dias)</span>
                    </h3>
                    <div className="space-y-3">
                      {forgottenItems.map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5 hover:border-[#FF8C00]/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <img src={item.image} className="w-10 h-10 rounded-lg object-cover opacity-60 grayscale" alt={item.name} onError={handleImageError} />
                            <div>
                              <p className="text-gray-300 text-xs font-bold">{item.name}</p>
                              <p className="text-gray-600 text-[10px]">R$ {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}</p>
                            </div>
                          </div>
                          <button onClick={() => { setEditingItem(item); setShowItemForm(true); setTab('loja'); }} className="text-[#FF8C00] text-[9px] font-black uppercase tracking-widest hover:text-white transition-colors border border-[#FF8C00]/30 px-3 py-1.5 rounded-lg hover:bg-[#FF8C00] hover:border-[#FF8C00]">Criar Promoção</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <DailyMetrics metrics={metrics} onExport={handleExportDay} />
                
                {/* GRÁFICO DE VENDAS */}
                <div className="bg-[#1E1E1E] p-6 rounded-[32px] border border-white/5 shadow-xl">
                  <h3 className="text-white font-bold mb-6 text-sm flex items-center">
                    <i className="fa-solid fa-chart-column text-[#FF8C00] mr-2"></i>
                    Vendas da Semana
                  </h3>
                  <div className="h-64 w-full">
                  {/* AVALIAÇÃO DA LOJA */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex items-center gap-1 bg-[#FF8C00] text-white px-2 py-0.5 rounded-md font-bold text-xs">
                      <i className="fa-solid fa-star text-[10px]"></i> {shopRating.rating.toFixed(1)}
                    </span>
                    <p className="text-gray-400 text-xs">
                      Baseado em {shopRating.count} {shopRating.count === 1 ? 'avaliação' : 'avaliações'}.
                    </p>
                  </div>

                    <Bar 
                      data={metrics.chartData} 
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          tooltip: { 
                            backgroundColor: '#1A1A1A', 
                            titleColor: '#fff', 
                            bodyColor: '#FF8C00',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 10,
                            displayColors: false,
                            callbacks: {
                              label: (context) => `R$ ${context.parsed.y.toFixed(2)}`
                            }
                          }
                        },
                        scales: {
                          y: { 
                            beginAtZero: true, 
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#666', font: { size: 10 }, callback: (value) => `R$ ${value}` },
                            border: { display: false }
                          },
                          x: { 
                            grid: { display: false },
                            ticks: { color: '#888', font: { size: 10 } },
                            border: { display: false }
                          }
                        }
                      }} 
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CONTEÚDO DA ABA: CARTEIRA */}
          {tab === 'carteira' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 space-y-6">
              <div className="bg-gradient-to-br from-[#1E1E1E] to-black p-8 rounded-[40px] border border-white/10 text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF8C00]/10 rounded-full blur-3xl"></div>
                <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-2">Saldo Liberado</p>
                <h2 className="text-5xl font-black text-[#FF8C00] mb-6">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(wallet.liberado)}</h2>
                
                <div className="bg-white/5 rounded-2xl p-4 flex justify-between items-center border border-white/5 mb-6">
                  <div className="text-left">
                    <p className="text-gray-500 text-[9px] font-black uppercase tracking-widest">Saldo Retido</p>
                    <p className="text-white font-bold text-sm">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(wallet.retido)}</p>
                  </div>
                  <i className="fa-solid fa-lock text-gray-600"></i>
                </div>

                <button 
                  onClick={() => navigate('/withdraw')}
                  className="w-full bg-[#FF8C00] text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-[#e68a00]"
                >
                  <i className="fa-solid fa-money-bill-transfer"></i> SACAR AGORA
                </button>

                {/* GRÁFICO DE EVOLUÇÃO DO SALDO */}
                <div className="mt-8 h-40 w-full opacity-50 hover:opacity-100 transition-opacity">
                  <Line 
                    data={{
                      labels: wallet.chartLabels,
                      datasets: [{
                        label: 'Saldo Acumulado',
                        data: wallet.chartData,
                        borderColor: '#FF8C00',
                        backgroundColor: 'rgba(255, 140, 0, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 4,
                        pointBackgroundColor: '#fff'
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { display: false },
                        y: { 
                          display: false,
                          min: 0 
                        }
                      },
                      elements: { point: { hitRadius: 10 } }
                    }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center px-2">
                  <h3 className="text-gray-500 text-xs font-black uppercase tracking-widest">Histórico</h3>
                  <div className="flex space-x-2">
                    {['today', 'week', 'month'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setWalletFilter(f as any)}
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${walletFilter === f ? 'bg-[#FF8C00] text-white' : 'bg-white/5 text-gray-500'}`}
                      >
                        {f === 'today' ? 'Hoje' : f === 'week' ? '7 Dias' : 'Mês'}
                      </button>
                    ))}
                  </div>
                </div>

                {wallet.history.length === 0 ? (
                  <p className="text-gray-600 text-center text-xs py-8">Nenhuma transação neste período.</p>
                ) : (
                  wallet.history.map(order => (
                    <div key={order.id} className="bg-[#1E1E1E] p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                      <div>
                        <h4 className="text-white font-bold text-sm">Venda #{order.id.slice(-4)}</h4>
                        <p className="text-gray-600 text-[10px]">{new Date(order.createdAt?.toDate ? order.createdAt.toDate() : order.createdAt).toLocaleDateString('pt-BR')} às {new Date(order.createdAt?.toDate ? order.createdAt.toDate() : order.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                      </div>
                      <span className="text-green-500 font-black text-sm">+ {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.finalTotal || order.total || 0)}</span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* CONTEÚDO DA ABA: CUPONS */}
          {tab === 'cupons' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 space-y-8">
              {/* Formulário de Criação */}
              <div className="bg-[#1E1E1E] p-6 rounded-[32px] border border-white/10">
                <h3 className="text-white font-black uppercase text-[10px] tracking-[0.2em] mb-4 flex items-center">
                  <i className="fa-solid fa-ticket mr-2 text-[#FF8C00]"></i> Criar Promoção
                </h3>
                <form onSubmit={handleCreateCoupon} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-500 uppercase ml-2">Código do Cupom</label>
                    <div className="flex space-x-3">
                      <input 
                        placeholder="Ex: VERAO20" 
                        value={newCoupon.code}
                        onChange={e => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})}
                        className="flex-[2] bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-black uppercase outline-none focus:border-[#FF8C00] placeholder:text-gray-700"
                      />
                      <select 
                        value={newCoupon.type}
                        onChange={e => setNewCoupon({...newCoupon, type: e.target.value})}
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#FF8C00]"
                      >
                        <option value="percent">%</option>
                        <option value="fixed">R$</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex space-x-4">
                    <div className="flex-1 space-y-2">
                      <label className="text-[9px] font-black text-gray-500 uppercase ml-2">Desconto</label>
                      <input 
                        type="number" 
                        placeholder="0" 
                        value={newCoupon.discount}
                        onChange={e => setNewCoupon({...newCoupon, discount: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#FF8C00]"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="text-[9px] font-black text-gray-500 uppercase ml-2">Mínimo (R$)</label>
                      <input 
                        type="number" 
                        placeholder="0" 
                        value={newCoupon.minOrder}
                        onChange={e => setNewCoupon({...newCoupon, minOrder: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#FF8C00]"
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-[#FF8C00] text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95">Criar Cupom</button>
                </form>
              </div>

              {/* Lista de Cupons */}
              <div className="space-y-3">
                {coupons.map(coupon => (
                  <div key={coupon.id} className="bg-[#1E1E1E] p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                    <div>
                      <h4 className="text-white font-black text-lg tracking-widest">{coupon.code}</h4>
                      <p className="text-gray-500 text-xs">
                        {coupon.type === 'percent' ? `${coupon.discount}% OFF` : `R$ ${coupon.discount} OFF`} 
                        {coupon.minOrder > 0 && ` • Mín: R$ ${coupon.minOrder}`}
                      </p>
                    </div>
                    <button onClick={() => setConfirmModal({ isOpen: true, type: 'deleteCoupon', id: coupon.id })} className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                ))}
                {coupons.length === 0 && <p className="text-center text-gray-600 text-xs">Nenhum cupom ativo.</p>}
              </div>
            </motion.div>
          )}

          {/* CONTEÚDO DA ABA: LOJA */}
          {tab === 'loja' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 space-y-8">
              
              {/* IDENTIDADE DA LOJA (PERFIL) */}
              <div className="bg-[#1E1E1E] p-6 rounded-[32px] border border-white/5">
                <h3 className="text-white font-black uppercase text-[10px] tracking-[0.2em] mb-6 flex items-center">
                  <i className="fa-solid fa-store mr-2 text-[#FF8C00]"></i> Identidade da Loja
                </h3>
                
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Logo da Loja */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-24 h-24 rounded-full bg-black/40 border-2 border-white/10 overflow-hidden relative group">
                      {storeProfile.image && storeProfile.image.startsWith('http') ? (
                        <img src={storeProfile.image} alt="Logo" className="w-full h-full object-cover" onError={(e) => e.currentTarget.src = "https://cdn-icons-png.flaticon.com/512/3075/3075977.png"} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">{storeProfile.image || '🏪'}</div>
                      )}
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => { setIsStoreImageSearch(true); setShowImageSearch(true); }}>
                        <i className="fa-solid fa-camera text-white text-2xl"></i>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setIsStoreImageSearch(true); setShowImageSearch(true); }} 
                        className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all" 
                        title="Buscar Foto"
                      >
                        <i className="fa-brands fa-unsplash"></i>
                      </button>
                      <button 
                        onClick={() => { setIsStoreImageSearch(true); setShowIconSelector(true); }} 
                        className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all" 
                        title="Ícones"
                      >
                        <i className="fa-solid fa-icons"></i>
                      </button>
                      <button 
                        onClick={handleAutoGenerateStoreImage}
                        className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all" 
                        title="Gerar Automático"
                      >
                        <i className="fa-solid fa-wand-magic-sparkles"></i>
                      </button>
                    </div>
                    {/* Seleção Rápida de Emojis */}
                    <div className="flex gap-1">
                      {['🍕', '🍔', '🍦', '🥤'].map(emoji => <button key={emoji} onClick={() => setStoreProfile({...storeProfile, image: emoji})} className="text-lg hover:scale-125 transition-transform">{emoji}</button>)}
                    </div>
                  </div>

                  {/* Campos de Texto */}
                  <div className="flex-1 space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-500 uppercase ml-2">Nome da Loja</label>
                      <input 
                        value={storeProfile.nomeLoja}
                        onChange={(e) => setStoreProfile({...storeProfile, nomeLoja: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold outline-none focus:border-[#FF8C00]"
                        placeholder="Ex: Lanches do Zé"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-500 uppercase ml-2">Descrição (Bio)</label>
                      <input 
                        value={storeProfile.description}
                        onChange={(e) => setStoreProfile({...storeProfile, description: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#FF8C00]"
                        placeholder="O melhor lanche da cidade..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-500 uppercase ml-2">Endereço</label>
                      <input 
                        value={storeProfile.endereco}
                        onChange={(e) => setStoreProfile({...storeProfile, endereco: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#FF8C00]"
                        placeholder="Rua Principal, 123"
                      />
                    </div>
                    <button onClick={handleSaveStoreProfile} className="w-full bg-[#FF8C00] text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95">Salvar Alterações</button>
                  </div>
                </div>

                {/* SELETOR DE ÍCONES (STORE) - Lógica Adicionada */}
                {showIconSelector && isStoreImageSearch && (
                  <div className="bg-black/40 rounded-2xl p-4 border border-white/10 animate-in fade-in zoom-in duration-300 mt-4">
                    <h5 className="text-gray-400 text-[10px] font-bold uppercase mb-3">Ícones Rápidos</h5>
                    <div className="grid grid-cols-5 gap-3">
                      {GALLERY_ICONS.map((icon) => (
                        <button
                          key={icon.id}
                          type="button"
                          onClick={() => { setStoreProfile(prev => ({...prev, image: icon.url})); setShowIconSelector(false); }}
                          className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                        >
                          <img src={icon.url} alt={icon.label} className="w-8 h-8 object-contain" />
                          <span className="text-[9px] text-gray-400">{icon.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* BUSCA DE IMAGENS (UNSPLASH - STORE) - Lógica Adicionada */}
                {showImageSearch && isStoreImageSearch && (
                  <div className="bg-black/40 rounded-2xl p-4 border border-white/10 animate-in fade-in zoom-in duration-300 mt-4">
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-3 custom-scrollbar">
                      {['Lanches', 'Bebidas', 'Sobremesas', 'Pizzas', 'Açaí', 'Sushi'].map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => searchUnsplashImages(1, cat)}
                          className="px-3 py-1 bg-white/5 hover:bg-[#FF8C00] rounded-full text-[10px] font-bold uppercase transition-colors whitespace-nowrap text-gray-300 hover:text-white border border-white/5"
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <div className="flex space-x-2 mb-4">
                      <input 
                        value={imageSearchQuery}
                        onChange={(e) => setImageSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchUnsplashImages(1))}
                        placeholder="Ex: Hambúrguer, Pizza, Suco..."
                        className="flex-1 bg-[#1E1E1E] border border-white/10 rounded-xl px-4 py-2 text-white text-xs outline-none focus:border-[#FF8C00]"
                      />
                      <button type="button" onClick={() => searchUnsplashImages(1)} className="bg-[#FF8C00] text-white px-4 rounded-xl font-bold text-xs">Buscar</button>
                    </div>
                    <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                      {imageSearchResults.map((img: any) => (
                        <div key={img.id} onClick={() => handleSelectUnsplashImage(img.urls.regular)} className="cursor-pointer aspect-square rounded-lg overflow-hidden border border-white/5 hover:border-[#FF8C00] transition-all relative group">
                          <img src={img.urls.small} alt={img.alt_description} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i className="fa-solid fa-check text-white"></i></div>
                        </div>
                      ))}
                    </div>
                    {imageSearchResults.length > 0 && (
                      <button type="button" onClick={() => searchUnsplashImages(unsplashPage + 1)} className="w-full mt-3 bg-white/5 text-white py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-colors">Carregar Mais</button>
                    )}
                  </div>
                )}

                <StorePreview profile={storeProfile} storeSettings={storeSettings} isKitchenBusy={isKitchenBusy} />
              </div>
              
              {/* Configurações Rápidas */}
              <div className="bg-[#1E1E1E] p-6 rounded-[32px] border border-white/5">
                <h3 className="text-white font-black uppercase text-[10px] tracking-[0.2em] mb-4 flex items-center">
                  <i className="fa-solid fa-sliders mr-2 text-[#FF8C00]"></i> Configurações
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase">Status</label>
                    <button 
                      onClick={toggleStoreOpen}
                      className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${storeSettings?.isOpen ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'bg-red-600 text-white shadow-lg shadow-red-600/20'}`}
                    >
                      {storeSettings?.isOpen ? 'ABERTA' : 'FECHADA'}
                    </button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase">Cozinha</label>
                    <button 
                      onClick={toggleKitchenBusy}
                      className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${isKitchenBusy ? 'bg-red-500 text-white animate-pulse' : 'bg-[#1E1E1E] border border-white/10 text-gray-400'}`}
                    >
                      {isKitchenBusy ? '🔥 ALTA DEMANDA ATIVA' : 'Normal'}
                    </button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase">Entrega</label>
                    <input 
                      placeholder="Ex: 30-40 min"
                      defaultValue={storeSettings?.deliveryTime}
                      onBlur={(e) => updateDoc(doc(db, 'users', profile!.uid), { deliveryTime: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-bold outline-none focus:border-[#FF8C00]"
                    />
                  </div>
                </div>

                <BusinessHours hours={businessHours} setHours={setBusinessHours} />
              </div>

              {/* Gerenciamento de Cardápio */}
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 px-2 gap-4">
                  <h3 className="text-white font-black uppercase text-[10px] tracking-[0.2em]">
                    <i className="fa-solid fa-utensils mr-2 text-[#FF8C00]"></i> Cardápio
                  </h3>
                  
                  <div className="flex w-full sm:w-auto gap-2">
                    <div className="relative flex-1 sm:w-64">
                      <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
                      <input 
                        value={menuSearch}
                        onChange={(e) => setMenuSearch(e.target.value)}
                        placeholder="Buscar produto..."
                        className="w-full bg-[#1E1E1E] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-white text-xs outline-none focus:border-[#FF8C00]"
                      />
                    </div>
                    <button 
                      onClick={() => { setEditingItem(null); setShowItemForm(true); }}
                      className="bg-[#FF8C00] text-white w-8 h-8 rounded-lg flex items-center justify-center shadow-lg active:scale-95 shrink-0"
                    >
                      <i className="fa-solid fa-plus"></i>
                    </button>
                  </div>
                </div>
                
                {showItemForm && (
                  <div className="bg-[#1E1E1E] p-6 sm:p-8 rounded-[32px] border border-white/10 mb-6 animate-in fade-in zoom-in duration-300 shadow-2xl relative overflow-hidden">
                    {/* Background Glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF8C00]/5 rounded-full blur-3xl -z-10"></div>

                    <h4 className="text-white font-black text-xl mb-6 flex items-center">
                      <i className="fa-solid fa-burger text-[#FF8C00] mr-3"></i>
                      {editingItem ? 'Editar Lanche' : 'Novo Lanche Premium'}
                    </h4>

                    <form onSubmit={handleSaveItem} className="space-y-6">
                      {/* Row 1: Name & Category */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome do Lanche <span className="text-red-500">*</span></label>
                          <input name="name" defaultValue={editingItem?.name} placeholder="Ex: X-Bacon Supremo" required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold outline-none focus:border-[#FF8C00] focus:shadow-[0_0_15px_rgba(255,140,0,0.3)] transition-all placeholder:text-gray-700" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Categoria <span className="text-red-500">*</span></label>
                          <select name="category" defaultValue={editingItem?.category || 'Lanches'} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold outline-none focus:border-[#FF8C00] focus:shadow-[0_0_15px_rgba(255,140,0,0.3)] transition-all appearance-none cursor-pointer">
                            <option value="Lanches">🍔 Lanches</option>
                            <option value="Bebidas">🥤 Bebidas</option>
                            <option value="Porções">🍟 Porções</option>
                            <option value="Sobremesas">🍰 Sobremesas</option>
                            <option value="Combos">🍱 Combos</option>
                            <option value="Pizzas">🍕 Pizzas</option>
                            <option value="Açaí">🍧 Açaí</option>
                            <option value="Sushi">🍣 Sushi</option>
                          </select>
                        </div>
                      </div>

                      {/* Row 2: Description */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Descrição Detalhada</label>
                        <textarea name="description" defaultValue={editingItem?.description} placeholder="Descreva os ingredientes deliciosos..." rows={3} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#FF8C00] focus:shadow-[0_0_15px_rgba(255,140,0,0.3)] transition-all placeholder:text-gray-700 resize-none" />
                      </div>

                      {/* Row 3: Prices & Time */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Preço Original (R$) <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">R$</span>
                            <input name="price" type="number" step="0.01" defaultValue={editingItem?.price} placeholder="0.00" required className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm font-bold outline-none focus:border-[#FF8C00] focus:shadow-[0_0_15px_rgba(255,140,0,0.3)] transition-all" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-green-500 uppercase tracking-widest ml-1">Preço Promo (Opcional)</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500/50 text-xs font-bold">R$</span>
                            <input name="promoPrice" type="number" step="0.01" defaultValue={editingItem?.promoPrice} placeholder="0.00" className="w-full bg-black/40 border border-green-500/30 rounded-xl pl-10 pr-4 py-3 text-green-400 text-sm font-bold outline-none focus:border-green-500 focus:shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all placeholder:text-green-500/20" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tempo Preparo (min)</label>
                          <div className="relative">
                            <i className="fa-solid fa-clock absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
                            <input name="prepTime" type="number" defaultValue={editingItem?.prepTime || '20'} placeholder="Minutos" className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm font-bold outline-none focus:border-[#FF8C00] focus:shadow-[0_0_15px_rgba(255,140,0,0.3)] transition-all" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Row 4: Image & Availability */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Foto do Produto</label>
                          <div className="flex gap-2">
                             {/* Preview */}
                             <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 overflow-hidden shrink-0">
                               {imageUrl ? (
                                 <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                               ) : (
                                 <div className="w-full h-full flex items-center justify-center text-gray-600"><i className="fa-solid fa-image"></i></div>
                               )}
                             </div>
                             <div className="flex-1 flex gap-2">
                                <input name="image" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImageDeleteUrl(''); }} placeholder="Cole o link ou use os botões..." className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-xs outline-none focus:border-[#FF8C00]" />
                                
                                {/* Botão Unsplash (Produto) */}
                                <button type="button" onClick={() => { setIsStoreImageSearch(false); setShowImageSearch(!showImageSearch); setShowIconSelector(false); }} className={`w-10 bg-white/5 rounded-xl flex items-center justify-center text-white hover:bg-white/10 transition-all border border-white/5 ${showImageSearch ? 'border-[#FF8C00] text-[#FF8C00]' : ''}`} title="Buscar no Unsplash"><i className="fa-brands fa-unsplash"></i></button>
                                
                                {/* Botão Ícones (Produto) */}
                                <button type="button" onClick={() => { setIsStoreImageSearch(false); setShowIconSelector(!showIconSelector); setShowImageSearch(false); }} className={`w-10 bg-white/5 rounded-xl flex items-center justify-center text-white hover:bg-white/10 transition-all border border-white/5 ${showIconSelector ? 'border-[#FF8C00] text-[#FF8C00]' : ''}`} title="Ícones Prontos"><i className="fa-solid fa-icons"></i></button>
                                
                                {/* Botão Upload */}
                                <label className={`w-10 rounded-xl flex items-center justify-center border border-white/5 cursor-pointer transition-all ${uploading ? 'bg-white/5' : 'bg-[#FF8C00]/10 text-[#FF8C00] hover:bg-[#FF8C00]/20'}`} title="Upload Imagem">
                                  {uploading ? <i className="fa-solid fa-circle-notch fa-spin text-[10px]"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}
                                  <input type="file" accept="image/*" onChange={onFileSelect} className="hidden" disabled={uploading} />
                                </label>
                             </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Disponibilidade</label>
                           <div className="flex items-center gap-4 bg-black/40 border border-white/10 rounded-xl p-2 px-4 h-[50px]">
                              <span className={`text-xs font-bold ${isAvailable ? 'text-green-500' : 'text-gray-500'}`}>{isAvailable ? 'ATIVO NO CARDÁPIO' : 'INDISPONÍVEL'}</span>
                              <button type="button" onClick={() => setIsAvailable(!isAvailable)} className={`ml-auto w-12 h-6 rounded-full relative transition-colors ${isAvailable ? 'bg-green-500' : 'bg-gray-600'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isAvailable ? 'left-7' : 'left-1'}`}></div>
                              </button>
                           </div>
                        </div>
                      </div>

                      {/* SELETOR DE ÍCONES (NOVO) */}
                      {showIconSelector && !isStoreImageSearch && (
                        <div className="bg-black/40 rounded-2xl p-4 border border-white/10 animate-in fade-in zoom-in duration-300">
                          <h5 className="text-gray-400 text-[10px] font-bold uppercase mb-3">Ícones Rápidos</h5>
                          <div className="grid grid-cols-5 gap-3">
                            {GALLERY_ICONS.map((icon) => (
                              <button
                                key={icon.id}
                                type="button"
                                onClick={() => { if(isStoreImageSearch) { setStoreProfile(prev => ({...prev, image: icon.url})); } else { setImageUrl(icon.url); } setShowIconSelector(false); }}
                                className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                              >
                                <img src={icon.url} alt={icon.label} className="w-8 h-8 object-contain" />
                                <span className="text-[9px] text-gray-400">{icon.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* BUSCA DE IMAGENS (UNSPLASH) */}
                      {showImageSearch && !isStoreImageSearch && (
                        <div className="bg-black/40 rounded-2xl p-4 border border-white/10 animate-in fade-in zoom-in duration-300">
                          
                          {/* Filtros de Categoria */}
                          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 custom-scrollbar">
                            {['Lanches', 'Bebidas', 'Sobremesas', 'Pizzas', 'Açaí', 'Sushi'].map(cat => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => searchUnsplashImages(1, cat)}
                                className="px-3 py-1 bg-white/5 hover:bg-[#FF8C00] rounded-full text-[10px] font-bold uppercase transition-colors whitespace-nowrap text-gray-300 hover:text-white border border-white/5"
                              >
                                {cat}
                              </button>
                            ))}
                          </div>

                          <div className="flex space-x-2 mb-4">
                            <input 
                              value={imageSearchQuery}
                              onChange={(e) => setImageSearchQuery(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchUnsplashImages(1))}
                              placeholder="Ex: Hambúrguer, Pizza, Suco..."
                              className="flex-1 bg-[#1E1E1E] border border-white/10 rounded-xl px-4 py-2 text-white text-xs outline-none focus:border-[#FF8C00]"
                            />
                            <button 
                              type="button" 
                              onClick={() => searchUnsplashImages(1)}
                              className="bg-[#FF8C00] text-white px-4 rounded-xl font-bold text-xs"
                            >
                              Buscar
                            </button>
                          </div>
                          <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                            {imageSearchResults.map((img: any) => (
                              <div key={img.id} onClick={() => handleSelectUnsplashImage(img.urls.regular)} className="cursor-pointer aspect-square rounded-lg overflow-hidden border border-white/5 hover:border-[#FF8C00] transition-all relative group">
                                <img src={img.urls.small} alt={img.alt_description} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i className="fa-solid fa-check text-white"></i></div>
                              </div>
                            ))}
                          </div>
                          {imageSearchResults.length > 0 && (
                            <button 
                              type="button"
                              onClick={() => searchUnsplashImages(unsplashPage + 1)}
                              className="w-full mt-3 bg-white/5 text-white py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
                            >
                              Carregar Mais
                            </button>
                          )}
                        </div>
                      )}

                      {/* SEÇÃO DE ADICIONAIS */}
                      <div className="border-t border-white/10 pt-4 mt-4">
                        <div className="flex justify-between items-center mb-3">
                          <label className="text-[9px] font-black text-gray-500 uppercase">Adicionais (Opcional)</label>
                          <button type="button" onClick={addAddonField} className="text-[#FF8C00] text-[10px] font-bold uppercase hover:text-white transition-colors">+ Adicionar Opção</button>
                        </div>
                        
                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                          {currentAddons.map((addon, index) => (
                            <div key={index} className="flex space-x-2 items-center">
                              <input 
                                placeholder="Ex: Bacon Extra" 
                                value={addon.name}
                                onChange={(e) => updateAddonField(index, 'name', e.target.value)}
                                className="flex-[2] bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-[#FF8C00]"
                              />
                              <input 
                                type="number" 
                                placeholder="R$ 0,00" 
                                value={addon.price}
                                onChange={(e) => updateAddonField(index, 'price', e.target.value)}
                                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-[#FF8C00]"
                              />
                              <button type="button" onClick={() => removeAddonField(index)} className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-colors">
                                <i className="fa-solid fa-trash text-xs"></i>
                              </button>
                            </div>
                          ))}
                          {currentAddons.length === 0 && (
                            <p className="text-gray-600 text-xs text-center py-2 italic">Nenhum adicional configurado.</p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-4 pt-4 border-t border-white/5">
                        <button type="button" onClick={() => setShowItemForm(false)} className="flex-1 py-4 bg-white/5 text-gray-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all">Cancelar</button>
                        <button type="submit" className="flex-1 py-4 bg-[#FF8C00] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(255,140,0,0.3)] hover:shadow-[0_0_30px_rgba(255,140,0,0.5)] active:scale-95 transition-all">Salvar Lanche</button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="space-y-8">
                  {menuItems.length === 0 ? (
                    <p className="text-gray-600 text-center text-xs py-8">Nenhum item no cardápio.</p>
                  ) : (
                    Array.from(new Set(menuItems.map(item => item.category || 'Geral'))).sort().map(category => (
                      <div key={category}>
                        <h5 className="text-gray-500 font-black text-[10px] uppercase tracking-widest mb-4 pl-2 border-l-2 border-[#FF8C00]">{category}</h5>
                        <div className="space-y-3">
                          {menuItems
                            .filter(item => (item.category || 'Geral') === category)
                            .filter(item => item.name.toLowerCase().includes(menuSearch.toLowerCase()))
                            .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                            .map(item => (
                            <div 
                              key={item.id} 
                              draggable
                              onDragStart={() => handleDragStart(item)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, item)}
                              className={`bg-[#1E1E1E] p-4 rounded-2xl border border-white/5 flex items-center space-x-4 cursor-move transition-all ${draggedItem?.id === item.id ? 'opacity-50 border-[#FF8C00] border-dashed' : 'hover:border-[#FF8C00]/30'}`}
                            >
                              <img src={item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover bg-black/20" onError={handleImageError} />
                              <div className="flex-1 min-w-0">
                                <h4 className="text-white font-bold text-sm truncate">{item.name}</h4>
                                <div className="flex items-center gap-2">
                                  <p className={`${item.promoPrice ? 'text-gray-500 line-through text-[10px]' : 'text-[#FF8C00] font-black text-xs'}`}>
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                                  </p>
                                  {item.promoPrice && (
                                    <p className="text-green-500 font-black text-xs">
                                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.promoPrice)}
                                    </p>
                                  )}
                                </div>
                                <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded ${item.isAvailable ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                                  {item.isAvailable ? 'Em Estoque' : 'Esgotado'}
                                </span>
                              </div>
                              <button 
                                onClick={() => toggleAvailability(item)}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${item.isAvailable ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'}`}
                                title={item.isAvailable ? "Pausar Venda" : "Ativar Venda"}
                              >
                                <i className={`fa-solid ${item.isAvailable ? 'fa-toggle-on' : 'fa-toggle-off'} text-xl`}></i>
                              </button>
                              <div className="flex flex-col space-y-2">
                                <button 
                                  onClick={() => { setEditingItem(item); setShowItemForm(true); }}
                                  className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-gray-400 hover:text-white"
                                  title="Editar"
                                >
                                  <i className="fa-solid fa-pen text-xs"></i>
                                </button>
                                <button 
                                  onClick={() => handleDuplicateItem(item)}
                                  className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500 hover:bg-blue-500 hover:text-white transition-colors"
                                  title="Duplicar"
                                >
                                  <i className="fa-solid fa-copy text-xs"></i>
                                </button>
                                <button 
                                  onClick={() => setConfirmModal({ isOpen: true, type: 'deleteItem', id: item.id })}
                                  className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                                  title="Excluir"
                                >
                                  <i className="fa-solid fa-trash text-xs"></i>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* MODAL DE CROP */}
      {cropImageSrc && (
        <div className="fixed inset-0 z-[300] bg-black/90 flex flex-col animate-in fade-in duration-300">
          <div className="relative flex-1 bg-[#1E1E1E]">
            <Cropper
              image={cropImageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1} // Quadrado (1:1)
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div className="p-6 bg-[#1E1E1E] border-t border-white/10 flex flex-col space-y-4">
            <div className="flex items-center space-x-4">
              <i className="fa-solid fa-magnifying-glass-minus text-gray-500"></i>
              <input 
                type="range" 
                value={zoom} 
                min={1} max={3} step={0.1} 
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-[#FF8C00] h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <i className="fa-solid fa-magnifying-glass-plus text-gray-500"></i>
            </div>
            <div className="flex space-x-3">
              <button onClick={() => setCropImageSrc(null)} className="flex-1 py-4 bg-white/5 rounded-2xl font-black uppercase text-xs text-gray-400">Cancelar</button>
              <button onClick={handleCropConfirm} className="flex-1 py-4 bg-[#FF8C00] rounded-2xl font-black uppercase text-xs text-white shadow-lg">Confirmar Recorte</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO GENÉRICO */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: null, id: null })}
        onConfirm={() => {
          if (confirmModal.type === 'deleteItem' && confirmModal.id) handleDeleteItem(confirmModal.id);
          if (confirmModal.type === 'deleteCoupon' && confirmModal.id) handleDeleteCoupon(confirmModal.id);
          if (confirmModal.type === 'deleteOrder') confirmDeleteOrder();
        }}
        title={confirmModal.type === 'deleteItem' ? "Excluir Produto?" : confirmModal.type === 'deleteCoupon' ? "Excluir Cupom?" : "Excluir Pedido?"}
        message={confirmModal.type === 'deleteItem' ? "Esta ação removerá o item do seu cardápio permanentemente. Tem certeza?" : confirmModal.type === 'deleteCoupon' ? "O cupom deixará de funcionar imediatamente para novos pedidos." : "Tem certeza que deseja excluir este pedido permanentemente? Esta ação não pode ser desfeita."}
        cancelText="Cancelar"
        variant="danger"
      />

      {/* MODAL DE DETALHES DO PEDIDO (CONTROLE REMOTO) */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="fixed top-0 right-0 bottom-0 w-full max-w-md z-50">
            <SellerOrderDetailPanel order={selectedOrder} onClose={() => setSelectedOrder(null)} onUpdateStatus={updateStatus} onVerifyPin={verifyPinWithCloudFunction} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;

// --- FUNÇÕES UTILITÁRIAS PARA CROP (Adicione ao final do arquivo) ---

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous') 
    image.src = url
  })

async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<Blob> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) throw new Error('No 2d context')

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas is empty'))
    }, 'image/jpeg', 0.9) // Qualidade 90%
  })
}
