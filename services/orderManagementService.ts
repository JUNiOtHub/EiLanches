import { db, collection, addDoc, updateDoc, doc, deleteDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, serverTimestamp, runTransaction, limit } from '../firebase';
import { OrderData } from '../types';

// Re-exportar OrderData para uso em outros componentes
export type { OrderData } from '../types';

export interface CreateOrderData {
  clienteUid: string;
  clienteNome: string;
  clienteTelefone: string;
  lojaId: string;
  lojaNome: string;
  itens: OrderItem[];
  endereco: {
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
    complemento?: string;
  };
  paymentMethod: string;
  valorTotal: number;
  valorEntrega?: number;
  trocoPara?: number;
  observacoes?: string;
}

export interface OrderItem {
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  observacoes?: string;
}

export enum OrderStatus {
  PENDENTE = 'pendente',
  CONFIRMADO = 'confirmado',
  PREPARANDO = 'preparando',
  PRONTO = 'pronto',
  SAIU_ENTREGA = 'saiu_entrega',
  ENTREGUE = 'entregue',
  CANCELADO = 'cancelado'
}

/**
 * Serviço CRUD para gerenciamento de Pedidos
 * Pattern: Repository para fácil migração entre bancos
 */
export class OrderManagementService {
  private static instance: OrderManagementService;
  
  public static getInstance(): OrderManagementService {
    if (!OrderManagementService.instance) {
      OrderManagementService.instance = new OrderManagementService();
    }
    return OrderManagementService.instance;
  }

  /**
   * Buscar pedido por ID
   */
  async getOrderById(orderId: string): Promise<OrderData | null> {
    try {
      const docRef = doc(db, 'pedidos', orderId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as OrderData;
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao buscar pedido:', error);
      return null;
    }
  }

  /**
   * Listar pedidos da loja
   */
  async getOrdersByStore(lojaId: string, limit?: number): Promise<OrderData[]> {
    try {
      let q = query(
        collection(db, 'pedidos'),
        where('lojaId', '==', lojaId),
        orderBy('createdAt', 'desc')
      );

      if (limit) {
        q = query(q, limit(limit));
      }
      
      const querySnapshot = await getDocs(q);
      const orders = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OrderData[];

      console.log(`📦 [ORDER] ${orders.length} pedidos carregados para loja ${lojaId}`);
      return orders;
    } catch (error) {
      console.error('Erro ao listar pedidos:', error);
      return [];
    }
  }

  /**
   * Atualizar status do pedido (Método principal para operação)
   */
  async updateOrderStatus(orderId: string, newStatus: OrderStatus, motivo?: string): Promise<OrderData> {
    try {
      const orderRef = doc(db, 'pedidos', orderId);
      
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      // Adicionar timestamps específicos para cada status
      if (newStatus === OrderStatus.CONFIRMADO) {
        updateData.confirmadoAt = serverTimestamp();
      } else if (newStatus === OrderStatus.PREPARANDO) {
        updateData.iniciadoPreparoAt = serverTimestamp();
      } else if (newStatus === OrderStatus.PRONTO) {
        updateData.prontoAt = serverTimestamp();
      } else if (newStatus === OrderStatus.SAIU_ENTREGA) {
        updateData.saiuEntregaAt = serverTimestamp();
      } else if (newStatus === OrderStatus.ENTREGUE) {
        updateData.entregueAt = serverTimestamp();
      } else if (newStatus === OrderStatus.CANCELADO) {
        updateData.canceladoAt = serverTimestamp();
        updateData.motivoCancelamento = motivo;
      }

      await updateDoc(orderRef, updateData);

      const updatedOrder = await this.getOrderById(orderId);
      if (!updatedOrder) {
        throw new Error('Falha ao atualizar pedido');
      }

      console.log(`📦 [ORDER] Pedido ${orderId} atualizado para: ${newStatus}`);
      return updatedOrder;
    } catch (error) {
      console.error('Erro ao atualizar status do pedido:', error);
      throw new Error('Não foi possível atualizar o status do pedido');
    }
  }

  /**
   * Ações rápidas para Mobile
   */
  async aceitarPedido(orderId: string): Promise<OrderData> {
    return this.updateOrderStatus(orderId, OrderStatus.CONFIRMADO);
  }

  async iniciarPreparo(orderId: string): Promise<OrderData> {
    return this.updateOrderStatus(orderId, OrderStatus.PREPARANDO);
  }

  async marcarPronto(orderId: string): Promise<OrderData> {
    return this.updateOrderStatus(orderId, OrderStatus.PRONTO);
  }

  async enviarParaEntrega(orderId: string): Promise<OrderData> {
    return this.updateOrderStatus(orderId, OrderStatus.SAIU_ENTREGA);
  }

  async cancelarPedido(orderId: string, motivo: string): Promise<OrderData> {
    return this.updateOrderStatus(orderId, OrderStatus.CANCELADO, motivo);
  }

  /**
   * Inscrever para atualizações em tempo real dos pedidos
   */
  subscribeToOrders(lojaId: string, onUpdate: (orders: OrderData[]) => void): () => void {
    console.log(`📦 [ORDER] Inscrito em tempo real para loja: ${lojaId}`);
    
    const q = query(
      collection(db, 'pedidos'),
      where('lojaId', '==', lojaId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OrderData[];

      console.log(`📦 [ORDER] Atualização recebida: ${orders.length} pedidos`);
      onUpdate(orders);
    }, (error) => {
      console.error('🚨 [ORDER] Erro na inscrição:', error);
    });

    return unsubscribe;
  }

  /**
   * Buscar pedidos por status
   */
  async getOrdersByStatus(lojaId: string, status: OrderStatus): Promise<OrderData[]> {
    try {
      const q = query(
        collection(db, 'pedidos'),
        where('lojaId', '==', lojaId),
        where('status', '==', status),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OrderData[];
    } catch (error) {
      console.error('Erro ao buscar pedidos por status:', error);
      return [];
    }
  }

  /**
   * Buscar pedidos do dia
   */
  async getTodayOrders(lojaId: string): Promise<OrderData[]> {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const q = query(
        collection(db, 'pedidos'),
        where('lojaId', '==', lojaId),
        where('createdAt', '>=', hoje),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OrderData[];
    } catch (error) {
      console.error('Erro ao buscar pedidos do dia:', error);
      return [];
    }
  }

  /**
   * Gerar código de rastreamento
   */
  private generateTrackingCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Buscar métricas para dashboard
   */
  async getOrderMetrics(lojaId: string): Promise<{
    totalHoje: number;
    pendentes: number;
    preparando: number;
    prontos: number;
    faturamentoHoje: number;
  }> {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const q = query(
        collection(db, 'pedidos'),
        where('lojaId', '==', lojaId),
        where('createdAt', '>=', hoje)
      );
      
      const querySnapshot = await getDocs(q);
      const orders = querySnapshot.docs.map(doc => doc.data()) as any[];
      
      const metrics = {
        totalHoje: orders.length,
        pendentes: orders.filter(o => o.status === OrderStatus.PENDENTE).length,
        preparando: orders.filter(o => o.status === OrderStatus.PREPARANDO).length,
        prontos: orders.filter(o => o.status === OrderStatus.PRONTO).length,
        faturamentoHoje: orders.reduce((sum, o) => sum + (o.finalTotal || 0), 0)
      };

      console.log(`📊 [ORDER] Métricas calculadas:`, metrics);
      return metrics;
    } catch (error) {
      console.error('Erro ao calcular métricas:', error);
      return {
        totalHoje: 0,
        pendentes: 0,
        preparando: 0,
        prontos: 0,
        faturamentoHoje: 0
      };
    }
  }
}

// Exportar instância singleton
export const orderManagementService = OrderManagementService.getInstance();
