import { db, collection, addDoc, updateDoc, doc, deleteDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, serverTimestamp } from '../firebase';

export interface Product {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  categoria: string;
  imagem?: string;
  isAvailable: boolean;
  lojaId: string;
  createdAt: any;
  updatedAt: any;
  ingredientes?: string[];
  tempoPreparo: number; // minutos
}

export interface CreateProductData {
  nome: string;
  descricao: string;
  preco: number;
  categoria: string;
  imagem?: string;
  ingredientes?: string[];
  tempoPreparo: number;
}

/**
 * Serviço CRUD para gerenciamento de Produtos/Lanches
 * Pattern: Repository para fácil migração entre bancos
 */
export class ProductService {
  private static instance: ProductService;
  
  public static getInstance(): ProductService {
    if (!ProductService.instance) {
      ProductService.instance = new ProductService();
    }
    return ProductService.instance;
  }

  /**
   * Criar novo produto
   */
  async createProduct(lojaId: string, productData: CreateProductData): Promise<Product> {
    try {
      const docRef = await addDoc(collection(db, 'users', lojaId, 'cardapio'), {
        ...productData,
        isAvailable: true,
        lojaId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const newProduct = await this.getProductById(lojaId, docRef.id);
      if (!newProduct) {
        throw new Error('Falha ao criar produto');
      }

      console.log(`🍔 [PRODUCT] Produto criado: ${newProduct.nome}`);
      return newProduct;
    } catch (error) {
      console.error('Erro ao criar produto:', error);
      throw new Error('Não foi possível criar o produto');
    }
  }

  /**
   * Buscar produto por ID
   */
  async getProductById(lojaId: string, productId: string): Promise<Product | null> {
    try {
      const docRef = doc(db, 'users', lojaId, 'cardapio', productId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as Product;
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao buscar produto:', error);
      return null;
    }
  }

  /**
   * Listar todos os produtos da loja
   */
  async getProducts(lojaId: string): Promise<Product[]> {
    try {
      const q = query(
        collection(db, 'users', lojaId, 'cardapio'),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const products = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];

      console.log(`🍔 [PRODUCT] ${products.length} produtos carregados`);
      return products;
    } catch (error) {
      console.error('Erro ao listar produtos:', error);
      return [];
    }
  }

  /**
   * Atualizar produto
   */
  async updateProduct(lojaId: string, productId: string, updates: Partial<CreateProductData & { isAvailable: boolean }>): Promise<Product> {
    try {
      const docRef = doc(db, 'users', lojaId, 'cardapio', productId);
      
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });

      const updatedProduct = await this.getProductById(lojaId, productId);
      if (!updatedProduct) {
        throw new Error('Falha ao atualizar produto');
      }

      console.log(`🍔 [PRODUCT] Produto atualizado: ${updatedProduct.nome}`);
      return updatedProduct;
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      throw new Error('Não foi possível atualizar o produto');
    }
  }

  /**
   * Alternar disponibilidade do produto (Pausar/Ativar)
   */
  async toggleAvailability(lojaId: string, productId: string): Promise<Product> {
    const product = await this.getProductById(lojaId, productId);
    if (!product) {
      throw new Error('Produto não encontrado');
    }

    return this.updateProduct(lojaId, productId, {
      isAvailable: !product.isAvailable
    });
  }

  /**
   * Deletar produto
   */
  async deleteProduct(lojaId: string, productId: string): Promise<void> {
    try {
      const docRef = doc(db, 'users', lojaId, 'cardapio', productId);
      await deleteDoc(docRef);
      
      console.log(`🍔 [PRODUCT] Produto deletado: ${productId}`);
    } catch (error) {
      console.error('Erro ao deletar produto:', error);
      throw new Error('Não foi possível deletar o produto');
    }
  }

  /**
   * Inscrever para atualizações em tempo real dos produtos
   */
  subscribeToProducts(lojaId: string, onUpdate: (products: Product[]) => void): () => void {
    console.log(`🍔 [PRODUCT] Inscrito em tempo real para loja: ${lojaId}`);
    
    const q = query(
      collection(db, 'users', lojaId, 'cardapio'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const products = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];

      console.log(`🍔 [PRODUCT] Atualização recebida: ${products.length} produtos`);
      onUpdate(products);
    }, (error) => {
      console.error('🚨 [PRODUCT] Erro na inscrição:', error);
    });

    return unsubscribe;
  }

  /**
   * Buscar produtos por categoria
   */
  async getProductsByCategory(lojaId: string, categoria: string): Promise<Product[]> {
    try {
      const q = query(
        collection(db, 'users', lojaId, 'cardapio'),
        where('categoria', '==', categoria),
        where('isAvailable', '==', true),
        orderBy('nome')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
    } catch (error) {
      console.error('Erro ao buscar produtos por categoria:', error);
      return [];
    }
  }

  /**
   * Buscar produtos disponíveis
   */
  async getAvailableProducts(lojaId: string): Promise<Product[]> {
    try {
      const q = query(
        collection(db, 'users', lojaId, 'cardapio'),
        where('isAvailable', '==', true),
        orderBy('nome')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
    } catch (error) {
      console.error('Erro ao buscar produtos disponíveis:', error);
      return [];
    }
  }
}

// Exportar instância singleton
export const productService = ProductService.getInstance();
