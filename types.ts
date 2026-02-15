export interface OrderData {
  id: string;
  clienteNome: string;
  clienteTelefone: string;
  lojaNome: string;
  status: string;
  finalTotal: number;
  createdAt: any;
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

export enum OrderStatus {
  PENDENTE = 'pendente',
  CONFIRMADO = 'confirmado',
  PREPARANDO = 'preparando',
  PRONTO = 'pronto_retirada',
  SAIU_ENTREGA = 'entrega',
  ENTREGUE = 'concluido',
  CANCELADO = 'cancelado'
}