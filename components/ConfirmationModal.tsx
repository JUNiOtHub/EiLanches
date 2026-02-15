import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'success' | 'info';
  isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen, onClose, onConfirm, title, message, 
  confirmText = "Confirmar", cancelText = "Cancelar", 
  variant = 'danger', isLoading = false
}) => {
  if (!isOpen) return null;

  const variants = {
    danger: {
      icon: 'fa-trash-can',
      color: 'text-red-500',
      bg: 'bg-red-500',
      button: 'bg-red-600 hover:bg-red-700',
      glow: 'shadow-red-500/20'
    },
    warning: {
      icon: 'fa-triangle-exclamation',
      color: 'text-amber-500',
      bg: 'bg-amber-500',
      button: 'bg-amber-600 hover:bg-amber-700',
      glow: 'shadow-amber-500/20'
    },
    success: {
      icon: 'fa-circle-check',
      color: 'text-green-500',
      bg: 'bg-green-500',
      button: 'bg-green-600 hover:bg-green-700',
      glow: 'shadow-green-500/20'
    },
    info: {
      icon: 'fa-circle-info',
      color: 'text-blue-500',
      bg: 'bg-blue-500',
      button: 'bg-blue-600 hover:bg-blue-700',
      glow: 'shadow-blue-500/20'
    }
  };

  const theme = variants[variant];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#1E1E1E] w-full max-w-sm rounded-[40px] p-6 sm:p-8 border border-white/10 shadow-2xl text-center scale-100 animate-in zoom-in-95 duration-300 relative overflow-hidden">
        
        {/* Glow Effect */}
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 ${theme.bg} opacity-10 blur-[60px] pointer-events-none`}></div>

        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-[#1A1A1A] border border-white/5 shadow-xl ${theme.glow} relative z-10`}>
          <i className={`fa-solid ${theme.icon} text-3xl ${theme.color}`}></i>
        </div>
        
        <h3 className="text-white font-black text-2xl mb-3 tracking-tight relative z-10">{title}</h3>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed font-medium relative z-10">{message}</p>
        
        <div className="flex space-x-3 relative z-10">
          <button 
            onClick={onClose} 
            disabled={isLoading}
            className="flex-1 py-4 bg-white/5 text-gray-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm} 
            disabled={isLoading}
            className={`flex-1 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center ${theme.button} disabled:opacity-70 disabled:cursor-not-allowed`}
          >
            {isLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;