import React, { useState } from 'react';
import { Product } from '../../services/productService';

interface ProductGridProps {
  produtos: Product[];
  onToggleProduct: (productId: string) => void;
  isMobile: boolean;
}

const ProductGrid: React.FC<ProductGridProps> = ({ produtos, onToggleProduct, isMobile }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');

  // Extrair categorias únicas
  const categorias = ['todos', ...Array.from(new Set(produtos.map(p => p.categoria)))];

  // Filtrar produtos
  const produtosFiltrados = produtos.filter(produto => {
    const matchSearch = produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       produto.descricao.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = selectedCategory === 'todos' || produto.categoria === selectedCategory;
    return matchSearch && matchCategory;
  });

  // Definir ProductCardItem como componente React separado
  const ProductCardItem: React.FC<{ produto: Product }> = ({ produto }) => (
    <div className={`bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden border transition-all duration-200 ${
      produto.isAvailable 
        ? 'border-white/20 hover:scale-105 hover:bg-white/15' 
        : 'border-red-500/30 opacity-60'
    }`}>
      {/* Imagem */}
      <div className="relative h-32 bg-gradient-to-br from-orange-600 to-red-600">
        {produto.imagem ? (
          <img 
            src={produto.imagem} 
            alt={produto.nome}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">🍔</span>
          </div>
        )}
        
        {/* Status Badge */}
        <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold ${
          produto.isAvailable 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          {produto.isAvailable ? 'Disponível' : 'Indisponível'}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-white font-bold text-lg mb-1">{produto.nome}</h3>
        <p className="text-orange-200 text-sm mb-2 line-clamp-2">{produto.descricao}</p>
        
        <div className="flex items-center justify-between mb-3">
          <span className="text-white font-bold text-xl">R$ {produto.preco.toFixed(2)}</span>
          <span className="text-orange-300 text-sm">⏱️ {produto.tempoPreparo}min</span>
        </div>

        {/* Ingredientes */}
        {produto.ingredientes && produto.ingredientes.length > 0 && (
          <div className="mb-3">
            <p className="text-orange-200 text-xs mb-1">Ingredientes:</p>
            <div className="flex flex-wrap gap-1">
              {produto.ingredientes.slice(0, 3).map((ing, index) => (
                <span key={index} className="bg-white/10 text-orange-200 text-xs px-2 py-1 rounded-full">
                  {ing}
                </span>
              ))}
              {produto.ingredientes.length > 3 && (
                <span className="bg-white/10 text-orange-200 text-xs px-2 py-1 rounded-full">
                  +{produto.ingredientes.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Botão de Ação */}
        <button
          onClick={() => onToggleProduct(produto.id)}
          className={`w-full py-3 rounded-xl font-bold transition-all active:scale-95 ${
            produto.isAvailable
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {produto.isAvailable ? '⏸️ Pausar' : '▶️ Ativar'}
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="space-y-4">
        {/* Search e Filtros Mobile */}
        <div className="space-y-3">
          <input
            type="text"
            placeholder="🔍 Buscar lanche..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-orange-300 focus:outline-none focus:border-orange-400"
          />
          
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categorias.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-orange-600 text-white'
                    : 'bg-white/10 text-orange-200'
                }`}
              >
                {cat === 'todos' ? '🍔 Todos' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Mobile */}
        <div className="space-y-4">
          {produtosFiltrados.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🍔</div>
              <p className="text-orange-200 font-medium">Nenhum lanche encontrado</p>
            </div>
          ) : (
            produtosFiltrados.map((produto: Product) => (
              <ProductCardItem key={produto.id} produto={produto} />
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search e Filtros Desktop */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="🔍 Buscar lanche..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pl-12 text-white placeholder-orange-300 focus:outline-none focus:border-orange-400"
          />
        </div>
        
        <div className="flex gap-2">
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'bg-white/10 text-orange-200 hover:bg-white/20'
              }`}
            >
              {cat === 'todos' ? '🍔 Todos' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Desktop */}
      {produtosFiltrados.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-8xl mb-4">🍔</div>
          <p className="text-orange-200 font-medium text-xl">Nenhum lanche encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {produtosFiltrados.map((produto: Product) => (
            <ProductCardItem key={produto.id} produto={produto} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductGrid;
