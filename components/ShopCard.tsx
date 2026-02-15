import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface ShopCardProps {
  shop: any;
  onClick: () => void;
  isNew?: boolean;
}

const ShopCard: React.FC<ShopCardProps> = ({ shop, onClick, isNew }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imgSrc, setImgSrc] = useState(shop.image || shop.foto || "https://cdn-icons-png.flaticon.com/512/3075/3075977.png");

  useEffect(() => {
    setImgSrc(shop.image || shop.foto || "https://cdn-icons-png.flaticon.com/512/3075/3075977.png");
  }, [shop.image, shop.foto]);

  return (
    <motion.div
      whileHover={{ scale: 1.05, borderColor: isNew ? '#22c55e' : '#FF8C00', boxShadow: isNew ? '0 0 30px -5px rgba(34, 197, 94, 0.3)' : '0 0 30px -5px rgba(255, 140, 0, 0.3)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative aspect-[16/10] bg-[#181818] rounded-xl overflow-hidden cursor-pointer border-2 ${isNew ? 'border-green-500' : 'border-transparent'} transition-all duration-300 group`}
    >
      {/* Skeleton Loading */}
      <div className={`absolute inset-0 bg-[#202020] flex items-center justify-center transition-opacity duration-500 ${imageLoaded ? 'opacity-0' : 'opacity-100 animate-pulse'}`}>
         <i className="fa-solid fa-store text-gray-700 text-4xl"></i>
      </div>

      {/* Background Image */}
      <img 
        src={imgSrc} 
        alt={shop.nomeLoja} 
        onLoad={() => setImageLoaded(true)}
        onError={(e) => {
            setImgSrc("https://cdn-icons-png.flaticon.com/512/3075/3075977.png");
            setImageLoaded(true);
        }}
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${imageLoaded ? (!shop.isOpen ? 'grayscale opacity-30' : 'opacity-60 group-hover:opacity-40') : 'opacity-0'}`}
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent p-5 flex flex-col justify-end">
         <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-2 drop-shadow-lg group-hover:text-[#FF8C00] transition-colors line-clamp-1">{shop.nomeLoja}</h3>
         <div className="flex items-center gap-2 text-[10px] font-bold text-gray-300 uppercase tracking-wider">
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-2 py-1 rounded">
                <i className="fa-solid fa-star text-[#FF8C00]"></i> 
                <span>{shop.rating ? shop.rating.toFixed(1) : '5.0'}</span>
            </div>
            <span className="flex items-center gap-1"><i className="fa-solid fa-clock"></i> {shop.deliveryTime || '30m'}</span>
            <span className="flex items-center gap-1"><i className="fa-solid fa-motorcycle"></i> {shop.deliveryFee === 0 ? 'Grátis' : 'Entrega'}</span>
         </div>
      </div>

      {/* Status Badge */}
      {!shop.isOpen && (
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