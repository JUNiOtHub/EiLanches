import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { db, collection, serverTimestamp, onSnapshot, doc, getDocs, query, where, updateDoc } from '../firebase';
import { limit, orderBy } from 'firebase/firestore';
import { paymentService } from '../services/paymentService';
import { createOrderDocument } from '../services/orderService';
import { calculateOrderValues } from '../utils/financial';

// --- CONFIGURAÇÕES DE NEGÓCIO VIA .ENV ---
const MIN_ORDER = Number(import.meta.env.VITE_PEDIDO_MINIMO) || 15.00;
const FRETE_BASE = Number(import.meta.env.VITE_FRETE_BASE) || 5.00;
const KM_LIMITE_BASE = Number(import.meta.env.VITE_KM_LIMITE_BASE) || 2.0;
const VALOR_KM_ADICIONAL = Number(import.meta.env.VITE_VALOR_KM_ADICIONAL) || 0.50;
const TAXA_SERVICO = Number(import.meta.env.VITE_TAXA_SERVICO_APP) || 1.50;
const TEMPO_PREPARO_BASE = Number(import.meta.env.VITE_TEMPO_PREPARO_BASE) || 20; // Tempo base em minutos

// Configuração de ícones do Leaflet
const iconUrl = 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png';
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png';
const customIcon = new L.Icon({ iconUrl, iconRetinaUrl, shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });

// Função para calcular distância (Haversine)
const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Raio da terra em km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Funções de Mascaramento de Segurança (LGPD) – uso em UI e Firestore
const maskIdentity = (doc: string) => {
  if (!doc || typeof doc !== 'string') return '***';
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11) return `***.***.${clean.slice(6, 9)}-**`; // CPF
  return clean.length > 4 ? `***${clean.slice(-4)}` : '***'; // CNPJ/outros
};
/** Telefone: apenas últimos 4 dígitos no Firestore (coleção pública). */
const maskPhoneForStorage = (phone: string) => {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 4 ? `***${digits.slice(-4)}` : '***';
};

const Cart: React.FC = () => {
  const { items, updateQuantity, total, clearCart, addToCart } = useCart();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  
  // Inicializa dados do perfil para facilitar o checkout
  const [address, setAddress] = useState(profile?.endereco || '');
  const [customerName, setCustomerName] = useState(profile?.nome || '');
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [deliveryTime, setDeliveryTime] = useState('now');
  const [scheduledTime, setScheduledTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [pixData, setPixData] = useState<{ encodedImage: string; payload: string } | null>(null);
  const [showPixModal, setShowPixModal] = useState(false);
  const [showMinOrderModal, setShowMinOrderModal] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<'delivery' | 'pickup'>('delivery');
  const [upsellItems, setUpsellItems] = useState<any[]>([]);
  const [isAutoFinishing, setIsAutoFinishing] = useState(false);
  const [upsellAccepted, setUpsellAccepted] = useState(false); // Métrica: conversão de upsell
  
  const [customerLocation, setCustomerLocation] = useState<[number, number] | null>(null);
  const [shopLocation, setShopLocation] = useState<[number, number] | null>(null);
  const [calculatedDistance, setCalculatedDistance] = useState(0.5); // Default 500m
  const [isShopBusy, setIsShopBusy] = useState(false); // Estado de Alta Demanda

  const shopId = items.length > 0 ? items[0].shopId : null;
  const shopName = items.length > 0 ? items[0].shopName : null;

  useEffect(() => {
    if (!orderId || !db) return;

    const unsub = onSnapshot(doc(db, 'pedidos', orderId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const newStatus = data.status;
        // Dispara notificação local se o status mudou e o app está em primeiro plano
        if (currentStatus && newStatus !== currentStatus) {
          if (newStatus === 'pronto_retirada') {
            toast("Seu pedido está pronto! Pode vir buscar.", { icon: '🛍️', duration: 6000 });
            // Tenta notificação do navegador
            if (Notification.permission === 'granted') {
              new Notification("EiLanches: Pedido Pronto!", { body: "Seu pedido está aguardando retirada no balcão." });
            }
          } else if (newStatus === 'preparando') {
            toast("A cozinha começou a preparar seu pedido!", { icon: '👨‍🍳' });
          } else if (newStatus === 'entrega') {
            toast("Saiu para entrega! Acompanhe no mapa.", { icon: '🛵' });
          }
        }
        setCurrentStatus(newStatus);
      }
    });

    return () => unsub();
  }, [orderId]);

  // Monitora status de Alta Demanda da Loja
  useEffect(() => {
    if (!shopId) return;
    const unsubShop = onSnapshot(doc(db, 'users', shopId), (doc) => {
      if (doc.exists()) {
        setIsShopBusy(doc.data().isKitchenBusy || false);
      }
    });
    return () => unsubShop();
  }, [shopId]);

  // Efeito para finalizar automaticamente após o Upsell
  useEffect(() => {
    if (isAutoFinishing && total >= MIN_ORDER) {
      setIsAutoFinishing(false);
      handleFinishOrder();
    }
  }, [total, isAutoFinishing]);

  // CÁLCULO VISUAL DINÂMICO PARA O RESUMO
  // Movi para o topo para evitar erro de "Rendered fewer hooks"
  const currentValues = useMemo(() => {
    let frete = 0;
    if (deliveryMode === 'delivery') {
      if (calculatedDistance <= KM_LIMITE_BASE) {
        frete = FRETE_BASE;
      } else {
        frete = FRETE_BASE + ((calculatedDistance - KM_LIMITE_BASE) * VALOR_KM_ADICIONAL);
      }
    }
    const taxa = TAXA_SERVICO;
    const desconto = appliedCoupon ? (appliedCoupon.type === 'percent' ? (total * appliedCoupon.discount / 100) : appliedCoupon.discount) : 0;
    const final = total - desconto + frete + taxa;

    return { frete, taxaProcessamento: taxa, descontoAplicado: desconto, totalCliente: final, message: null };
  }, [total, appliedCoupon, calculatedDistance, deliveryMode]);

  // CÁLCULO DE ESTIMATIVAS (DISTÂNCIA E TEMPO)
  const deliveryEstimates = useMemo(() => {
    const dist = calculatedDistance;
    // Formatação de Distância: < 1km mostra metros, > 1km mostra km
    const distanceDisplay = dist < 1 
      ? `${Math.round(dist * 1000)}m` 
      : `${dist.toFixed(1).replace('.', ',')} km`;

    // Lógica de Tempo Inteligente
    // 1. Tempo de Preparo: Base + (5 min por item extra)
    const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
    const tempoPorItemExtra = 5;
    const tempoPreparo = TEMPO_PREPARO_BASE + (Math.max(0, totalItems - 1) * tempoPorItemExtra);

    // 2. Tempo de Deslocamento: 3 min por KM
    const tempoDeslocamento = Math.ceil(dist * 3);

    // 3. Adicional de Alta Demanda (+15 min)
    const adicionalDemanda = isShopBusy ? 15 : 0;

    const totalMinutos = tempoPreparo + tempoDeslocamento + adicionalDemanda;
    return { distanceDisplay, timeDisplay: `${totalMinutos}-${totalMinutos + 10} min` };
  }, [calculatedDistance, items, isShopBusy]);

  const handleApplyCoupon = async () => {
    if (!shopId || !couponInput.trim()) return;
    
    // BLOQUEIO DE CUPONS EM ALTA DEMANDA
    if (isShopBusy) {
      toast.error("Cupons indisponíveis: Loja em Alta Demanda!", { icon: '🔥' });
      return;
    }

    try {
      const q = query(
        collection(db, 'users', shopId, 'coupons'),
        where('code', '==', couponInput.toUpperCase().trim()),
        where('active', '==', true)
      );
      
      const snap = await getDocs(q);
      
      if (snap.empty) {
        toast.error("Cupom inválido ou não encontrado.");
        setDiscount(0);
        setAppliedCoupon(null);
        return;
      }

      const coupon = snap.docs[0].data();
      
      if (total < (coupon.minOrder || 0)) {
        toast.error(`Pedido mínimo para este cupom: R$ ${coupon.minOrder}`);
        return;
      }

      // Assumimos que cupons buscados aqui são da loja
      const couponData = { ...coupon, id: snap.docs[0].id, source: 'shop' };

      // Validação prévia com a IA Financeira para evitar surpresas
      const validation = calculateOrderValues(total, couponData);
      if (validation.error) {
        toast.error(validation.error, { icon: '🛡️' });
        return;
      }

      setAppliedCoupon(couponData);
      toast.success("Cupom aplicado com sucesso!");
    } catch (e) { toast.error("Erro ao validar cupom."); }
  };

  const handleFinishOrder = async () => {
    if (!customerName.trim() || !address.trim()) {
      toast.error('Confirme seu nome e endereço de entrega.');
      return;
    }

    if (!shopId || !shopName || !user || !db) return;

    setIsOrdering(true);

    // Verifica Pedido Mínimo
    if (total < MIN_ORDER) {
      const missing = MIN_ORDER - total;
      
      // Lógica de Upselling Inteligente: Busca o item mais barato que cobre a diferença
      try {
        const q = query(
          collection(db, 'users', shopId, 'cardapio'),
          where('price', '>=', missing),
          where('isAvailable', '==', true),
          orderBy('price', 'asc'),
          limit(3) // Busca até 3 opções para o cliente escolher
        );
        
        const snap = await getDocs(q);
        if (!snap.empty) {
          setUpsellItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
          setUpsellItems([]);
        }
      } catch { setUpsellItems([]); }

      setShowMinOrderModal(true);
      setIsOrdering(false);
      return;
    }

    try {
      // CÁLCULO DE FRETE DINÂMICO (.ENV)
      let freteCalculado = 0;
      if (deliveryMode === 'delivery') {
        if (calculatedDistance <= KM_LIMITE_BASE) {
          freteCalculado = FRETE_BASE;
        } else {
          freteCalculado = FRETE_BASE + ((calculatedDistance - KM_LIMITE_BASE) * VALOR_KM_ADICIONAL);
        }
      }

      // Recalcula valores finais usando as variáveis do .ENV
      // Nota: Mantemos a estrutura do calculateOrderValues mas sobrescrevemos com a lógica do .env
      const baseValues = calculateOrderValues(total, appliedCoupon, calculatedDistance, deliveryMode);
      const values = { ...baseValues };
      values.frete = freteCalculado;
      values.taxaProcessamento = TAXA_SERVICO;
      values.totalCliente = total - values.descontoAplicado + values.frete + values.taxaProcessamento;
      values.receberLojista = total - values.descontoAplicado - values.lucroApp; // Simplificado para manter consistência

      // Cálculo de Pontos de Fidelidade (1 ponto a cada R$ 1,00)
      const pointsEarned = Math.floor(values.totalCliente);

      const deliverySchedule = deliveryTime === 'now' ? 'Imediata' : `Agendada para ${scheduledTime}`;

      const pedidoData = {
        clienteUid: user.uid,
        lojaId: shopId,
        lojaNome: shopName,
        clienteNome: customerName,
        clienteDocumentoMasked: maskIdentity(profile?.documento || ''), // LGPD: só versão mascarada no Firestore
        clienteTelefone: maskPhoneForStorage(profile?.telefone || ''), // LGPD: só sufixo no Firestore (número completo só no Asaas)
        endereco: address,
        location: customerLocation ? { lat: customerLocation[0], lng: customerLocation[1] } : null, // Salva coordenadas
        distanceKm: calculatedDistance,
        itens: items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
        subtotal: total, // Valor original dos produtos
        discount: values.descontoAplicado,
        deliveryFee: values.frete, // Valor cobrado do cliente
        driverFee: values.receberEntregador,
        serviceFee: values.taxaProcessamento,
        finalTotal: values.totalCliente,
        appFee: values.lucroApp,
        netValue: values.receberLojista,
        bankFee: values.bankFee,
        statusPagamentoLoja: 'bloqueado', // Saldo da loja retido
        statusPagamentoEntregador: 'bloqueado', // Saldo do entregador retido
        avaliado: false, // Controle para o sistema de reputação
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        paymentMethod: paymentMethod,
        status: 'pendente',
        deliveryMode: deliveryMode, // Salva se é entrega ou retirada
        deliverySchedule: deliverySchedule,
        loyaltyPointsEarned: pointsEarned,
        upsellAccepted: upsellAccepted, // Métrica para taxa de conversão no Dashboard
        createdAt: serverTimestamp()
      };

      const novoPedidoId = await createOrderDocument(pedidoData as Record<string, unknown>);

      // Crédito na carteira do lojista (saldo pendente) é feito pela Cloud Function onOrderCreatedCreditWallet ao criar o pedido

      // Pagamento via Service Layer (abstração: hoje Asaas PIX, amanhã outro provider)
      if (paymentMethod === 'pix') {
        const result = await paymentService.process({
          orderId: novoPedidoId,
          totalAmount: values.totalCliente,
          netStoreAmount: values.receberLojista,
          customer: {
            nome: customerName,
            email: user.email ?? '',
            documento: profile?.documento ?? undefined,
            telefone: profile?.telefone ?? undefined,
          },
          method: 'pix',
        });

        if (!result.success) {
          await updateDoc(doc(db, 'pedidos', novoPedidoId), { status: 'falha_pagamento' });
          const msg = result.error?.includes('Failed to fetch')
            ? "Erro de conexão (CORS). Em localhost, use extensão 'Allow CORS' ou proxy."
            : result.error || "Erro ao gerar PIX. O pedido foi registrado como falha de pagamento.";
          toast.error(msg);
          setIsOrdering(false);
          return;
        }
        if (result.paymentId) {
          await updateDoc(doc(db, 'pedidos', novoPedidoId), { asaasPaymentId: result.paymentId });
        }
        if (result.pixQrCode) {
          setPixData(result.pixQrCode);
          setShowPixModal(true);
        }
      }

      toast.success(`Pedido enviado! Você ganhou ${pointsEarned} pontos de fidelidade.`, { icon: '🎉', duration: 5000 });
      setOrderId(novoPedidoId);
      setIsOrdering(false);
    } catch {
      setIsOrdering(false);
      toast.error("Falha ao enviar pedido. Verifique sua conexão.");
    }
  };

  // Modal de Pagamento PIX
  if (showPixModal && pixData) {
    return (
      <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="bg-[#1E1E1E] w-full max-w-sm rounded-[40px] p-8 border border-white/10 text-center shadow-2xl">
          <h3 className="text-white font-black mb-2 uppercase tracking-widest text-sm">Pagamento PIX</h3>
          <p className="text-gray-400 text-xs mb-6">Escaneie ou copie o código abaixo</p>
          
          <div className="bg-white p-4 rounded-3xl inline-block mb-6 shadow-2xl">
            <img 
              src={`data:image/png;base64,${pixData.encodedImage}`} 
              alt="QR Code PIX" 
              className="w-48 h-48"
            />
          </div>
          
          <div className="bg-black/40 p-4 rounded-2xl mb-6 border border-white/5 flex items-center justify-between">
            <p className="text-white/50 text-[10px] font-mono truncate mr-4">{pixData.payload}</p>
            <button onClick={() => { navigator.clipboard.writeText(pixData.payload); toast.success("Código copiado!"); }} className="text-[#FF8C00] font-bold text-xs uppercase">Copiar</button>
          </div>

          <button onClick={() => setShowPixModal(false)} className="w-full bg-[#FF8C00] text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95">
            Já Paguei
          </button>
        </div>
      </div>
    );
  }

  // Componente interno para eventos do mapa
  const MapEvents = () => {
    useMapEvents({
      click(e) { 
        setCustomerLocation([e.latlng.lat, e.latlng.lng]); 
        // Feedback tátil ao marcar o PIN
        if (navigator.vibrate) {
          navigator.vibrate(30);
        }
      },
    });
    return null;
  };

  const renderStatusUI = () => {
    const steps = ['pendente', 'preparando', 'entrega', 'concluido'];
    const currentStepIdx = steps.indexOf(currentStatus || 'pendente');

    return (
      <div className="fixed inset-0 bg-black/98 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300 backdrop-blur-md">
        <div className="bg-[#1A1A1A] w-full max-w-sm rounded-[48px] p-10 border-2 border-white/5 text-center shadow-[0_40px_100px_rgba(0,0,0,0.9)]">
          <div className="w-24 h-24 bg-[#FF8C00] rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-[#FF8C00]/40 border-4 border-white/10">
            <i className={`fa-solid ${currentStatus === 'concluido' ? 'fa-check-double' : 'fa-motorcycle'} text-4xl text-white animate-bounce`}></i>
          </div>
          <h2 className="text-3xl font-black text-white mb-2">Pedido Ativo!</h2>
          <p className="text-gray-500 text-sm mb-12 font-medium">Fique de olho na tela para acompanhar o status.</p>

          <div className="space-y-8 relative mb-12 text-left ml-4">
            {steps.map((step, idx) => (
              <div key={step} className="flex items-center space-x-6 relative z-10">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black transition-all duration-700 ${idx <= currentStepIdx ? 'bg-[#FF8C00] text-white scale-110 shadow-lg' : 'bg-white/5 text-gray-700'}`}>
                  {idx + 1}
                </div>
                <span className={`capitalize text-sm font-black tracking-[0.1em] ${idx <= currentStepIdx ? 'text-white' : 'text-gray-700'}`}>
                  {step === 'entrega' ? 'A Caminho' : step === 'concluido' && deliveryMode === 'pickup' ? 'Pronto p/ Retirada' : step}
                </span>
              </div>
            ))}
            <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-white/5" />
          </div>

          <button 
            onClick={() => { setOrderId(null); clearCart(); navigate('/orders'); }}
            className="w-full bg-white/5 py-6 rounded-3xl text-white font-black uppercase text-[10px] tracking-[0.2em] border border-white/10 hover:bg-white/10 transition-all active:scale-95"
          >
            Ver Meus Pedidos
          </button>
        </div>
      </div>
    );
  };

  if (orderId) return renderStatusUI();

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-[#0F0F0F]">
        <div className="w-24 h-24 bg-[#1A1A1A] rounded-[32px] flex items-center justify-center mb-8 border border-white/5 shadow-2xl">
          <i className="fa-solid fa-basket-shopping text-4xl text-gray-800"></i>
        </div>
        <h2 className="text-2xl font-black text-white mb-3 tracking-tight">Opa, tá vazio!</h2>
        <p className="text-gray-600 mb-10 max-w-[240px]">Que tal escolher um lanche premium agora?</p>
        <button 
          onClick={() => navigate('/')} 
          className="bg-[#FF8C00] text-white px-12 py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-[#FF8C00]/20 active:scale-95 transition-all"
        >
          Ver Cardápio
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex flex-col p-4 sm:p-6 pb-28 animate-in fade-in duration-500">
      <header className="mb-10">
        <h1 className="text-3xl font-black text-white tracking-tighter">Meu <span className="text-[#FF8C00]">Carrinho</span></h1>
        <p className="text-gray-500 text-xs font-black uppercase tracking-widest mt-1">Quase lá...</p>
      </header>

      <div className="space-y-4 mb-10">
        {items.map(item => (
          <div key={item.id} className="bg-[#1A1A1A] rounded-[32px] p-6 flex items-center border border-white/5 shadow-xl">
            <div className="flex-1">
              <h3 className="text-white font-black text-lg leading-tight">{item.name}</h3>
              <p className="text-[#FF8C00] font-black text-sm mt-1">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}</p>
            </div>
            <div className="flex items-center bg-black/40 rounded-2xl p-2 border border-white/5 min-h-[50px]">
              <button onClick={() => updateQuantity(item.id, -1)} className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-white transition-colors">
                <i className="fa-solid fa-minus"></i>
              </button>
              <span className="mx-4 text-white font-black w-4 text-center">{item.quantity}</span>
              <button onClick={() => updateQuantity(item.id, 1)} className="w-10 h-10 flex items-center justify-center text-[#FF8C00] hover:scale-125 transition-all">
                <i className="fa-solid fa-plus"></i>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* SELETOR DE MODO DE ENTREGA */}
      <div className="bg-[#1A1A1A] p-2 rounded-2xl flex mb-6 border border-white/5">
        <button 
          onClick={() => setDeliveryMode('delivery')}
          className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${deliveryMode === 'delivery' ? 'bg-[#FF8C00] text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
        >
          <i className="fa-solid fa-motorcycle mr-2"></i> Entrega
        </button>
        <button 
          onClick={() => setDeliveryMode('pickup')}
          className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${deliveryMode === 'pickup' ? 'bg-[#FF8C00] text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
        >
          <i className="fa-solid fa-bag-shopping mr-2"></i> Retirada
        </button>
      </div>

      {/* DADOS DE ENTREGA/RETIRADA */}
      <div className="bg-[#1A1A1A] rounded-[40px] p-8 border border-white/5 mb-8 shadow-2xl space-y-6">
        <h3 className="text-white font-black tracking-[0.2em] uppercase text-[10px] flex items-center">
          <i className={`fa-solid ${deliveryMode === 'delivery' ? 'fa-truck-fast' : 'fa-store'} text-[#FF8C00] mr-2`}></i> 
          {deliveryMode === 'delivery' ? 'Confirmar Entrega' : 'Dados para Retirada'}
        </h3>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-gray-600 uppercase ml-4">Nome do Recebedor</label>
            <div className="relative">
              <i className="fa-solid fa-user absolute left-5 top-1/2 -translate-y-1/2 text-[#FF8C00]"></i>
              <input 
                type="text" 
                placeholder="Ex: Maria Silva" 
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-black/40 border-2 border-white/5 rounded-2xl pl-12 pr-6 py-5 text-white placeholder:text-gray-800 focus:border-[#FF8C00] outline-none transition-all min-h-[64px]"
              />
            </div>
          </div>

          {/* AGENDAMENTO DE ENTREGA */}
          {deliveryMode === 'delivery' && (
            <div className="space-y-2">
            <label className="text-[9px] font-black text-gray-600 uppercase ml-4">Horário da Entrega</label>
            <div className="flex space-x-3">
              <button 
                onClick={() => setDeliveryTime('now')}
                className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border-2 ${deliveryTime === 'now' ? 'bg-[#FF8C00]/20 border-[#FF8C00] text-white' : 'bg-black/40 border-white/5 text-gray-500'}`}
              >
                Agora
              </button>
              <button 
                onClick={() => setDeliveryTime('schedule')}
                className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border-2 ${deliveryTime === 'schedule' ? 'bg-[#FF8C00]/20 border-[#FF8C00] text-white' : 'bg-black/40 border-white/5 text-gray-500'}`}
              >
                Agendar
              </button>
            </div>
            {deliveryTime === 'schedule' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="w-full bg-black/40 border-2 border-white/5 rounded-2xl px-6 py-4 text-white focus:border-[#FF8C00] outline-none" />
              </div>
            )}
            </div>
          )}

          {deliveryMode === 'delivery' && (
            <div className="space-y-2">
            <label className="text-[9px] font-black text-gray-600 uppercase ml-4">Local de Entrega</label>
            <div className="relative">
              <i className="fa-solid fa-map-pin absolute left-5 top-6 text-[#FF8C00]"></i>
              <textarea 
                placeholder="Rua, número e ponto de referência" 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                className="w-full bg-black/40 border-2 border-white/5 rounded-3xl pl-12 pr-6 py-5 text-white placeholder:text-gray-800 focus:border-[#FF8C00] outline-none transition-all resize-none min-h-[100px]"
              />
            </div>
            </div>
          )}

          {/* AVISO DE ALTA DEMANDA */}
          {isShopBusy && (
            <div className="bg-orange-500/10 border border-orange-500/50 rounded-2xl p-3 mb-4 flex items-center gap-3 animate-pulse">
              <i className="fa-solid fa-fire text-orange-500 text-xl"></i>
              <div>
                <p className="text-orange-500 font-black text-[10px] uppercase tracking-widest">Loja em Alta Demanda</p>
                <p className="text-white text-xs">O tempo de entrega está um pouco maior devido ao sucesso de pedidos!</p>
              </div>
            </div>
          )}

          {/* EXIBIÇÃO DE ESTIMATIVAS (DISTÂNCIA E TEMPO) */}
          {deliveryMode === 'delivery' && (
            <div className="flex gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="flex-1 bg-black/40 border border-white/5 rounded-2xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FF8C00]/10 flex items-center justify-center text-[#FF8C00] border border-[#FF8C00]/20">
                  <i className="fa-solid fa-route"></i>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Distância</p>
                  <p className="text-white font-bold text-sm">{deliveryEstimates.distanceDisplay}</p>
                </div>
              </div>
              <div className="flex-1 bg-black/40 border border-white/5 rounded-2xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                  <i className="fa-solid fa-clock"></i>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Tempo Estimado</p>
                  <p className="text-white font-bold text-sm">{deliveryEstimates.timeDisplay}</p>
                </div>
              </div>
            </div>
          )}

          {/* MAPA DE CONFIRMAÇÃO */}
          {deliveryMode === 'delivery' && customerLocation && (
            <div className="h-48 w-full rounded-3xl overflow-hidden border-2 border-white/10 relative z-0">
              <MapContainer center={customerLocation} zoom={15} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                <Marker 
                  position={customerLocation} 
                  icon={customIcon} 
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => { const marker = e.target; const position = marker.getLatLng(); setCustomerLocation([position.lat, position.lng]); }
                  }}
                />
                <MapEvents />
              </MapContainer>
              <div className="absolute bottom-2 left-2 right-2 bg-black/80 text-white text-[9px] p-2 rounded-xl text-center backdrop-blur-sm z-[1000]">
                Arraste o pino para ajustar sua localização exata.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CUPOM DE DESCONTO */}
      <div className="bg-[#1A1A1A] rounded-[32px] p-6 border border-white/5 mb-8 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-black tracking-[0.2em] uppercase text-[10px] flex items-center">
            <i className="fa-solid fa-ticket text-[#FF8C00] mr-2"></i> Cupom de Desconto
          </h3>
          {appliedCoupon && <span className="text-green-500 text-[10px] font-black uppercase tracking-widest">Aplicado!</span>}
        </div>
        
        {isShopBusy ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
             <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center shrink-0">
               <i className="fa-solid fa-ban text-red-500"></i>
             </div>
             <div>
               <p className="text-red-500 font-black text-[10px] uppercase tracking-widest">Cupons Bloqueados</p>
               <p className="text-gray-400 text-xs">Devido à alta demanda, promoções estão suspensas temporariamente.</p>
             </div>
          </div>
        ) : (
          <div className="flex space-x-2">
            <input 
              placeholder="DIGITE O CÓDIGO" 
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              className="flex-1 bg-black/40 border-2 border-white/5 rounded-2xl px-4 py-3 text-white text-sm font-bold uppercase outline-none focus:border-[#FF8C00] placeholder:text-gray-700"
            />
            <button 
              onClick={handleApplyCoupon}
              className="bg-white/10 text-white px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#FF8C00] transition-colors border-2 border-transparent hover:border-[#FF8C00]"
            >
              Aplicar
            </button>
          </div>
        )}
      </div>

      {/* FORMA DE PAGAMENTO */}
      <div className="bg-[#1A1A1A] rounded-[32px] p-6 border border-white/5 mb-8 shadow-xl">
        <h3 className="text-white font-black tracking-[0.2em] uppercase text-[10px] flex items-center mb-4">
          <i className="fa-solid fa-wallet text-[#FF8C00] mr-2"></i> Pagamento
        </h3>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {['pix', 'dinheiro', 'cartao'].map((method) => (
            <button
              key={method}
              onClick={() => setPaymentMethod(method)}
              className={`py-3 rounded-xl flex flex-col items-center justify-center border-2 transition-all ${paymentMethod === method ? 'bg-[#FF8C00]/20 border-[#FF8C00] text-white' : 'bg-black/20 border-transparent text-gray-600 hover:bg-white/5'}`}
            >
              <i className={`fa-solid ${method === 'pix' ? 'fa-qrcode' : method === 'dinheiro' ? 'fa-money-bill-wave' : 'fa-credit-card'} text-lg mb-1`}></i>
              <span className="text-[9px] font-black uppercase">{method}</span>
            </button>
          ))}
        </div>
      </div>

      {/* RESUMO E BOTÃO DE AÇÃO */}
      <div className="bg-[#FF8C00] rounded-[40px] p-8 shadow-[0_20px_50px_rgba(255,140,0,0.3)] mb-4">
        <div className="space-y-2 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-white/60 font-bold text-xs">Subtotal</span>
            <span className="text-white/80 font-bold text-sm">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}</span>
          </div>
          {currentValues.descontoAplicado > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-white/60 font-bold text-xs">Desconto</span>
              <span className="text-white font-bold text-sm">- {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentValues.descontoAplicado)}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-white/60 font-bold text-xs">Taxa de Processamento</span>
            <span className="text-white font-bold text-sm">+ {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentValues.taxaProcessamento)}</span>
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-white/20">
            <span className="text-white font-black uppercase text-[10px] tracking-widest">Total Final</span>
            <div className="text-right">
              <span className="text-white font-black text-3xl tracking-tighter block">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentValues.totalCliente)}
              </span>
              <span className="text-white/60 text-[9px] font-bold uppercase tracking-widest block">
                {currentValues.message ? <span className="text-green-400 animate-pulse">{currentValues.message}</span> : `+ ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentValues.frete)} Entrega`}
              </span>
            </div>
          </div>
        </div>
        <button 
          onClick={handleFinishOrder}
          disabled={isOrdering}
          className="w-full bg-white text-[#FF8C00] py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl active:scale-95 transition-all flex items-center justify-center min-h-[64px]"
        >
          {isOrdering ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <span>Finalizar Pedido</span>}
        </button>
      </div>

      {/* <SmartUpsellModal 
        isOpen={showMinOrderModal}
        onClose={() => setShowMinOrderModal(false)}
        onAdd={(item) => {
          addToCart(item, shopId!, shopName!);
          setUpsellAccepted(true); // Métrica: cliente aceitou sugestão do SmartUpsell
          setIsAutoFinishing(true);
          setShowMinOrderModal(false);
        }}
        upsellItems={upsellItems}
        total={total}
        minOrder={MIN_ORDER}
      /> */}
    </div>
  );
};

export default Cart;
