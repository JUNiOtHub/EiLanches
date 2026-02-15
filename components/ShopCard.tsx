import React from 'react';
import { motion } from 'framer-motion';

interface ShopCardProps {
  shop: any;
  onClick: () => void;
  isNew?: boolean;
  isClosed?: boolean;
  hasFreeDelivery?: boolean;
}

const ShopCard: React.FC<ShopCardProps> = ({ shop, onClick, isNew, isClosed, hasFreeDelivery }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05, borderColor: isNew ? '#22c55e' : '#FF8C00', boxShadow: isNew ? '0 0 30px -5px rgba(34, 197, 94, 0.3)' : '0 0 30px -5px rgba(255, 140, 0, 0.3)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative aspect-[16/10] bg-[#181818] rounded-2xl overflow-hidden cursor-pointer border-2 ${isNew ? 'border-green-500' : 'border-transparent'} transition-all duration-300 group`}
    >
      {/* Imagem de Fundo (Método Robusto) */}
      <div
        style={{ backgroundImage: `url(${shop.image})` }}
        className={`absolute inset-0 w-full h-full bg-cover bg-center transition-all duration-700 group-hover:scale-110 ${isClosed ? 'grayscale' : ''}`}
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent p-5 flex flex-col justify-end">
         <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-2 drop-shadow-lg group-hover:text-[#FF8C00] transition-colors line-clamp-1">{shop.nomeLoja}</h3>
         <div className="flex items-center gap-2 text-[10px] font-bold text-gray-300 uppercase tracking-wider">
            {shop.rating > 0 && (
              <div className="flex items-center gap-1 bg-black/30 backdrop-blur-md px-2 py-1 rounded-md border border-white/10">
                  <i className="fa-solid fa-star text-[#FF8C00]"></i> 
                  <span>{shop.rating.toFixed(1)}</span>
              </div>
            )}
            {shop.deliveryTime && (
              <span className="flex items-center gap-1"><i className="fa-solid fa-clock"></i> {shop.deliveryTime}</span>
            )}
            <span className="flex items-center gap-1"><i className="fa-solid fa-motorcycle"></i> {hasFreeDelivery ? 'Grátis' : 'Entrega'}</span>
         </div>
      </div>

      {/* Status Badge */}
      {isClosed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-[2px] z-20">
           <span className="text-red-500 font-black uppercase tracking-[0.2em] border-2 border-red-500 px-4 py-2 rounded-lg transform -rotate-12 text-xl">Fechado</span>
        </div>
      )}

      {/* New Badge */}
      {isNew && (
         <div className="absolute top-3 left-3 bg-green-600 text-white text-[9px] font-black uppercase px-2 py-1 rounded shadow-lg shadow-green-600/20 z-10 tracking-widest">
            Estreia na Área
         </div>
      )}
      
      {/* Hover Action Hint */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
          <div className="w-8 h-8 bg-[#FF8C00] rounded-full flex items-center justify-center text-black shadow-lg shadow-[#FF8C00]/50">
              <i className="fa-solid fa-arrow-right -rotate-45"></i>
          </div>
      </div>
    </motion.div>
  );
};

export default ShopCard;