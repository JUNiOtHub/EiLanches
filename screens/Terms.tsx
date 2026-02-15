import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, doc, updateDoc } from '../firebase';
import toast from 'react-hot-toast';
import { termsContent } from '../config/terms';
import { motion } from 'framer-motion';

const Terms: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Torna a busca do tipo de usuário mais robusta, usando o state do react-router como primário
  // e o perfil do usuário como fallback, caso a página seja recarregada.
  const userType = (location.state as { userType: 'cliente' | 'vendedor' | 'entregador' })?.userType || profile?.tipoUsuario;

  const [loading, setLoading] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Redireciona para a home se o tipo de usuário não puder ser determinado.
  useEffect(() => {
    if (!userType && !loading && profile) { // Evita redirecionamento durante o carregamento inicial
      toast.error("Não foi possível determinar seu perfil. Redirecionando...");
      navigate('/');
    }
  }, [userType, navigate, loading, profile]);

  const terms = userType ? termsContent[userType] : { title: "Carregando...", content: "Aguarde..." };
  const termsVersion = import.meta.env.VITE_TERMS_VERSION || '1.0';

  const handleScroll = () => {
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current!;
    if (scrollTop + clientHeight >= scrollHeight - 20) { // 20px de margem
      setScrolledToEnd(true);
    }
  };

  const handleAccept = async () => {
    if (!user || !profile || !userType) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      
      // Atualiza o campo de termos aceitos.
      // Usamos um objeto para versionar o aceite de cada tipo de perfil.
      const currentTerms = profile.termsAccepted || {};
      await updateDoc(userRef, {
        termsAccepted: {
          ...currentTerms,
          [userType]: termsVersion
        }
      });

      toast.success('Termos aceitos! Preparando seu acesso...');
      
      // Força a atualização do perfil e o roteador do App.tsx cuidará do resto.
      await refreshProfile();

    } catch (error) {
      toast.error('Erro ao aceitar os termos.');
      setLoading(false);
    }
  };

  useEffect(() => {
    // Se o usuário já aceitou os termos, não deveria estar aqui. Redireciona.
    if (userType && profile?.termsAccepted?.[userType] === termsVersion) {
        navigate('/');
    }
  }, [profile, userType, navigate, termsVersion]);

  // Exibe um spinner enquanto o userType não é determinado (evita crash)
  if (!userType) {
    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0a0a0a] p-6 font-sans text-white">
            <i className="fa-solid fa-spinner fa-spin text-2xl text-[#FF8C00]"></i>
        </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0a0a0a] p-6 font-sans text-white animate-in fade-in duration-500">
      <div className="absolute top-6 left-6 z-20">
          <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white transition-colors active:scale-95">
              <i className="fa-solid fa-arrow-left"></i>
          </button>
      </div>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#181818] border border-white/10 rounded-3xl p-8 shadow-2xl w-full max-w-2xl flex flex-col relative"
      >
        <h1 className="text-2xl font-black text-white mb-4">{terms.title}</h1>
        <p className="text-sm text-gray-400 mb-6">Por favor, leia e aceite os termos para continuar.</p>
        
        <div className="relative mb-6">
            <div 
              ref={contentRef}
              onScroll={handleScroll}
              className="bg-black/40 border border-white/10 rounded-xl p-6 h-64 overflow-y-auto custom-scrollbar"
            >
              <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans">{terms.content}</pre>
            </div>
            {!scrolledToEnd && (
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#181818] to-transparent pointer-events-none"></div>
            )}
        </div>

        <button
          onClick={handleAccept}
          disabled={!scrolledToEnd || loading}
          className="w-full py-4 bg-[#FF8C00] text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-[#FF8C00]/20 hover:bg-[#FF9900] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : (scrolledToEnd ? 'Aceitar e Continuar' : 'Role até o final para aceitar')}
        </button>
      </motion.div>
    </div>
  );
};

export default Terms;