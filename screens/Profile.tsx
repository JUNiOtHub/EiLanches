
import React, { useMemo, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, doc, updateDoc, collection, query, where, orderBy, onSnapshot, limit } from '../firebase';
import { useHighPrecisionGeolocation } from '../services/highPrecisionGeolocation';

type SavedAddress = {
  id: string;
  label: string;
  address: string;
  isDefault?: boolean;
};

type OrderHistoryItem = {
  id: string;
  shopName: string;
  total: number;
  dateLabel: string;
  itemsPreview: string;
};

const Profile: React.FC = () => {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const { location } = useHighPrecisionGeolocation({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000
  });

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [nome, setNome] = useState(profile?.nome || '');
  const [telefone, setTelefone] = useState(profile?.telefone || '');
  const [documento, setDocumento] = useState(profile?.documento || '');
  const [enderecoPrincipal, setEnderecoPrincipal] = useState(profile?.endereco || '');

  const loyaltyPoints = Number((profile as any)?.loyaltyPoints || 0);
  const loyaltyGoal = 1000;
  const loyaltyPct = Math.min(100, Math.round((loyaltyPoints / loyaltyGoal) * 100));

  const cityHint = useMemo(() => {
    if (!location) return 'Localização: verificando…';

    const { latitude, longitude } = location;

    // Heurística simples para display (não é geocoding). Ajuste depois com reverse geocode em backend.
    // Itiúba/BA (aprox) / Jaguaquara/BA (aprox)
    const itiuba = { lat: -10.694, lng: -39.845 };
    const jaguaquara = { lat: -13.531, lng: -39.964 };

    const d1 = Math.hypot(latitude - itiuba.lat, longitude - itiuba.lng);
    const d2 = Math.hypot(latitude - jaguaquara.lat, longitude - jaguaquara.lng);

    if (Math.min(d1, d2) < 0.35) return d1 < d2 ? 'Localização: Itiúba/BA' : 'Localização: Jaguaquara/BA';
    return 'Localização: fora da área-alvo';
  }, [location]);

  const savedAddresses: SavedAddress[] = useMemo(() => {
    const base: SavedAddress[] = [];
    if (enderecoPrincipal?.trim()) {
      base.push({ id: 'main', label: 'Principal', address: enderecoPrincipal, isDefault: true });
    }
    return base;
  }, [enderecoPrincipal]);

  useEffect(() => {
    if (!user?.uid) {
        setOrdersLoading(false);
        return;
    }
    setOrdersLoading(true);
    const q = query(
        collection(db, 'pedidos'),
        where('clienteUid', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(5) // Pega os últimos 5 pedidos para a tela de perfil
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedOrders = snapshot.docs.map(doc => {
            const data = doc.data();
            const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
            return {
                id: doc.id,
                shopName: data.lojaNome,
                total: data.finalTotal || data.total,
                dateLabel: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date),
                itemsPreview: data.itens.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')
            };
        });
        setOrders(fetchedOrders);
        setOrdersLoading(false);
    }, () => {
        setOrdersLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleSave = async () => {
    if (!profile?.uid) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        nome,
        telefone,
        documento,
        endereco: enderecoPrincipal,
        updatedAt: new Date().toISOString()
      });
      await refreshProfile();
      toast.success('Perfil atualizado!');
    } catch {
      toast.error('Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = (orderId: string) => {
    toast.success('Pedido adicionado ao carrinho.');
    navigate('/cart');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 pb-32 md:pb-10 md:pt-6 md:max-w-7xl md:mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#FF8C00] to-[#FF4500] flex items-center justify-center shadow-[0_0_30px_rgba(255,140,0,0.25)] border-4 border-[#181818]">
            <i className="fa-solid fa-user text-2xl"></i>
          </div>
          <div>
            <div className="text-xl font-black leading-tight">{profile?.nome || 'Usuário'}</div>
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FF8C00]">{profile?.email}</div>
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500 mt-1">{cityHint}</div>
          </div>
        </div>
        <button
          onClick={() => navigate('/rewards')}
          className="w-full md:w-auto px-6 py-4 rounded-2xl bg-[#181818] border border-white/10 hover:border-[#FF8C00]/40 hover:bg-[#FF8C00]/10 transition-all flex items-center justify-between md:justify-center gap-4"
        >
          <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">Fidelidade</div>
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-crown text-[#FF8C00] text-sm"></i>
            <div className="text-lg font-black">{loyaltyPoints}</div>
          </div>
        </button>
      </div>

      <div className="bg-[#181818] border border-white/10 rounded-2xl p-6 mb-8 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Progresso</div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#00F5FF]">{loyaltyPct}%</div>
        </div>
        <div className="h-3 rounded-full bg-black/50 border border-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00F5FF] via-[#8A2BE2] to-[#FF8C00] shadow-[0_0_30px_rgba(0,245,255,0.25)]"
            style={{ width: `${loyaltyPct}%` }}
          />
        </div>
        <div className="mt-3 text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">
          Meta: {loyaltyGoal} pontos
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#181818] border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Meus Dados</div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FF8C00]">Premium</div>
          </div>
          <div className="space-y-3">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome"
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#00F5FF]"
            />
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="WhatsApp"
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#00F5FF]"
            />
            <input
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              placeholder="CPF / CNPJ"
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#00F5FF]"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            className="mt-5 w-full py-4 rounded-2xl font-black uppercase tracking-[0.25em] text-[11px] bg-[#00F5FF]/10 border border-[#00F5FF]/30 text-[#00F5FF] hover:bg-[#00F5FF]/20 hover:border-[#00F5FF]/60 transition-all disabled:opacity-50"
          >
            {loading ? 'Salvando…' : 'Salvar'}
          </button>
        </div>

        <div className="bg-[#181818] border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Endereços Salvos</div>
            <button
              onClick={() => toast('Em breve')}
              className="px-3 py-2 rounded-xl bg-[#FF8C00]/10 border border-[#FF8C00]/30 text-[#FF8C00] hover:bg-[#FF8C00]/20 transition-all"
            >
              <i className="fa-solid fa-plus text-xs"></i>
            </button>
          </div>

          <div className="space-y-3">
            {savedAddresses.length === 0 ? (
              <div className="text-sm text-gray-500">Nenhum endereço salvo.</div>
            ) : (
              savedAddresses.map((a) => (
                <div key={a.id} className="p-4 rounded-2xl bg-black/40 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="font-black text-sm">{a.label}</div>
                    {a.isDefault && (
                      <div className="text-[9px] font-black uppercase tracking-widest text-[#8A2BE2]">Padrão</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">{a.address}</div>
                </div>
              ))
            )}

            <textarea
              value={enderecoPrincipal}
              onChange={(e) => setEnderecoPrincipal(e.target.value)}
              placeholder="Endereço principal"
              rows={4}
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#8A2BE2] resize-none"
            />
          </div>
        </div>

        <div className="bg-[#181818] border border-white/10 rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Histórico de Pedidos</div>
          </div>

          {ordersLoading ? (
            <div className="text-center py-4 text-gray-500 text-xs">Carregando histórico...</div>
          ) : (
            <div className="space-y-3">
              {orders.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-xs">Nenhum pedido recente encontrado.</div>
              ) : (
                orders.map((o) => (
                  <div key={o.id} className="p-4 rounded-2xl bg-black/40 border border-white/10">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-black">{o.shopName}</div>
                        <div className="text-xs text-gray-500">{o.dateLabel} • #{o.id.slice(-4)}</div>
                        <div className="text-xs text-gray-400 mt-1 line-clamp-1">{o.itemsPreview}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-[#FF8C00]">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(o.total)}</div>
                        <button
                          onClick={() => handleReorder(o.id)}
                          className="mt-2 px-3 py-2 rounded-xl bg-[#8A2BE2]/10 border border-[#8A2BE2]/30 text-[#C5A3FF] hover:bg-[#8A2BE2]/20 transition-all text-[10px] font-bold"
                        >
                          Repetir
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="bg-[#181818] border border-white/10 rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Segurança</div>
          </div>
          <button
            onClick={() => signOut()}
            className="mt-4 w-full py-4 rounded-2xl font-black uppercase tracking-[0.25em] text-[11px] bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/60 transition-all"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
