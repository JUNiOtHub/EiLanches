export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED';

export interface OrderData {
  id: string;
  clienteNome: string;
  clienteTelefone: string;
  lojaNome: string;
  status: OrderStatus;
  finalTotal: number;
  createdAt: any;
  deliveryMethod?: 'DELIVERY' | 'PICKUP';
  pin?: string;
  itens?: Array<{
    quantidade: number;
    produtoNome: string;
    subtotal?: number;
  }>;
  endereco?: {
    rua: string;
    numero: string;
    bairro: string;
  };
}

export enum LegacyOrderStatus {
  PENDENTE = 'pendente',
  CONFIRMADO = 'confirmado',
  PREPARANDO = 'preparando',
  PRONTO = 'pronto_retirada',
  SAIU_ENTREGA = 'entrega',
  ENTREGUE = 'concluido',
  CANCELADO = 'cancelado'
}