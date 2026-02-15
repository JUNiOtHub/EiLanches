import React, { useState, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { db, collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc, increment, addDoc, serverTimestamp } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { ENV } from '../config/env';

// Correção para ícones do Leaflet no React
const iconUrl = 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png';
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png';

const customIcon = new L.Icon({
    iconUrl,
    iconRetinaUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Interface local para garantir tipagem correta
export interface OrderData {
  id: string;
  status: string;
  createdAt: any;
  lojaNome: string;
  clienteNome: string;
  endereco: string;
  lat: number;
  lng: number;
  deliveryMode: string;
  entregadorUid?: string;
  driverFee?: number;
  deliveryFee?: number;
  entregueEm?: any;
  deliveryCode: string;
}

const DeliveryDashboard: React.FC = () => {
  const mapRef = useRef<L.Map | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const { user, profile, signOut, requestNotificationPermission } = useAuth();
  const navigate = useNavigate();
  const [availableOrders, setAvailableOrders] = useState<OrderData[]>([]);
  const [myDeliveries, setMyDeliveries] = useState<OrderData[]>([]);
  const [tab, setTab] = useState<'disponiveis' | 'minhas' | 'ganhos' | 'config'>('disponiveis');
  const [isOnline, setIsOnline] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [earningsFilter, setEarningsFilter] = useState<'today' | 'week' | 'month'>('today');
  const [verificationCode, setVerificationCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [vehicleType, setVehicleType] = useState(profile?.vehicleType || 'moto');
  const [totalBalance, setTotalBalance] = useState(0);

  // Centro do mapa (Inicialmente SP, depois atualiza com GPS real)
  const [centerPosition, setCenterPosition] = useState<[number, number]>([-23.55052, -46.633308]);

  // Ref para manter o centro atualizado dentro do onSnapshot sem recriar o listener
  const centerPositionRef = useRef(centerPosition);
  useEffect(() => {
    centerPositionRef.current = centerPosition;
  }, [centerPosition]);

  useEffect(() => {
    if (!user) return;

    // 1. Pedidos Disponíveis
    const qAvailable = query(
      collection(db, 'pedidos'),
      where('status', '==', 'preparando'),
      orderBy('createdAt', 'desc')
    );

    const unsubAvailable = onSnapshot(qAvailable, (snapshot) => {
      // Simulando coordenadas aleatórias próximas ao centro para demonstração
      const orders = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        lat: centerPositionRef.current[0] + (Math.random() - 0.5) * 0.02,
        lng: centerPositionRef.current[1] + (Math.random() - 0.5) * 0.02
      } as OrderData)).filter(o => o.deliveryMode !== 'pickup'); // Filtra pedidos de retirada
      setAvailableOrders(orders);
    });

    // 2. Minhas Entregas (Ativas e Concluídas para histórico)
    const qMyDeliveries = query(
      collection(db, 'pedidos'),
      where('entregadorUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubMyDeliveries = onSnapshot(qMyDeliveries, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as OrderData));
      setMyDeliveries(docs);
      
      // Calcula o saldo total de todas as entregas concluídas
      const completed = docs.filter(d => d.status === 'concluido');
      // Usa driverFee (novo cálculo) ou fallback para deliveryFee antigo ou 5.00
      setTotalBalance(completed.reduce((acc, order) => acc + (order.driverFee || order.deliveryFee || 5.00), 0));
    });

    return () => { unsubAvailable(); unsubMyDeliveries(); };
  }, [user]);

  // Limpa o rastreamento ao desmontar o componente
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const toggleTracking = () => {
    if (isTracking) {
      // Parar de seguir
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
      toast("Rastreamento pausado", { icon: '📍' });
    } else {
      // Começar a seguir
      if (navigator.geolocation) {
        toast.loading('Ativando GPS em tempo real...');
        const id = navigator.geolocation.watchPosition(
          (position) => {
            toast.dismiss();
            const newPos: [number, number] = [position.coords.latitude, position.coords.longitude];
            setCenterPosition(newPos);
            mapRef.current?.flyTo(newPos, 17); // Zoom mais próximo para navegação
          },
          (error) => {
            setIsTracking(false);
            if (watchIdRef.current !== null) {
               navigator.geolocation.clearWatch(watchIdRef.current);
               watchIdRef.current = null;
            }

            let msg = "Erro ao acessar GPS.";
            if (error.code === 1) msg = "Permissão de GPS negada.";
            else if (error.code === 2) msg = "Sinal de GPS indisponível.";
            else if (error.code === 3) msg = "Tempo limite do GPS esgotado.";
            
            // Dica para desenvolvedores testando em rede local (HTTP bloqueia GPS)
            if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                msg += " (Requer HTTPS ou Localhost)";
            }
            
            toast.error(msg);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
        watchIdRef.current = id;
        setIsTracking(true);
        toast.success("Seguindo sua localização!");
      } else {
        toast.error("GPS não suportado.");
      }
    }
  };

  // Cálculo de Ganhos
  const earnings = useMemo(() => {
    const completed = myDeliveries.filter(d => d.status === 'concluido');
    
    const now = new Date();
    const filtered = completed.filter(d => {
      const date = new Date(d.entregueEm);
      if (earningsFilter === 'today') {
        return date.toDateString() === now.toDateString();
      } else if (earningsFilter === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        return date >= oneWeekAgo;
      } else { // month
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }
    });

    const total = filtered.reduce((acc, order) => acc + (order.driverFee || order.deliveryFee || 5.00), 0);
    return { total, count: filtered.length, history: filtered };
  }, [myDeliveries, earningsFilter]);

  // Função de Upload para o ImgBB
  const uploadToImgBB = async (file: Blob) => {
    const formData = new FormData();
    formData.append("image", file);
    const apiKey = ENV.IMGBB.key || '4f069942c132182449dea4cf00814506'; // Chave do ImgBB
    
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: formData,
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.error?.message || "Falha no upload");
    return data.data;
  };

  const acceptDelivery = async (orderId: string) => {
    if (!user) return;
    try {
      const orderRef = doc(db, 'pedidos', orderId);
      await updateDoc(orderRef, {
        status: 'entrega',
        entregadorUid: user.uid,
        entregadorNome: profile?.nome
      });
      toast.success("Entrega aceita!");
      setTab('minhas');
    } catch (error) {
      toast.error("Erro ao aceitar entrega.");
    }
  };

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    setUploading(true);
    try {
      const data = await uploadToImgBB(e.target.files[0]);
      setProofUrl(data.url);
      toast.success("Comprovante anexado!");
    } catch (error) {
      toast.error("Erro ao enviar foto.");
    } finally {
      setUploading(false);
    }
  };

  // Função auxiliar para calcular distância em metros (Haversine)
  const getDistanceFromLatLonInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Raio da terra em metros
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const finishDelivery = async (orderId: string, correctCode: string) => {
    if (!verificationCode || verificationCode.length !== 4) {
      toast.error("Digite o código de 4 dígitos.");
      return;
    }

    // 3. GEOFENCING: Verifica se o entregador está perto do local (ex: 150 metros)
    const order = myDeliveries.find(o => o.id === orderId);
    if (order && order.lat && order.lng) {
      const distance = getDistanceFromLatLonInMeters(
        centerPosition[0], centerPosition[1],
        order.lat, order.lng
      );
      
      // Nota: Em produção, ajuste a tolerância conforme a precisão do GPS
      if (distance > 150) {
        toast.error(`Você está a ${Math.round(distance)}m do local. Aproxime-se para validar.`);
        return;
      }
    }

    const toastId = toast.loading("Validando PIN...");

    try {
      // Região deve coincidir com a da Cloud Function (evita CORS e roteamento)
      const functions = getFunctions(app, 'southamerica-east1');
      const validateDeliveryPIN = httpsCallable(functions, 'validateDeliveryPIN');
      
      const result: any = await validateDeliveryPIN({ orderId, pin: verificationCode });
      
      if (result.data.success) {
        toast.success("Código confirmado! Entrega finalizada.", { id: toastId });
        setShowCodeInput(null);
        setVerificationCode('');
        setProofUrl(null);
      } else {
        toast.error("Código inválido.", { id: toastId });
      }
    } catch (error: any) {
      
      let msg = error.message || "Erro na validação.";
      
      // Tratamento específico para diferentes tipos de erro
      if (error.code === 'internal' || error.message?.includes('CORS')) {
        msg = "Serviço de validação indisponível. Usando validação local...";
        
        // Fallback: validar localmente se o código está correto
        if (verificationCode === correctCode) {
          // Atualizar pedido diretamente no Firestore
          try {
            const orderRef = doc(db, 'pedidos', orderId);
            await updateDoc(orderRef, {
              status: 'concluido',
              entregueEm: serverTimestamp(),
              proofUrl: proofUrl || null
            });
            
            toast.success("Entrega finalizada com sucesso!", { id: toastId });
            setShowCodeInput(null);
            setVerificationCode('');
            setProofUrl(null);
            return;
          } catch (updateError) {
            msg = "Erro ao finalizar entrega. Tente novamente.";
          }
        } else {
          msg = "Código inválido.";
        }
      } else if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
        msg = "Servidor temporariamente indisponível. Tente novamente.";
      }
      
      toast.error(msg, { id: toastId, duration: 6000 });
    }
  };

  const toggleOnlineStatus = async () => {
    if (!user) return;
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isOnline: newStatus
      });
      toast.success(newStatus ? "Você está ONLINE!" : "Você está OFFLINE.");
    } catch (error) {
      setIsOnline(!newStatus); // Reverte em caso de erro
      toast.error("Erro ao mudar status.");
    }
  };

  const updateVehicleType = async (type: string) => {
    if (!user) return;
    setVehicleType(type);
    
    try {
      await updateDoc(doc(db, 'users', user.uid), { vehicleType: type });
      toast.success("Veículo atualizado!");
    } catch (e) { toast.error("Erro ao salvar."); }
  };

  const handleRequestWithdraw = async () => {
    if (totalBalance < 20) {
      toast.error("Mínimo para saque: R$ 20,00");
      return;
    }
    try {
      await addDoc(collection(db, 'saques'), {
        userId: user.uid,
        tipoUsuario: 'entregador',
        valor: totalBalance,
        status: 'pendente',
        solicitadoEm: serverTimestamp(),
        chavePix: profile?.chavePix || profile?.telefone
      });
      toast.success("Saque solicitado com sucesso!");
    } catch (e) { toast.error("Erro ao solicitar saque."); }
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white p-6 pb-24 flex flex-col animate-in fade-in duration-500">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-black text-white">Olá, {profile?.nome?.split(' ')[0]}</h1>
          <div className="flex items-center space-x-2 mt-1">
            <button 
              onClick={toggleOnlineStatus}
              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 transition-all ${isOnline ? 'bg-green-500/20 text-green-500 border border-green-500/50' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </button>
          </div>
          <button onClick={requestNotificationPermission} className="mt-2 text-[9px] bg-white/10 px-2 py-1 rounded text-gray-300 hover:text-white">
            <i className="fa-solid fa-bell mr-1"></i> Ativar Alertas
          </button>
        </div>
        <button onClick={() => signOut()} className="w-10 h-10 bg-[#1E1E1E] rounded-xl flex items-center justify-center text-red-500 border border-white/10">
          <i className="fa-solid fa-power-off"></i>
        </button>
      </header>

      {/* ABAS */}
      <div className="flex bg-[#1A1A1A] p-1.5 rounded-2xl mb-6 border border-white/5">
        {[
          { id: 'disponiveis', icon: 'fa-map', label: 'Mapa' },
          { id: 'minhas', icon: 'fa-motorcycle', label: 'Entregas' },
          { id: 'ganhos', icon: 'fa-wallet', label: 'Extrato' },
          { id: 'config', icon: 'fa-gear', label: 'Config' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center space-x-2 transition-all ${tab === t.id ? 'bg-[#FF8C00] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <i className={`fa-solid ${t.icon} text-xs`}></i>
            <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'disponiveis' && (
          <div className="flex-1 flex flex-col space-y-4">
            {!isOnline ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-50">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                  <i className="fa-solid fa-moon text-3xl text-gray-500"></i>
                </div>
                <h3 className="text-xl font-black text-white mb-2">Você está Offline</h3>
                <p className="text-gray-500 text-xs max-w-[200px]">Fique online para ver novos pedidos e receber chamados.</p>
                <button 
                  onClick={toggleOnlineStatus}
                  className="mt-6 bg-[#FF8C00] text-white px-8 py-3 rounded-xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all"
                >
                  Ficar Online
                </button>
              </div>
            ) : (
              <>
                {/* MAPA INTERATIVO */}
                <div className="h-64 w-full rounded-[32px] overflow-hidden border border-white/10 shadow-2xl relative z-0">
                  <MapContainer ref={mapRef} center={centerPosition} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    <Marker position={centerPosition} icon={customIcon}>
                      <Popup>Você está aqui</Popup>
                    </Marker>
                    {availableOrders.map(order => (
                      <Marker key={order.id} position={[order.lat, order.lng]} icon={customIcon}>
                        <Popup>
                          <div className="text-black text-xs font-bold">
                            <p>{order.lojaNome}</p>
                            <button onClick={() => acceptDelivery(order.id)} className="mt-1 bg-[#FF8C00] text-white px-2 py-1 rounded">Aceitar</button>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                  <button
                    onClick={toggleTracking}
                    className={`absolute bottom-4 right-4 z-[1000] w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform ${isTracking ? 'bg-green-600 animate-pulse' : 'bg-[#FF8C00]'}`}
                    title={isTracking ? "Parar de seguir" : "Seguir minha localização"}
                  >
                    <i className={`fa-solid ${isTracking ? 'fa-location-arrow' : 'fa-location-crosshairs'}`}></i>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3">
                  <h3 className="text-gray-500 text-xs font-black uppercase tracking-widest">Lista de Pedidos</h3>
                  {availableOrders.length === 0 ? (
                    <p className="text-gray-600 text-center text-xs py-4">Nenhum pedido disponível.</p>
                  ) : availableOrders.map(order => (
                    <div key={order.id} className="bg-[#1E1E1E] p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                      <div>
                        <h4 className="text-white font-bold text-sm">{order.lojaNome}</h4>
                        <p className="text-gray-400 text-[10px] font-bold mb-1">Cliente: {order.clienteNome}</p>
                        <p className="text-gray-500 text-xs">{order.endereco}</p>
                      </div>
                      <button onClick={() => acceptDelivery(order.id)} className="bg-[#FF8C00] text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase">
                        Aceitar
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'minhas' && (
          <div className="flex-1 overflow-y-auto space-y-4">
            {myDeliveries.filter(d => d.status === 'entrega').length === 0 ? (
              <div className="text-center py-20 opacity-50"><i className="fa-solid fa-person-biking text-4xl mb-4"></i><p>Sem entregas ativas.</p></div>
            ) : myDeliveries.filter(d => d.status === 'entrega').map(order => (
              <div key={order.id} className="bg-[#1E1E1E] p-6 rounded-[32px] border border-[#FF8C00]/30 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <span className="bg-[#FF8C00] text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase animate-pulse">Em Andamento</span>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.endereco)}`} target="_blank" rel="noopener noreferrer" className="text-[#FF8C00]"><i className="fa-solid fa-location-arrow text-xl"></i></a>
                </div>
                <h3 className="text-xl font-black text-white mb-1">{order.clienteNome}</h3>
                <p className="text-gray-400 text-sm mb-6">{order.endereco}</p>
                
                {/* UPLOAD DE COMPROVANTE */}
                <div className="mb-4">
                  <label className="block w-full bg-black/40 border border-dashed border-white/20 rounded-xl p-4 text-center cursor-pointer hover:border-[#FF8C00] transition-colors">
                    {uploading ? (
                      <span className="text-gray-400 text-xs"><i className="fa-solid fa-circle-notch fa-spin mr-2"></i>Enviando...</span>
                    ) : proofUrl ? (
                      <div className="flex items-center justify-center text-green-500 text-xs font-bold">
                        <i className="fa-solid fa-check-circle mr-2"></i> Foto Anexada
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs font-bold"><i className="fa-solid fa-camera mr-2"></i> Foto da Entrega (Opcional)</span>
                    )}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUploadProof} disabled={uploading} />
                  </label>
                  {proofUrl && <img src={proofUrl} alt="Comprovante" className="mt-2 h-20 w-full object-cover rounded-lg opacity-50" />}
                </div>

                {showCodeInput === order.id ? (
                  <div className="space-y-3 animate-in fade-in">
                    <input 
                      type="text" 
                      placeholder="Código do Cliente (4 dígitos)" 
                      maxLength={4}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-center text-white font-black tracking-[0.5em] text-lg outline-none focus:border-[#FF8C00]"
                    />
                    <button onClick={() => finishDelivery(order.id, order.deliveryCode)} className="w-full bg-green-600 text-white py-3 rounded-xl font-black uppercase text-xs shadow-lg">Confirmar Código</button>
                  </div>
                ) : (
                  <button onClick={() => setShowCodeInput(order.id)} className="w-full bg-[#FF8C00] text-white py-4 rounded-2xl font-black uppercase text-xs shadow-lg active:scale-95">
                    Finalizar Entrega (+ R$ 5,00)
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'ganhos' && (
          <div className="flex-1 overflow-y-auto space-y-6">
            <div className="bg-gradient-to-br from-[#1E1E1E] to-black p-8 rounded-[40px] border border-white/10 text-center shadow-2xl">
              <div className="flex justify-center space-x-2 mb-6">
                {[
                  { id: 'today', label: 'Hoje' },
                  { id: 'week', label: '7 Dias' },
                  { id: 'month', label: 'Mês' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setEarningsFilter(f.id as any)}
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${earningsFilter === f.id ? 'bg-[#FF8C00] text-white' : 'bg-white/5 text-gray-500'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-2">Ganhos do Período</p>
              <h2 className="text-5xl font-black text-[#FF8C00] mb-2">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(earnings.total)}</h2>
              <p className="text-white text-sm font-bold bg-white/5 inline-block px-4 py-1 rounded-full">{earnings.count} entregas realizadas</p>
              
              <div className="mt-6 pt-6 border-t border-white/10">
                 <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Saldo Disponível</p>
                 <p className="text-2xl font-black text-white mb-4">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalBalance)}</p>
                 <button 
                  onClick={() => navigate('/withdraw')}
                  className="w-full bg-[#FF8C00] text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-money-bill-transfer"></i> SACAR AGORA
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-gray-500 text-xs font-black uppercase tracking-widest px-2">Histórico Recente</h3>
              {earnings.history.length === 0 ? (
                <p className="text-gray-600 text-center text-xs py-4">Nenhuma entrega neste período.</p>
              ) : earnings.history.map(order => (
                <div key={order.id} className="bg-[#1E1E1E] p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                  <div>
                    <h4 className="text-white font-bold text-sm">Entrega Finalizada</h4>
                    <p className="text-gray-600 text-[10px]">{new Date(order.entregueEm).toLocaleDateString('pt-BR')} às {new Date(order.entregueEm).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                  </div>
                  <span className="text-green-500 font-black text-sm">+ {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.driverFee || 5.00)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'config' && (
          <div className="flex-1 overflow-y-auto space-y-6 animate-in slide-in-from-right duration-300">
            <div className="bg-[#1E1E1E] p-6 rounded-[32px] border border-white/5">
              <h3 className="text-white font-black uppercase text-[10px] tracking-[0.2em] mb-6 flex items-center">
                <i className="fa-solid fa-motorcycle mr-2 text-[#FF8C00]"></i> Meu Veículo
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {['moto', 'bike', 'carro'].map((v) => (
                  <button
                    key={v}
                    onClick={() => updateVehicleType(v)}
                    className={`py-4 rounded-2xl flex flex-col items-center justify-center border-2 transition-all ${vehicleType === v ? 'bg-[#FF8C00]/20 border-[#FF8C00] text-white' : 'bg-black/20 border-transparent text-gray-600 hover:bg-white/5'}`}
                  >
                    <i className={`fa-solid ${v === 'moto' ? 'fa-motorcycle' : v === 'bike' ? 'fa-bicycle' : 'fa-car'} text-xl mb-2`}></i>
                    <span className="text-[10px] font-black uppercase">{v}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#1E1E1E] p-6 rounded-[32px] border border-white/5">
              <h3 className="text-white font-black uppercase text-[10px] tracking-[0.2em] mb-6 flex items-center">
                <i className="fa-solid fa-toggle-on mr-2 text-[#FF8C00]"></i> Disponibilidade
              </h3>
              <div className="flex items-center justify-between bg-black/20 p-4 rounded-2xl">
                <span className="text-sm font-bold text-gray-300">Receber Pedidos</span>
                <button 
                  onClick={toggleOnlineStatus}
                  className={`w-12 h-6 rounded-full relative transition-colors ${isOnline ? 'bg-green-500' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isOnline ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>
            </div>

            <div className="bg-[#1E1E1E] p-6 rounded-[32px] border border-white/5">
              <h3 className="text-white font-black uppercase text-[10px] tracking-[0.2em] mb-6 flex items-center">
                <i className="fa-solid fa-clock-rotate-left mr-2 text-[#FF8C00]"></i> Histórico Completo
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                {myDeliveries.filter(d => d.status === 'concluido').length === 0 ? (
                  <p className="text-gray-500 text-xs text-center py-4">Nenhuma entrega realizada.</p>
                ) : (
                  myDeliveries.filter(d => d.status === 'concluido').map(order => (
                    <div key={order.id} className="bg-black/20 p-4 rounded-2xl flex justify-between items-center border border-white/5">
                      <div>
                        <h4 className="text-white font-bold text-xs mb-1">{order.lojaNome}</h4>
                        <p className="text-gray-500 text-[10px]">
                          {order.entregueEm ? new Date(order.entregueEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Data N/A'}
                        </p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="block text-green-500 font-black text-xs">+ {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.driverFee || 5.00)}</span>
                        <button 
                          onClick={() => navigate(`/order/${order.id}`)}
                          className="text-[9px] text-[#FF8C00] font-bold uppercase tracking-wider mt-1 hover:text-white transition-colors flex items-center"
                        >
                          Ver Detalhes <i className="fa-solid fa-chevron-right ml-1 text-[8px]"></i>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryDashboard;