import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, collection, addDoc, updateDoc, doc, serverTimestamp, query, where, orderBy, onSnapshot, getDocs } from '../firebase';
import toast from 'react-hot-toast';

const Rewards: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [monthlyRanking, setMonthlyRanking] = useState<any[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [isVip, setIsVip] = useState(false);

  const rewards = [
    { id: 'cupom_5', cost: 50, value: 5, type: 'fixed', description: 'Cupom de R$ 5,00' },
    { id: 'cupom_10', cost: 100, value: 10, type: 'fixed', description: 'Cupom de R$ 10,00' },
    { id: 'cupom_15', cost: 150, value: 15, type: 'fixed', description: 'Cupom de R$ 15,00' },
    { id: 'cupom_frete', cost: 80, value: 100, type: 'percent', description: 'Frete Grátis (até R$ 15)' },
  ].sort((a, b) => a.cost - b.cost);

  // Próximo resgate: a recompensa mais barata que o usuário ainda não atingiu
  const nextReward = rewards.find(r => (profile?.loyaltyPoints ?? 0) < r.cost) || rewards[rewards.length - 1];
  const pointsToNext = Math.max(0, nextReward.cost - (profile?.loyaltyPoints ?? 0));
  const progressToNext = nextReward ? Math.min(100, ((profile?.loyaltyPoints ?? 0) / nextReward.cost) * 100) : 100;

  // Carrega ranking mensal e status VIP
  useEffect(() => {
    if (!user) return;

    // Busca ranking mensal (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const rankingQuery = query(
      collection(db, 'pedidos'),
      where('clienteUid', '==', user.uid),
      where('createdAt', '>=', thirtyDaysAgo),
      where('status', '==', 'concluido')
    );

    // Simulação de ranking (em produção, isso viria de uma função Cloud Function)
    const mockRanking = [
      { uid: user.uid, nome: profile?.nome || 'Você', pontos: profile?.loyaltyPoints || 0, pedidos: 12, rank: 1, isVip: true },
      { uid: 'user2', nome: 'Maria Silva', pontos: 850, pedidos: 10, rank: 2, isVip: false },
      { uid: 'user3', nome: 'João Santos', pontos: 720, pedidos: 8, rank: 3, isVip: false },
      { uid: 'user4', nome: 'Ana Costa', pontos: 650, pedidos: 7, rank: 4, isVip: false },
      { uid: 'user5', nome: 'Carlos Souza', pontos: 500, pedidos: 6, rank: 5, isVip: false },
    ];

    setMonthlyRanking(mockRanking);
    const userPosition = mockRanking.find(r => r.uid === user.uid);
    if (userPosition) {
      setUserRank(userPosition.rank);
      setIsVip(userPosition.rank <= 3); // Top 3 = VIP
    }
  }, [user, profile]);

  const handleRedeem = async (reward: any) => {
    if (!user || !profile) return;
    
    if ((profile.loyaltyPoints || 0) < reward.cost) {
      toast.error("Pontos insuficientes para este resgate.");
      return;
    }

    if (!window.confirm(`Deseja trocar ${reward.cost} pontos por ${reward.description}?`)) return;

    setLoading(true);
    try {
      const couponCode = `FIDELIDADE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      // Salva o cupom resgatado na coleção do usuário para histórico
      await addDoc(collection(db, 'users', user.uid, 'my_coupons'), {
        code: couponCode,
        discount: reward.value,
        type: reward.type,
        description: reward.description,
        active: true,
        redeemedAt: serverTimestamp()
      });

      // Deduz os pontos do usuário
      const newPoints = (profile.loyaltyPoints || 0) - reward.cost;
      await updateDoc(doc(db, 'users', user.uid), {
        loyaltyPoints: newPoints
      });

      await refreshProfile();
      toast.success(`Resgate com sucesso! Seu código: ${couponCode}`, { icon: '🎁', duration: 5000 });
    } catch (error) {
      toast.error("Erro ao resgatar pontos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] p-6 pb-24 animate-in fade-in duration-500">
      <header className="flex items-center mb-8">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-[#1E1E1E] rounded-xl flex items-center justify-center text-white border border-white/5 active:scale-95"
        >
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <h1 className="text-xl font-black text-white ml-4 flex-1">Clube de Pontos</h1>
      </header>

      <div className="bg-gradient-to-br from-[#FF8C00] to-[#FF4500] p-8 rounded-[40px] text-center shadow-2xl shadow-[#FF8C00]/20 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
        <p className="text-white/80 text-xs font-black uppercase tracking-widest mb-2">Seu Saldo</p>
        <h2 className="text-5xl font-black text-white mb-2">{profile?.loyaltyPoints || 0}</h2>
        <p className="text-white/90 text-sm font-bold mb-6">pontos disponíveis</p>
        {/* Barra de progresso até o próximo resgate (gamificação) */}
        <div className="bg-white/10 rounded-full h-3 overflow-hidden border border-white/20">
          <div
            className="h-full rounded-full bg-white transition-all duration-700 ease-out"
            style={{ width: `${progressToNext}%` }}
          />
        </div>
        <p className="text-white/90 text-xs font-bold mt-3">
          {pointsToNext > 0 ? (
            <>Faltam <span className="font-black text-white">{pointsToNext}</span> pts para <span className="font-black">{nextReward.description}</span></>
          ) : (
            <span className="font-black text-white">Você pode resgatar!</span>
          )}
        </p>
      </div>

      <h3 className="text-white font-black uppercase text-[10px] tracking-[0.2em] mb-4 pl-2">Recompensas Disponíveis</h3>
      
      <div className="space-y-4">
        {rewards.map(reward => (
          <div key={reward.id} className="bg-[#1E1E1E] p-6 rounded-[32px] border border-white/5 flex items-center justify-between">
            <div>
              <h4 className="text-white font-bold text-lg">{reward.description}</h4>
              <p className="text-[#FF8C00] text-xs font-black mt-1">{reward.cost} Pontos</p>
            </div>
            <button 
              onClick={() => handleRedeem(reward)}
              disabled={loading || (profile?.loyaltyPoints || 0) < reward.cost}
              className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                (profile?.loyaltyPoints || 0) >= reward.cost 
                  ? 'bg-white text-black hover:bg-gray-200 active:scale-95' 
                  : 'bg-white/5 text-gray-500 cursor-not-allowed'
              }`}
            >
              Resgatar
            </button>
          </div>
        ))}
      </div>

      {/* RANKING MENSAL - GAMIFICAÇÃO */}
      <div className="mt-8">
        <h3 className="text-white font-black uppercase text-[10px] tracking-[0.2em] mb-4 pl-2">🏆 Ranking Mensal</h3>
        
        {/* STATUS VIP DO USUÁRIO */}
        {isVip && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-500/10 border border-yellow-500/30 p-4 rounded-2xl mb-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center border-2 border-yellow-500/50">
              <span className="text-2xl">👑</span>
            </div>
            <div className="flex-1">
              <p className="text-yellow-400 font-black text-sm">CLIENTE VIP</p>
              <p className="text-yellow-200 text-xs">Você está no TOP 3! Frete grátis na próxima compra.</p>
            </div>
            <div className="text-right">
              <p className="text-yellow-400 font-black text-2xl">#{userRank}</p>
              <p className="text-yellow-200 text-[10px]">Posição</p>
            </div>
          </div>
        )}

        {/* LISTA DE RANKING */}
        <div className="space-y-3">
          {monthlyRanking.map((user, index) => (
            <div 
              key={user.uid} 
              className={`bg-[#1E1E1E] p-4 rounded-2xl border flex items-center gap-4 transition-all ${
                user.uid === profile?.uid 
                  ? 'border-[#FF8C00] bg-[#FF8C00]/10' 
                  : 'border-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* POSIÇÃO */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                  user.rank === 1 ? 'bg-yellow-500 text-black' :
                  user.rank === 2 ? 'bg-gray-400 text-black' :
                  user.rank === 3 ? 'bg-orange-600 text-white' :
                  'bg-[#2A2A2A] text-gray-400'
                }`}>
                  {user.rank}
                </div>
                
                {/* AVATAR */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF8C00] to-[#FF4500] flex items-center justify-center text-white font-black text-sm border-2 border-white/10">
                  {user.nome.charAt(0).toUpperCase()}
                </div>
                
                {/* INFORMAÇÕES */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-bold">{user.nome}</p>
                    {user.isVip && (
                      <span className="bg-yellow-500/20 text-yellow-400 text-[8px] font-black px-2 py-0.5 rounded border border-yellow-500/30">VIP</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                    <span className="flex items-center gap-1">
                      <span>🪙</span>
                      <span>{user.pontos} pts</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span>📦</span>
                      <span>{user.pedidos} pedidos</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* BENEFÍCIOS VIP */}
        <div className="mt-6 bg-black/40 p-4 rounded-2xl border border-white/10">
          <h4 className="text-white font-black text-sm mb-3 flex items-center gap-2">
            <span>🎁</span> Benefícios VIP (Top 3)
          </h4>
          <ul className="space-y-2 text-xs text-gray-300">
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span>Frete grátis em todas as compras</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span>10% de pontos extras em cada pedido</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span>Acesso prioritário no suporte</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span>Cupons exclusivos mensais</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Rewards;