// utils/envCheck.ts
const requiredEnvs = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_MERCADO_PAGO_PUBLIC_KEY', // Necessário para o checkout transparente
  // 'VITE_ASAAS_API_KEY', // Opcional em dev se usar mock
  // 'VITE_UNSPLASH_ACCESS_KEY' // Opcional, tem fallback no código (embora ideal seja no env)
];

export const validateEnv = () => {
  const missing = requiredEnvs.filter(key => !import.meta.env[key]);

  if (missing.length > 0) {
    console.error("❌ ERRO CRÍTICO DE CONFIGURAÇÃO:");
    console.error(`Faltam as seguintes variáveis no seu arquivo .env: \n- ${missing.join('\n- ')}`);
    
    // No ambiente de desenvolvimento, isso vai dar um alerta na tela
    if (import.meta.env.DEV) {
      // Usamos setTimeout para garantir que o alerta apareça após o carregamento inicial
      setTimeout(() => {
        alert(`Sócio, o app não vai funcionar! Adicione no .env: \n${missing.join('\n')}`);
      }, 1000);
    }
    
    return false;
  }
  
  console.log("✅ Ambiente configurado corretamente. EiLanches pronto para rodar!");
  return true;
};