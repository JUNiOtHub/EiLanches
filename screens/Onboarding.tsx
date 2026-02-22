import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { db, doc, setDoc } from '../firebase';
// import { TermsModal } from '../components/TermsModal'; // Temporariamente desativado

// --- UTILITY FUNCTIONS ---

export const maskPhone = (v: string) => {
  v = v.replace(/\D/g, '').slice(0, 11);
  if (v.length > 10) return v.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (v.length > 6) return v.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  if (v.length > 2) return v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
  return v;
};

export const maskCep = (v: string) => v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');

export const isValidCPF = (cpf: string) => {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
  let soma = 0;
  for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;
  soma = 0;
  for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;
  return true;
};

export const isValidCNPJ = (cnpj: string): boolean => {
    cnpj = cnpj.replace(/[^\d]+/g, '');
    if (cnpj.length !== 14 || !!cnpj.match(/(\d)\1{13}/)) return false;
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    const digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
        if (pos < 2) pos = 9;
    }
    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(0), 10)) return false;
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
        if (pos < 2) pos = 9;
    }
    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(1), 10)) return false;
    return true;
};

export const maskDocument = (v: string) => {
    v = v.replace(/\D/g, '');
    if (v.length <= 11) {
        return v.slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
        return v.slice(0, 14).replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
    }
};

// --- TYPES ---

type VehicleType = 'moto' | 'carro' | 'bicicleta' | 'nenhum';

interface UserUpdateData {
  tipoUsuario: 'cliente' | 'vendedor' | 'entregador' | null;
  documento: string;
  telefone: string;
  cep: string;
  endereco: string;
  onboardedAt: string;
  lojaId?: string;
  nomeLoja?: string;
  chavePix?: string;
  deliveryMode?: 'own' | 'app';
  vehicleType?: VehicleType | null;
}

const Onboarding: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [tipo, setTipo] = useState<'cliente' | 'vendedor' | 'entregador' | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [showIpWarning, setShowIpWarning] = useState(false);
  const isProcessing = useRef(false);

  const [formData, setFormData] = useState({
    cpfCnpj: '',
    nomeLoja: '',
    cep: '',
    endereco: '',
    telefone: '',
    chavePix: '',
    deliveryMode: 'app' as 'own' | 'app',
    vehicleType: null as VehicleType | null,
    agreedToTerms: false,
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    // Verifica se está rodando em IP local (causa comum de erro CORS no Firebase)
    const hostname = window.location.hostname;
    const isIp = /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(hostname);
    if (isIp && hostname !== '127.0.0.1') {
      setShowIpWarning(true);
    }

    if (user?.uid) {
      const draftKey = `onboarding_draft_${user.uid}`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const draftData = JSON.parse(savedDraft);
          if (draftData.formData) setFormData(prev => ({ ...prev, ...draftData.formData }));
          if (draftData.tipo) {
            setTipo(draftData.tipo);
            setStep(2);
          }
        } catch (e) {
          console.error("Failed to load onboarding draft.", e);
          localStorage.removeItem(draftKey);
        }
      }
    }
  }, [user]);

  useEffect(() => {
    if (user?.uid && step === 2) {
      const draftKey = `onboarding_draft_${user.uid}`;
      localStorage.setItem(draftKey, JSON.stringify({ formData, tipo }));
    }
  }, [formData, tipo, user, step]);

  const handleCepLookup = async () => {
    const cleanCep = formData.cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      toast.error('CEP inválido. Deve conter 8 dígitos.');
      return;
    }
    setIsCepLoading(true);
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        if (!response.ok) throw new Error('CEP not found');
        const data = await response.json();
        if (data.erro) {
            toast.error('CEP não encontrado.');
            setErrors(prev => ({...prev, cep: 'CEP não encontrado'}));
            return;
        }
        const fullAddress = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
        setFormData(prev => ({...prev, endereco: fullAddress}));
        toast.success('Endereço preenchido automaticamente!');
    } catch (error) {
        console.error("Error fetching CEP:", error);
        toast.error("Não foi possível consultar o CEP.");
    } finally {
        setIsCepLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.telefone || formData.telefone.length < 14) newErrors.telefone = "Telefone inválido";
    if (!formData.cep || formData.cep.length < 9) newErrors.cep = "CEP inválido";
    if (!formData.endereco || formData.endereco.length < 10) newErrors.endereco = "Endereço muito curto (mín. 10 caracteres)";
    if (!formData.agreedToTerms) newErrors.agreedToTerms = "Você deve aceitar os termos de serviço";
    
    if (formData.cpfCnpj) {
      const cleanDoc = formData.cpfCnpj.replace(/[^\d]+/g, '');
      if (cleanDoc.length === 11 && !isValidCPF(cleanDoc)) {
        newErrors.cpfCnpj = "CPF inválido";
      } else if (cleanDoc.length === 14 && !isValidCNPJ(cleanDoc)) {
        newErrors.cpfCnpj = "CNPJ inválido";
      } else if (cleanDoc.length > 0 && cleanDoc.length !== 11 && cleanDoc.length !== 14) {
        newErrors.cpfCnpj = "Documento incompleto";
      }
    }

    if (tipo === 'vendedor') {
      if (!formData.nomeLoja) newErrors.nomeLoja = "Nome da loja é obrigatório";
      if (!formData.chavePix) newErrors.chavePix = "Chave PIX é obrigatória";
    }

    if(tipo === 'entregador') {
      if(!formData.vehicleType) newErrors.vehicleType = "Selecione uma opção de veículo";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFinish = async () => {
    if (isProcessing.current || !validateForm()) {
      toast.error('Por favor, corrija os erros e preencha todos os campos obrigatórios.');
      return;
    }
    isProcessing.current = true;
    setLoading(true);
    
    try {
      const userRef = doc(db, 'users', user!.uid);
      const updateData: UserUpdateData = {
        tipoUsuario: tipo,
        documento: formData.cpfCnpj,
        telefone: formData.telefone,
        cep: formData.cep,
        endereco: formData.endereco,
        onboardedAt: new Date().toISOString()
      };

      if (tipo === 'vendedor') {
        updateData.lojaId = user!.uid; 
        updateData.nomeLoja = formData.nomeLoja || `Loja de ${profile?.nome}`;
        updateData.chavePix = formData.chavePix;
        updateData.deliveryMode = formData.deliveryMode;
      }
      
      if (tipo === 'entregador') {
        updateData.vehicleType = formData.vehicleType;
      }

      await setDoc(userRef, updateData, { merge: true });

      if (user?.uid) {
        localStorage.removeItem(`onboarding_draft_${user.uid}`);
      }

      if (refreshProfile) await refreshProfile();
      
      toast.success('Cadastro concluído com sucesso! Bem-vindo(a)!');

    } catch (error) {
      console.error("Erro crítico ao finalizar cadastro:", error);
      toast.error("Erro ao salvar. Tente novamente.");
      setLoading(false);
      isProcessing.current = false;
    }
  };

  const setFormField = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({...prev, [field]: value }));
    if(errors[field]) setErrors(prev => {
        const newErrors = {...prev};
        delete newErrors[field];
        return newErrors;
    });
  }

  // --- RENDER ---

  if (step === 1) {
    return (
      <div className="h-[100dvh] bg-[#0F0F0F] flex flex-col p-6 md:p-12 items-center justify-center animate-in fade-in zoom-in duration-500 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1a1a1a] via-[#0F0F0F] to-[#0F0F0F]">
        <div className="mb-12 text-center max-w-lg">
          <div className="w-24 h-24 bg-gradient-to-br from-[#FF8C00] to-[#FF4500] rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(255,140,0,0.3)] border-4 border-white/10">
            <i className="fa-solid fa-hand-sparkles text-white text-4xl"></i>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Quase lá, <span className="text-[#FF8C00]">{profile?.nome.split(' ')[0]}!</span></h1>
          <p className="text-gray-400 font-medium text-lg">Como você pretende usar o EiLanches hoje?</p>
        </div>

        <div className="w-full max-w-md space-y-6">
          <button onClick={() => { setTipo('cliente'); setStep(2); }} className="w-full bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 rounded-[40px] text-left group hover:border-[#FF8C00]/50 transition-all duration-300 ease-out active:scale-95 flex items-center space-x-6 shadow-2xl hover:shadow-[0_0_40px_rgba(255,140,0,0.1)]">
            <div className="w-16 h-16 bg-[#FF8C00]/10 rounded-2xl flex items-center justify-center border border-[#FF8C00]/20 group-hover:bg-[#FF8C00] transition-colors duration-300">
              <i className="fa-solid fa-burger text-[#FF8C00] group-hover:text-white text-3xl"></i>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Sou Cliente</h3>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Quero pedir comida</p>
            </div>
          </button>

          <button onClick={() => { setTipo('vendedor'); setStep(2); }} className="w-full bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 rounded-[40px] text-left group hover:border-blue-500/50 transition-all duration-300 ease-out active:scale-95 flex items-center space-x-6 shadow-2xl hover:shadow-[0_0_40px_rgba(59,130,246,0.1)]">
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-500 transition-colors duration-300">
              <i className="fa-solid fa-store text-blue-500 group-hover:text-white text-3xl"></i>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Sou Lojista</h3>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Quero vender lanches</p>
            </div>
          </button>

          <button onClick={() => { setTipo('entregador'); setStep(2); }} className="w-full bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 rounded-[40px] text-left group hover:border-green-500/50 transition-all duration-300 ease-out active:scale-95 flex items-center space-x-6 shadow-2xl hover:shadow-[0_0_40px_rgba(34,197,94,0.1)]">
            <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center border border-green-500/20 group-hover:bg-green-500 transition-colors duration-300">
              <i className="fa-solid fa-motorcycle text-green-500 group-hover:text-white text-3xl"></i>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Sou Entregador</h3>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Quero fazer entregas</p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    {/* <TermsModal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} /> */}
    <div className="h-[100dvh] bg-[#0F0F0F] flex flex-col animate-in slide-in-from-right duration-500 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1a1a1a] via-[#0F0F0F] to-[#0F0F0F]">
      
      {/* ALERTA DE CONFIGURAÇÃO FIREBASE (CORS) */}
      {showIpWarning && (
        <div className="bg-orange-600 text-white px-4 py-2 text-[10px] font-bold text-center animate-pulse">
          <p>⚠️ Acesso via IP ({window.location.hostname}) detectado.</p>
          <p className="opacity-80 font-normal">
            Se tiver erro de conexão, adicione este IP em: <br/>
            Firebase Console &gt; Authentication &gt; Settings &gt; Authorized Domains
          </p>
        </div>
      )}

      <div className="shrink-0 p-6 md:px-12 pt-8">
        <button onClick={() => setStep(1)} className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mb-6 flex items-center hover:text-white transition-colors">
          <i className="fa-solid fa-arrow-left-long mr-3"></i> Alterar Perfil
        </button>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">Finalizar <span className="text-[#FF8C00]">Configurações</span></h2>
        <p className="text-gray-400 font-medium">Preencha os dados abaixo para continuar.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 md:px-12 space-y-6 pt-6 pb-32">
        {tipo === 'vendedor' && (
          <div className="p-6 bg-white/5 rounded-3xl space-y-6">
            <h3 className='text-lg font-bold text-white mb-2'>Dados da Loja</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#FF8C00] ml-4">Nome da sua Loja</label>
                <div className="relative">
                  <i className="fa-solid fa-shop absolute left-6 top-1/2 -translate-y-1/2 text-gray-700"></i>
                  <input placeholder="Ex: Lanches do Zé" value={formData.nomeLoja} onChange={e => setFormField('nomeLoja', e.target.value)} className={`w-full bg-white/[0.03] border rounded-2xl pl-14 pr-6 py-5 text-white placeholder:text-gray-600 outline-none transition-all min-h-[64px] backdrop-blur-md ${errors.nomeLoja ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#FF8C00] focus:bg-white/[0.05]'}`}/>
                </div>
                {errors.nomeLoja && <p className="text-red-500 text-[10px] font-bold ml-4 mt-1">{errors.nomeLoja}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#FF8C00] ml-4">Chave PIX (Para Receber)</label>
                <div className="relative">
                  <i className="fa-solid fa-qrcode absolute left-6 top-1/2 -translate-y-1/2 text-gray-700"></i>
                  <input placeholder="Sua chave PIX" value={formData.chavePix} onChange={e => setFormField('chavePix', e.target.value)} className={`w-full bg-white/[0.03] border rounded-2xl pl-14 pr-6 py-5 text-white placeholder:text-gray-600 outline-none transition-all min-h-[64px] backdrop-blur-md ${errors.chavePix ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#FF8C00] focus:bg-white/[0.05]'}`}/>
                </div>
                {errors.chavePix && <p className="text-red-500 text-[10px] font-bold ml-4 mt-1">{errors.chavePix}</p>}
              </div>

              <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#FF8C00] ml-4">Logística de Entrega</label>
              <div className="flex space-x-3 h-full">
                <button onClick={() => setFormField('deliveryMode', 'app')} className={`flex-1 p-4 rounded-2xl border transition-all duration-300 text-center ${formData.deliveryMode === 'app' ? 'bg-[#FF8C00]/20 border-[#FF8C00] text-white shadow-[0_0_20px_rgba(255,140,0,0.15)]' : 'bg-white/[0.03] border-white/10 text-gray-400 hover:bg-white/[0.05]'}`}>
                  <div className="font-bold text-xs uppercase mb-1">Usar App</div>
                  <div className="text-[10px]">Contratar entregadores parceiros</div>
                </button>
                <button onClick={() => setFormField('deliveryMode', 'own')} className={`flex-1 p-4 rounded-2xl border transition-all duration-300 text-center ${formData.deliveryMode === 'own' ? 'bg-[#FF8C00]/20 border-[#FF8C00] text-white shadow-[0_0_20px_rgba(255,140,0,0.15)]' : 'bg-white/[0.03] border-white/10 text-gray-400 hover:bg-white/[0.05]'}`}>
                  <div className="font-bold text-xs uppercase mb-1">Própria</div>
                  <div className="text-[10px]">Tenho meus motoboys</div>
                </button>
              </div>
            </div>
            </div>
          </div>
        )}

        {tipo === 'entregador' && (
          <div className="p-6 bg-white/5 rounded-3xl space-y-4">
             <h3 className='text-lg font-bold text-white'>Dados de Entregador</h3>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#FF8C00] ml-4">Qual seu veículo?</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['moto', 'carro', 'bicicleta', 'nenhum'] as VehicleType[]).map(vType => (
                <button key={vType} onClick={() => setFormField('vehicleType', vType)} className={`p-4 rounded-2xl border transition-all duration-300 text-center ${formData.vehicleType === vType ? 'bg-green-500/20 border-green-500 text-white' : 'bg-white/[0.03] border-white/10 text-gray-400 hover:bg-white/[0.05]'}`}>
                  <div className="font-bold text-sm capitalize">{vType === 'nenhum' ? 'Nenhum' : vType}</div>
                </button>
              ))}
            </div>
            {errors.vehicleType && <p className="text-red-500 text-[10px] font-bold ml-4 mt-1">{errors.vehicleType}</p>}
          </div>
        )}

        <div className="p-6 bg-white/5 rounded-3xl space-y-6">
            <h3 className='text-lg font-bold text-white'>Seus Dados de Contato e Endereço</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#FF8C00] ml-4">Seu Celular / WhatsApp</label>
                    <div className="relative">
                        <i className="fa-brands fa-whatsapp absolute left-6 top-1/2 -translate-y-1/2 text-gray-700"></i>
                        <input placeholder="(99) 99999-9999" value={formData.telefone} onChange={e => setFormField('telefone', maskPhone(e.target.value))} className={`w-full bg-white/[0.03] border rounded-2xl pl-14 pr-6 py-5 text-white placeholder:text-gray-600 outline-none transition-all min-h-[64px] backdrop-blur-md ${errors.telefone ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#FF8C00] focus:bg-white/[0.05]'}`}/>
                    </div>
                    {errors.telefone && <p className="text-red-500 text-[10px] font-bold ml-4 mt-1">{errors.telefone}</p>}
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-4">CPF / CNPJ (Opcional)</label>
                    <input placeholder="Seu CPF ou CNPJ" value={formData.cpfCnpj} onChange={e => setFormField('cpfCnpj', maskDocument(e.target.value))} className={`w-full bg-white/[0.03] border rounded-2xl px-6 py-5 text-white placeholder:text-gray-600 outline-none transition-all min-h-[64px] backdrop-blur-md ${errors.cpfCnpj ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#FF8C00] focus:bg-white/[0.05]'}`}/>
                    {errors.cpfCnpj && <p className="text-red-500 text-[10px] font-bold ml-4 mt-1">{errors.cpfCnpj}</p>}
                </div>
                <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#FF8C00] ml-4">CEP</label>
                    <div className="relative">
                        <i className="fa-solid fa-location-crosshairs absolute left-6 top-1/2 -translate-y-1/2 text-gray-700"></i>
                        <input placeholder="00000-000" value={formData.cep} onChange={e => setFormField('cep', maskCep(e.target.value))} onBlur={handleCepLookup} className={`w-full bg-white/[0.03] border rounded-2xl pl-14 pr-32 py-5 text-white placeholder:text-gray-600 outline-none transition-all min-h-[64px] backdrop-blur-md ${errors.cep ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#FF8C00] focus:bg-white/[0.05]'}`}/>
                        <button onClick={handleCepLookup} disabled={isCepLoading} className="absolute right-4 top-1/2 -translate-y-1/2 bg-[#FF8C00]/80 h-10 px-4 rounded-lg text-xs font-bold uppercase text-white hover:bg-[#FF8C00] disabled:opacity-50 disabled:cursor-wait">
                            {isCepLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Buscar'}
                        </button>
                    </div>
                    {errors.cep && <p className="text-red-500 text-[10px] font-bold ml-4 mt-1">{errors.cep}</p>}
                </div>
                <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#FF8C00] ml-4">Endereço Completo</label>
                    <div className="relative">
                        <i className="fa-solid fa-map-location-dot absolute left-6 top-6 text-gray-700"></i>
                        <textarea placeholder="Rua, Número, Bairro e Ponto de Referência" value={formData.endereco} onChange={e => setFormField('endereco', e.target.value)} rows={3} className={`w-full bg-white/[0.03] border rounded-[32px] pl-14 pr-6 py-5 text-white placeholder:text-gray-600 outline-none transition-all resize-none min-h-[120px] backdrop-blur-md ${errors.endereco ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#FF8C00] focus:bg-white/[0.05]'}`}/>
                    </div>
                    {errors.endereco && <p className="text-red-500 text-[10px] font-bold ml-4 mt-1">{errors.endereco}</p>}
                </div>
            </div>
        </div>

        <div className="p-4">
            <div className="flex items-start space-x-4">
                <input id="terms-checkbox" type="checkbox" className="hidden" checked={formData.agreedToTerms} onChange={e => setFormField('agreedToTerms', e.target.checked)}/>
                <label htmlFor="terms-checkbox" className="flex-shrink-0 cursor-pointer">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-300 ${formData.agreedToTerms ? 'bg-[#FF8C00] border-[#FF8C00] shadow-[0_0_15px_rgba(255,140,0,0.3)]' : 'border-white/20 bg-white/5'}`}>
                      {formData.agreedToTerms && <i className="fa-solid fa-check text-white text-xs"></i>}
                    </div>
                </label>
                <div className="flex-1">
                    <label htmlFor="terms-checkbox" className="text-gray-400 text-sm cursor-pointer">
                        Eu li e concordo com os{' '}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                navigate('/terms', { state: { userType: tipo } });
                            }}
                            className="text-[#FF8C00] font-bold hover:underline"
                        >
                            Termos de Serviço
                        </button>.
                    </label>
                    {errors.agreedToTerms && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.agreedToTerms}</p>}
                </div>
            </div>
        </div>
      </div>

      <div className="shrink-0 p-6 md:px-12 bg-gradient-to-t from-[#0F0F0F] via-[#0F0F0F] to-transparent">
        <button onClick={handleFinish} disabled={loading || !formData.agreedToTerms} className="w-full min-h-[72px] bg-[#FF8C00] text-white rounded-[32px] font-bold uppercase tracking-widest text-[11px] shadow-[0_0_40px_rgba(255,140,0,0.3)] hover:shadow-[0_0_60px_rgba(255,140,0,0.5)] flex items-center justify-center transition-all duration-300 ease-out active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed">
          {loading ? <i className="fa-solid fa-spinner fa-spin text-xl mr-3"></i> : <i className="fa-solid fa-circle-check text-xl mr-3"></i>}
          <span>{loading ? 'Salvando...' : 'Concluir Meu Cadastro'}</span>
        </button>
      </div>
    </div>
    </>
  );
};

export default Onboarding;