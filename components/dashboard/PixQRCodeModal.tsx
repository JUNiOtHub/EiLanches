import React from 'react';
import { motion } from 'framer-motion';

interface PixQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixKey?: string | null;
}

const PixQRCodeModal: React.FC<PixQRCodeModalProps> = ({ isOpen, onClose, pixKey }) => {
  if (!isOpen) return null;

  const qrCodeUrl = pixKey 
    ? `https://chart.googleapis.com/chart?cht=qr&chl=${encodeURIComponent(pixKey)}&chs=250x250&choe=UTF-8&chld=L|2`
    : '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#1E1E1E] w-full max-w-sm rounded-[40px] p-8 border border-white/10 text-center shadow-2xl"
      >
        <h3 className="text-white font-bold mb-6 uppercase tracking-widest text-sm">Receber via PIX</h3>
        {pixKey && qrCodeUrl ? (
          <>
            <div className="bg-white p-4 rounded-3xl inline-block mb-6 shadow-2xl">
              <img src={qrCodeUrl} alt="PIX QR Code" className="w-48 h-48" />
            </div>
            <p className="text-white font-mono break-all px-4 py-3 bg-black/40 rounded-xl border border-white/5 text-xs">
              {pixKey}
            </p>
          </>
        ) : (
          <p className="text-red-400 my-10">Nenhuma chave PIX configurada no seu perfil.</p>
        )}
        <button
          onClick={onClose}
          className="w-full mt-8 bg-white/5 text-gray-300 py-3 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-white/10"
        >
          Fechar
        </button>
      </motion.div>
    </motion.div>
  );
};

export default PixQRCodeModal;
