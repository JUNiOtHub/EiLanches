import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, doc, getDoc, addDoc, collection, serverTimestamp, onSnapshot } from '../firebase';
import toast from 'react-hot-toast';
import { financeConfig } from '../config/finance';

const Withdraw: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<{ saldoDisponivel: number; saldoPendente: number }>({ saldoDisponivel: 0, saldoPendente: 0 });
  const [loading, setLoading] = useState(false);
  const minValue = financeConfig.minWithdrawValue;
  const tax = financeConfig.withdrawTax;
  const canWithdraw = wallet.saldoDisponivel >= minValue;

  useEffect(() => {
    if (!user?.uid) return;
    const ref = doc(db, 'wallets', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setWallet({
          saldoDisponivel: Number(d?.saldoDisponivel ?? 0),
          saldoPendente: Number(d?.saldoPendente ?? 0),
        });
      } else {
        setWallet({ saldoDisponivel: 0, saldoPendente: 0 });
      }
    });
    return () => unsub();
  }, [user?.uid]);

  const handleSolicitarSaque = async () => {
    if (!user || wallet.saldoDisponivel < minValue) return;
    setLoading(true);
    try {
      const valor = wallet.saldoDisponivel;
      await addDoc(collection(db, 'solicitacoes_saque'), {
        userId: user.uid,
        userEmail: user.email ?? '',
        userName: profile?.nome ?? profile?.nomeLoja ?? 'Usuário',
        tipoUsuario: profile?.tipoUsuario ?? 'cliente',
        valor,
        taxa: tax,
        valorLiquido: valor - tax,
        status: 'pendente',
        createdAt: serverTimestamp(),
      });
      toast.success('Solicitação de saque enviada! Você receberá via PIX em até 24h.');
      navigate(-1);
    } catch {
      toast.error('Erro ao solicitar saque.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] p-6 pb-24 animate-in fade-in duration-300">
      <header className="flex items-center mb-8">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-[#1E1E1E] rounded-xl flex items-center justify-center text-white border border-white/5 active:scale-95">
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <h1 className="text-xl font-black text-white ml-4">Carteira & Saque</h1>
      </header>

      <div className="bg-[#1A1A1A] rounded-[32px] p-6 border border-white/5 mb-6">
        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">Disponível para saque</p>
        <p className="text-3xl font-black text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(wallet.saldoDisponivel)}</p>
        <p className="text-gray-500 text-xs mt-2">Pendente (após entregas): {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(wallet.saldoPendente)}</p>
      </div>

      <div className="bg-[#1A1A1A] rounded-[32px] p-6 border border-white/5 mb-8">
        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">Regras</p>
        <ul className="text-gray-400 text-sm space-y-1">
          <li>• Valor mínimo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(minValue)}</li>
          <li>• Taxa por saque: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tax)}</li>
          <li>• Pagamento via PIX em até 24h úteis</li>
        </ul>
      </div>

      <button
        onClick={handleSolicitarSaque}
        disabled={!canWithdraw || loading}
        className={`w-full py-4 rounded-2xl font-black uppercase text-sm tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${
          canWithdraw ? 'bg-[#FF8C00] text-white shadow-lg shadow-[#FF8C00]/20' : 'bg-white/5 text-gray-500 cursor-not-allowed'
        }`}
      >
        {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-pix"></i>}
        {canWithdraw ? 'Solicitar Saque via PIX' : `Mínimo ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(minValue)}`}
      </button>
    </div>
  );
};

export default Withdraw;
