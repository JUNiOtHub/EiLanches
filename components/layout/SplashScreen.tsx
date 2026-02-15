import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  isFadingOut?: boolean;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ isFadingOut = false }) => {
  const [showFallback, setShowFallback] = useState(false);
  const [loadingPhrase, setLoadingPhrase] = useState("Preparando a chapa...");
  const [progress, setProgress] = useState(0);

  const phrases = [
    "Conectando aos melhores sabores...",
    "Aquecendo o forno...",
    "Buscando entregadores próximos...",
    "Quase pronto para o seu pedido!"
  ];

  useEffect(() => {
    setLoadingPhrase(phrases[Math.floor(Math.random() * phrases.length)]);
    
    // Simula uma barra de progresso orgânica
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 15;
      });
    }, 300);

    // Fallback se demorar muito (ex: internet lenta)
    const timer = setTimeout(() => {
      setShowFallback(true);
    }, 8000); 

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  return (
    <div 
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-gradient-to-br from-[#1a1a1a] via-[#0F0F0F] to-black transition-all duration-700 ease-in-out ${
        isFadingOut ? 'opacity-0 scale-110 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Decorativo Sutil */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-[#FF8C00]/10 blur-[150px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-[#FF4500]/10 blur-[150px] rounded-full animate-pulse delay-700"></div>
      </div>

      {/* Logo Container com Animação de Bounce/Float */}
      <div className="flex flex-col items-center justify-center flex-1 relative z-10">
        <div className={`w-32 h-32 md:w-48 md:h-48 relative mb-8 transition-all duration-1000 ${isFadingOut ? 'scale-90 opacity-0' : 'animate-float'}`}>
            {/* Glow atrás do logo */}
            <div className="absolute inset-0 bg-[#FF8C00] blur-[40px] opacity-20 rounded-full animate-pulse"></div>
            
            <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-2xl relative z-10">
              <defs>
                <linearGradient id="gradLogo" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF8C00" />
                  <stop offset="100%" stopColor="#FF5500" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="30" fill="url(#gradLogo)" className="drop-shadow-lg"/>
              <path d="M18 26 C18 18 46 18 46 26 Z" fill="white" className="drop-shadow-sm"/>
              <rect x="16" y="29" width="32" height="5" rx="2" fill="white" className="drop-shadow-sm"/>
              <path d="M18 36 L46 36 C46 43 18 43 18 36 Z" fill="white" className="drop-shadow-sm"/>
            </svg>
        </div>
        
        <div className="text-center overflow-hidden relative z-10">
           <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-2 flex items-center justify-center drop-shadow-lg">
            Ei<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF8C00] to-[#FF5500]">Lanches</span>
          </h1>
          <p className="text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-[0.5em] ml-1 opacity-80">
            Delivery Premium
          </p>
        </div>
      </div>

      {/* Footer / Loader */}
      <div className="mb-16 w-full max-w-xs px-8 flex flex-col items-center h-24 justify-end relative z-10">
        <div className="w-full flex flex-col items-center space-y-4">
            {/* Barra de Progresso */}
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#FF8C00] to-[#FF5500] transition-all duration-300 ease-out rounded-full shadow-[0_0_10px_rgba(255,140,0,0.5)]"
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest animate-pulse">{loadingPhrase}</p>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;