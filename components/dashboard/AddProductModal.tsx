import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

// This modal will now handle both Add and Edit
interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: any, isEditing: boolean) => Promise<void>;
  product?: any; // The product to edit (optional)
}

const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, onSave, product }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    promoPrice: '',
    category: 'Lanches',
    image: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [imageSearchResults, setImageSearchResults] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const isEditing = !!product;

  // --- Image Handling ---
  const handleUnsplashSearch = async () => {
      if (!imageSearchQuery.trim()) return;
      setIsUploading(true);
      try {
          const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
          const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(imageSearchQuery)}&per_page=12&client_id=${accessKey}`);
          if (!response.ok) throw new Error('Falha ao buscar imagens.');
          const data = await response.json();
          setImageSearchResults(data.results);
      } catch (error: any) {
          toast.error(error.message);
      } finally {
          setIsUploading(false);
      }
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsUploading(true);
      const formData = new FormData();
      formData.append("image", file);
      try {
          const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
          const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
              method: "POST",
              body: formData,
          });
          const data = await response.json();
          if (!data.success) throw new Error(data.error?.message || "Falha no upload");
          setFormData(prev => ({...prev, image: data.data.url}));
          toast.success("Upload da imagem concluído!");
      } catch (error: any) {
          toast.error(error.message);
      } finally {
          setIsUploading(false);
      }
  };


  useEffect(() => {
    if (isEditing && product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        price: product.price?.toString() || '',
        promoPrice: product.promoPrice?.toString() || '',
        category: product.category || 'Lanches',
        image: product.image || '',
      });
    } else {
      setFormData({ name: '', description: '', price: '', promoPrice: '', category: 'Lanches', image: '' });
    }
    // Reset image search state when modal opens/changes
    setShowImageSearch(false);
    setImageSearchResults([]);
    setImageSearchQuery('');
  }, [product, isEditing, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price) {
      toast.error('O nome e o preço do produto são obrigatórios.');
      return;
    }
    setIsLoading(true);
    try {
      await onSave({
        ...formData,
        price: parseFloat(formData.price.replace(',', '.')) || 0,
        promoPrice: formData.promoPrice ? parseFloat(formData.promoPrice.replace(',', '.')) : null,
      }, isEditing);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="bg-[#181818] rounded-2xl shadow-lg max-w-lg w-full max-h-[90vh] flex flex-col border border-white/10">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">{isEditing ? 'Editar Produto' : 'Adicionar Produto'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><i className="fa-solid fa-times"></i></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          {/* ... (form fields for name, price, etc.) */}
           <div>
                <label className="text-xs font-bold text-gray-400">URL da Imagem</label>
                 <div className="flex gap-2 mt-1">
                    <input
                      type="text" name="image" value={formData.image} onChange={(e) => setFormData(p => ({...p, image: e.target.value}))}
                      className="w-full bg-[#1E1E1E] border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-[#FF8C00]"
                      placeholder="https://exemplo.com/imagem.png"
                    />
                     <label className="shrink-0 w-12 h-12 flex items-center justify-center bg-white/5 rounded-lg cursor-pointer hover:bg-white/10">
                        {isUploading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-upload"></i>}
                        <input type="file" onChange={handleFileUpload} className="hidden" accept="image/*" />
                    </label>
                    <button type="button" onClick={() => setShowImageSearch(!showImageSearch)} className="shrink-0 w-12 h-12 bg-white/5 rounded-lg hover:bg-white/10">
                        <i className="fa-solid fa-search"></i>
                    </button>
                </div>
          </div>

          {showImageSearch && (
              <div className="space-y-2 p-3 bg-black/20 rounded-lg">
                  <div className="flex gap-2">
                      <input 
                          type="text"
                          value={imageSearchQuery}
                          onChange={e => setImageSearchQuery(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleUnsplashSearch()}
                          placeholder="Buscar por 'cheeseburger', 'pizza'..."
                          className="w-full bg-[#1E1E1E] border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-[#FF8C00]"
                      />
                      <button type="button" onClick={handleUnsplashSearch} className="px-4 bg-[#FF8C00] rounded-lg text-white font-bold"><i className="fa-solid fa-search"></i></button>
                  </div>
                  {imageSearchResults.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 h-40 overflow-y-auto custom-scrollbar">
                          {imageSearchResults.map(img => (
                              <img 
                                key={img.id}
                                src={img.urls.thumb}
                                alt={img.alt_description}
                                onClick={() => {
                                    setFormData(p => ({...p, image: img.urls.regular}));
                                    setShowImageSearch(false);
                                }}
                                className="w-full h-full object-cover rounded-md cursor-pointer hover:ring-2 ring-[#FF8C00]"
                              />
                          ))}
                      </div>
                  )}
              </div>
          )}

        </form>

        <div className="flex gap-4 p-6 border-t border-white/10">
          <button type="button" onClick={onClose} className="flex-1 py-3 bg-white/5 text-gray-300 rounded-lg font-bold text-sm hover:bg-white/10">Cancelar</button>
          <button type="submit" onClick={handleSubmit} disabled={isLoading} className="flex-1 py-3 bg-[#FF8C00] text-white rounded-lg font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {isLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddProductModal;