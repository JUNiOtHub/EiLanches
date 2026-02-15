import { db, collection, onSnapshot, query, where, orderBy, doc, updateDoc, serverTimestamp, getDoc } from '../firebase';
import { OrderData } from '../types';

export interface DashboardMetrics {
  faturamentoLiquidoHoje: number;
  faturamentoBrutoHoje: number;
  totalPedidos: number;
  ticketMedio: number;
  pedidosPendentes: number;
  pedidosEmPreparo: number;
  pedidosProntos: number;
  taxaConclusao: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  pedidosHoje: OrderData[];
  pedidosRecentes: OrderData[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Serviço isolado para gerenciar dados da Dashboard do Vendedor
 * Facilita mudanças futuras na integração com banco de dados/API
 */
class DashboardService {
  private unsubscribeFunctions: (() => void)[] = [];

  /**
   * Calcula métricas diárias dos pedidos
   */
  private calcularMetrics(pedidos: OrderData[]): DashboardMetrics {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const pedidosHoje = pedidos.filter(p => {
      const dataPedido = p.createdAt?.toDate();
      return dataPedido && dataPedido >= hoje;
    });

    const faturamentoBruto = pedidosHoje.reduce((acc, p) => acc + (p.finalTotal || 0), 0);
    const faturamentoLiquido = pedidosHoje.reduce((acc, p) => acc + (p.netValue || 0), 0);
    const totalPedidosHoje = pedidosHoje.length;
    const ticketMedio = totalPedidosHoje > 0 ? faturamentoLiquido / totalPedidosHoje : 0;

    const pedidosPendentes = pedidos.filter(p => p.status === 'pendente').length;
    const pedidosEmPreparo = pedidos.filter(p => p.status === 'preparando').length;
    const pedidosProntos = pedidos.filter(p => p.status === 'pronto').length;
    
    const pedidosConcluidos = pedidos.filter(p => p.status === 'concluido').length;
    const taxaConclusao = pedidos.length > 0 ? (pedidosConcluidos / pedidos.length) * 100 : 0;

    return {
      faturamentoLiquidoHoje: faturamentoLiquido,
      faturamentoBrutoHoje: faturamentoBruto,
      totalPedidos: totalPedidosHoje,
      ticketMedio,
      pedidosPendentes,
      pedidosEmPreparo,
      pedidosProntos,
      taxaConclusao
    };
  }

  /**
   * Inscreve para atualizações em tempo real dos pedidos do vendedor
   */
  public inscreverPedidosVendedor(
    vendedorUid: string,
    onUpdate: (data: DashboardData) => void
  ): () => void {
    // Limpar inscrições anteriores
    this.limparInscricoes();

    // Estado inicial
    onUpdate({
      metrics: this.getEmptyMetrics(),
      pedidosHoje: [],
      pedidosRecentes: [],
      isLoading: true,
      error: null
    });

    try {
      // Query para pedidos do vendedor (corrigido: usar lojaId em vez de vendedorUid)
      console.log(`🔍 [DASHBOARD] Buscando pedidos para lojaId: ${vendedorUid}`);
      const q = query(
        collection(db, 'pedidos'),
        where('lojaId', '==', vendedorUid),
        orderBy('createdAt', 'desc')
      );

      console.log(`🔍 [DASHBOARD] Query criada:`, q);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          try {
            console.log(`📊 [DASHBOARD] Snapshot recebido: ${snapshot.docs.length} pedidos`);
            const pedidos = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as OrderData[];

            console.log(`📊 [DASHBOARD] Pedidos mapeados:`, pedidos);

            const metrics = this.calcularMetrics(pedidos);
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);

            const pedidosHoje = pedidos.filter(p => {
              const dataPedido = p.createdAt?.toDate();
              return dataPedido && dataPedido >= hoje;
            });

            onUpdate({
              metrics,
              pedidosHoje,
              pedidosRecentes: pedidos.slice(0, 10),
              isLoading: false,
              error: null
            });
          } catch (error) {
            console.error('Erro ao processar dados da dashboard:', error);
            onUpdate({
              metrics: this.getEmptyMetrics(),
              pedidosHoje: [],
              pedidosRecentes: [],
              isLoading: false,
              error: 'Erro ao carregar dados'
            });
          }
        },
        (error) => {
          console.error('🚨 [DASHBOARD] Erro no onSnapshot:', error);
          onUpdate({
            metrics: this.getEmptyMetrics(),
            pedidosHoje: [],
            pedidosRecentes: [],
            isLoading: false,
            error: 'Erro ao carregar dados: ' + error.message
          });
        }
      );

      this.unsubscribeFunctions.push(unsubscribe);

      return () => this.limparInscricoes();
    } catch (error) {
      console.error('Erro ao configurar inscrição:', error);
      onUpdate({
        metrics: this.getEmptyMetrics(),
        pedidosHoje: [],
        pedidosRecentes: [],
        isLoading: false,
        error: 'Erro ao configurar dashboard'
      });

      return () => {};
    }
  }

  /**
   * Atualiza status de um pedido
   */
  public async atualizarStatusPedido(pedidoId: string, novoStatus: string): Promise<void> {
    try {
      const pedidoRef = doc(db, 'pedidos', pedidoId);
      await updateDoc(pedidoRef, {
        status: novoStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Erro ao atualizar status do pedido:', error);
      throw new Error('Não foi possível atualizar o status do pedido');
    }
  }

  /**
   * Obtém métricas vazias para estado inicial
   */
  private getEmptyMetrics(): DashboardMetrics {
    return {
      faturamentoLiquidoHoje: 0,
      faturamentoBrutoHoje: 0,
      totalPedidos: 0,
      ticketMedio: 0,
      pedidosPendentes: 0,
      pedidosEmPreparo: 0,
      pedidosProntos: 0,
      taxaConclusao: 0
    };
  }

  /**
   * Limpa todas as inscrições ativas
   */
  private limparInscricoes(): void {
    this.unsubscribeFunctions.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        console.error('Erro ao limpar inscrição:', error);
      }
    });
    this.unsubscribeFunctions = [];
  }
}

// Exportar instância singleton
export const dashboardService = new DashboardService();
