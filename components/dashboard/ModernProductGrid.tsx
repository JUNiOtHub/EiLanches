import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, addDoc, updateDoc, doc, collection } from '@/firebase';
import { toast } from 'react-hot-toast';
import AddProductModal from './AddProductModal';

const ProductCard: React.FC<{ product: any, onEdit: () => void }> = ({ product, onEdit }) => {
    // NOTE: In a real app, availability would be updated via a Firestore call
    const [isAvailable, setIsAvailable] = useState(product.isAvailable ?? true);

    return (
        <div className="bg-[#181818] rounded-2xl p-4 flex flex-col justify-between border border-white/5 group hover:border-white/10 transition-all duration-300">
            <div>
                <div className="aspect-square w-full rounded-lg mb-4 overflow-hidden relative">
                    <img 
                        src={product.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80'} 
                        alt={product.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div 
                        className={`absolute top-2 right-2 px-2 py-1 rounded-full text-[9px] font-bold uppercase cursor-pointer transition-colors ${
                            isAvailable ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}
                    >
                        {isAvailable ? 'Disponível' : 'Pausado'}
                    </div>
                </div>
                <h3 className="font-bold text-white truncate">{product.name}</h3>
                <p className="text-gray-400 text-xs">{product.category || 'Sem categoria'}</p>
            </div>
            <div className="flex justify-between items-center mt-4">
                <div className="text-lg font-bold text-[#FF8C00]">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                </div>
                <button onClick={onEdit} className="w-10 h-10 bg-white/5 rounded-lg text-gray-400 hover:bg-[#FF8C00] hover:text-white transition-all">
                    <i className="fa-solid fa-pen"></i>
                </button>
            </div>
        </div>
    );
};

export const ModernProductGrid: React.FC<{ products: any[] }> = ({ products }) => {
    const { profile } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any | null>(null);

    const categories = ['all', ...Array.from(new Set(products.map(p => p.category || 'Geral')))];
    
    const handleOpenModal = (product: any = null) => {
        setEditingProduct(product);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
    };

    const handleSaveProduct = async (productData: any, isEditing: boolean) => {
        if (!profile?.uid) {
            toast.error("Você precisa estar logado para salvar um produto.");
            return;
        }

        const collectionRef = collection(db, 'users', profile.uid, 'cardapio');
        
        try {
            if (isEditing && editingProduct?.id) {
                // Update existing product
                const productRef = doc(db, 'users', profile.uid, 'cardapio', editingProduct.id);
                await updateDoc(productRef, productData);
                toast.success('Produto atualizado com sucesso!');
            } else {
                // Add new product
                await addDoc(collectionRef, { ...productData, isAvailable: true, createdAt: new Date() });
                toast.success('Produto adicionado com sucesso!');
            }
        } catch (error) {
            console.error("Error saving product:", error);
            toast.error('Ocorreu um erro ao salvar o produto.');
            throw error; // Re-throw to keep modal loading state
        }
    };
    
    const filteredProducts = (products || []).filter(p => {
        const matchesCategory = filterCategory === 'all' || (p.category || 'Geral') === filterCategory;
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <>
            <AddProductModal 
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveProduct}
                product={editingProduct}
            />
            <div className="h-full flex flex-col animate-in fade-in">
                {/* Header com Filtros */}
                <div className="mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full md:w-72">
                        <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
                        <input
                            type="text"
                            placeholder="Buscar produto..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-[#181818] border border-white/5 rounded-lg pl-10 pr-4 py-3 text-white outline-none focus:border-[#FF8C00] transition-colors"
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                        {categories.map(cat => (
                            <button 
                                key={cat as string}
                                onClick={() => setFilterCategory(cat as string)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase whitespace-nowrap transition-colors ${
                                    filterCategory === cat ? 'bg-[#FF8C00] text-white' : 'bg-[#181818] text-gray-400 hover:bg-white/5'
                                }`}
                            >
                                {cat === 'all' ? 'Todos' : cat}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => handleOpenModal()} className="bg-gradient-to-r from-[#FF8C00] to-[#FF4500] text-white px-5 py-3 rounded-lg text-xs font-bold uppercase flex items-center gap-2 shadow-lg hover:shadow-orange-500/20 transition-all">
                        <i className="fa-solid fa-plus"></i>
                        <span>Adicionar Lanche</span>
                    </button>
                </div>
                
                {/* Grid de Produtos */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {filteredProducts.map(product => (
                            <ProductCard key={product.id} product={product} onEdit={() => handleOpenModal(product)} />
                        ))}
                    </div>
                    {filteredProducts.length === 0 && (
                        <div className="text-center text-gray-500 py-20">
                            <i className="fa-solid fa-box-open text-4xl mb-4"></i>
                            <p className="font-bold">Nenhum lanche cadastrado ainda.</p>
                            <p className="text-sm mt-2">Adicione seu primeiro lanche no botão acima!</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};