import React from 'react';
import { motion } from 'framer-motion';

interface ProductCardProps {
  product: any;
  onClick: () => void;
  onAdd: (e: React.MouseEvent) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onClick, onAdd }) => {
  return (
    <motion.div 
      whileHover={{ scale: 1.03, borderColor: '#FF8C00', zIndex: 10 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative aspect-square bg-[#181818] rounded-xl overflow-hidden cursor-pointer border-4 border-transparent transition-all duration-200 group shadow-lg ${!product.isAvailable ? 'opacity-50 grayscale' : ''}`}
    >
      {/* Image */}
      <img 
        src={product.image || "https://cdn-icons-png.flaticon.com/512/3075/3075977.png"} 
        alt={product.name} 
        onError={(e) => e.currentTarget.src = "https://cdn-icons-png.flaticon.com/512/3075/3075977.png"}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
      />
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent p-4 flex flex-col justify-end">
         <h3 className="text-white font-black text-lg leading-tight mb-1 drop-shadow-md line-clamp-2">{product.name}</h3>
         
         <div className="flex justify-between items-end mt-1">
            <div className="flex flex-col">
               {product.promoPrice ? (
                 <>
                   <span className="text-gray-400 text-[10px] line-through font-bold">R$ {product.price?.toFixed(2)}</span>
                   <span className="text-[#FF8C00] font-black text-xl">R$ {product.promoPrice?.toFixed(2)}</span>
                 </>
               ) : (
                 <span className="text-white font-black text-xl">R$ {product.price?.toFixed(2)}</span>
               )}
            </div>
            
            {product.isAvailable && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onAdd}
                className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center shadow-lg hover:bg-[#FF8C00] transition-colors"
              >
                <i className="fa-solid fa-plus font-black"></i>
              </motion.button>
            )}
         </div>
      </div>

      {!product.isAvailable && (
         <div className="absolute top-3 right-3 bg-red-600 text-white text-[10px] font-black uppercase px-2 py-1 rounded">Esgotado</div>
      )}
    </motion.div>
  );
};

export default ProductCard;