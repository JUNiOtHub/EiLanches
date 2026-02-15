import React from 'react';
import { motion } from 'framer-motion';

interface CategoryPillProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const CategoryPill: React.FC<CategoryPillProps> = ({ label, isActive, onClick }) => {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
        isActive 
          ? 'bg-[#FF8C00] text-white border-[#FF8C00] shadow-[0_0_20px_rgba(255,140,0,0.4)]' 
          : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20'
      }`}
    >
      {label}
    </motion.button>
  );
};

export default CategoryPill;