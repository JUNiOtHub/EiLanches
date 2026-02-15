
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  auth, db, googleProvider, signInWithPopup, 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  doc, setDoc, getDoc, firebaseConfig 
} from '../firebase';

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [apiError, setApiError] = useState<{ message: string; type: 'config' | 'auth' | 'firestore' | 'domain' | 'validation' } | null>(null);
  const [copied, setCopied] = useState(false);

  const currentHostname = window.location.hostname;

  useEffect(() => {
    // Detecção proativa de IP para avisar o desenvolvedor
    const isIp = /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(currentHostname);
    if (isIp && currentHostname !== '127.0.0.1') {
      setApiError({ type: 'domain', message: 'Acesso via IP detectado.' });
    }
  }, [currentHostname]);

  useEffect(() => {
    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
    link.type = 'image/svg+xml';
    link.rel = 'shortcut icon';
    link.href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='32' fill='%23FF8C00'/%3E%3Cpath d='M18 26 C18 18 46 18 46 26 Z' fill='white'/%3E%3Crect x='16' y='29' width='32' height='6' rx='2' fill='white'/%3E%3Cpath d='M18 38 L46 38 C46 44 18 44 18 38 Z' fill='white'/%3E%3C/svg%3E";
    document.head.appendChild(link);
  }, []);

  const checkAndCreateUser = async (user: any, displayName: string | null) => {
    if (!db) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          nome: displayName || 'Cliente EiLanches',
          tipoUsuario: null,
          lojaId: null,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error: any) {
      if (error.message?.includes('firestore.googleapis.com') || error.code === 'permission-denied') {
        setApiError({
          type: 'firestore',
          message: `Conecte o Firestore no Cloud Console.`
        });
        throw error;
      }
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setApiError(null);
    setTimeout(() => setApiError(null), 0); // Limpa o erro assincronamente
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await checkAndCreateUser(result.user, result.user.displayName);
    } catch (error: any) {
      const errMsg = error.message || "";
      if (error.code === 'auth/unauthorized-domain' || errMsg.includes('unauthorized-domain')) {
        setApiError({
          type: 'domain',
          message: `Domínio não autorizado.`
        });
      } else {
        setApiError({
          type: 'auth',
          message: "Erro: " + (error.code || "Conexão falhou")
        });
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    // Adia a limpeza do erro da API para evitar que uma re-renderização síncrona bloqueie o manipulador de clique
    // se uma UI de erro complexa foi exibida anteriormente.

    // Validação de senha no lado do cliente (UX Preventiva)
    if (!isLogin && password.length < 6) {
      setApiError({
        type: 'validation',
        message: 'A senha deve ter pelo menos 6 caracteres para sua segurança.'
      });
      return;
    }

    setTimeout(() => setApiError(null), 0); // Limpa o erro assincronamente
    setLoading(true);
    try {
      if (isLogin) {
        const { user } = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
        await checkAndCreateUser(user, null);
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
        await checkAndCreateUser(user, nome.trim());
      }
    } catch (error: any) {
      if (error.code === 'auth/unauthorized-domain') {
        setApiError({ type: 'domain', message: `Domínio não autorizado.` });
      } else if (error.code === 'auth/weak-password') {
        setApiError({ type: 'password', message: `Senha fraca.` });
      } else if (error.code === 'auth/email-already-in-use') {
        setApiError({ type: 'auth', message: 'Este e-mail já está sendo usado. Faça login.' });
      } else if (error.code === 'auth/invalid-credential') {
        setApiError({ type: 'auth', message: 'E-mail ou senha incorretos.' });
      } else {
        setApiError({ type: 'auth', message: "Ocorreu um problema. Tente novamente." });
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = currentHostname;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      toast.error("Erro ao copiar. Selecione o texto manualmente.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center p-6 animate-in fade-in duration-700">
      <div className="w-full max-w-md">
        
        {/* ERRO DE DOMÍNIO (ORANGE ALERT) */}
        {apiError && (apiError.type === 'domain' || apiError.message.includes('unauthorized-domain')) && (
          <div className="mb-8 bg-[#FF8C00] text-black p-8 rounded-[40px] shadow-[0_20px_50px_rgba(255,140,0,0.3)] animate-in slide-in-from-top duration-500">
            <div className="flex items-center space-x-3 mb-4">
              <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
              <h4 className="font-black text-lg uppercase tracking-tighter">Ação Necessária!</h4>
            </div>
            <p className="font-bold text-sm mb-6 leading-tight">O Firebase bloqueou este IP/Domínio por segurança. Para corrigir:</p>
            <div className="bg-black/20 p-4 rounded-2xl mb-6 border border-black/10">
              <input 
                readOnly 
                value={currentHostname} 
                className="w-full bg-transparent border-none text-black font-mono text-sm font-black focus:ring-0"
              />
              <button onClick={copyToClipboard} className="mt-4 w-full bg-black text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest">
                {copied ? 'COPIADO!' : 'COPIAR LINK'}
              </button>
            </div>
            <a href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`} target="_blank" className="block w-full bg-white text-black text-center font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl">Ir para Console &gt; Auth &gt; Settings</a>
          </div>
        )}

        <div className="text-center mb-10">
          <div className="inline-block p-4 bg-[#FF8C00] rounded-[32px] mb-6 shadow-2xl shadow-[#FF8C00]/20 animate-bounce-short">
             <i className="fa-solid fa-burger text-3xl text-white"></i>
          </div>
          <h1 className="text-5xl font-black text-white mb-2 tracking-tighter">Ei<span className="text-[#FF8C00]">Lanches</span></h1>
          <p className="text-gray-500 font-medium tracking-tight">O delivery premium do nosso povoado</p>
        </div>

        <div className="bg-[#1E1E1E] rounded-[48px] p-8 border border-white/5 shadow-2xl">
          {/* FEEDBACK DE ERRO VISÍVEL */}
          {apiError && (apiError.type === 'auth' || apiError.type === 'validation') && (
            <div className="mb-6 bg-red-500/10 border-2 border-red-500/20 p-5 rounded-3xl flex items-center space-x-4 animate-in shake duration-500">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center shrink-0">
                <i className="fa-solid fa-circle-exclamation text-red-500"></i>
              </div>
              <p className="text-red-500 text-[11px] font-black uppercase leading-tight tracking-wide">{apiError.message}</p>
            </div>
          )}

          <button 
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="w-full min-h-[64px] bg-white text-gray-900 rounded-[24px] font-black flex items-center justify-center space-x-4 mb-8 active:scale-95 disabled:opacity-50 transition-all shadow-xl"
          >
            {googleLoading ? <i className="fa-solid fa-circle-notch fa-spin text-xl"></i> : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="G" />
                <span className="text-xs uppercase tracking-[0.1em]">Acessar com Google</span>
              </>
            )}
          </button>

          <div className="flex items-center space-x-4 mb-8 opacity-20">
            <div className="h-[1px] flex-1 bg-white"></div>
            <span className="text-white text-[9px] font-black uppercase tracking-[0.3em]">Ou</span>
            <div className="h-[1px] flex-1 bg-white"></div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-4">Como devemos te chamar?</label>
                <input 
                  placeholder="Seu Nome Completo" 
                  value={nome}
                  autoComplete="name"
                  onChange={e => setNome(e.target.value)}
                  className="w-full bg-black/40 border-2 border-white/5 rounded-2xl px-6 py-5 text-white outline-none focus:border-[#FF8C00] transition-all min-h-[64px]"
                  required={!isLogin}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-4">Seu E-mail</label>
              <input 
                placeholder="email@exemplo.com" 
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full bg-black/40 border-2 border-white/5 rounded-2xl px-6 py-5 text-white outline-none focus:border-[#FF8C00] transition-all min-h-[64px]"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-4">Sua Senha (mín. 6 dígitos)</label>
              <input 
                placeholder="••••••••" 
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-black/40 border-2 border-white/5 rounded-2xl px-6 py-5 text-white outline-none focus:border-[#FF8C00] transition-all min-h-[64px]"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
              />
            </div>

            <button 
              disabled={loading || googleLoading}
              className="w-full min-h-[64px] bg-[#FF8C00] text-white rounded-[24px] font-black uppercase text-xs tracking-[0.2em] shadow-[0_15px_40px_rgba(255,140,0,0.3)] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center mt-6"
            >
              {loading ? <i className="fa-solid fa-circle-notch fa-spin text-xl"></i> : (
                <div className="flex items-center">
                  <i className={`fa-solid ${isLogin ? 'fa-right-to-bracket' : 'fa-user-plus'} mr-3`}></i>
                  <span>{isLogin ? 'Entrar na Conta' : 'Criar minha Conta'}</span>
                </div>
              )}
            </button>

            <button 
              type="button"
              onClick={() => { setIsLogin(!isLogin); setApiError(null); }}
              className="w-full text-[#FF8C00] text-[10px] font-black uppercase tracking-widest mt-6 hover:opacity-70 transition-all py-4"
            >
              {isLogin ? 'Ainda não tem conta? Clique aqui' : 'Já é de casa? Faça o login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
