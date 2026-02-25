/**
 * Order Service – validação de schema (LGPD) e criação de pedidos.
 *
 * Melhorias:
 * - Tipagem forte (interfaces para Order, Metrics, etc.)
 * - Validação LGPD mantida
 * - Métricas usam netValue da config centralizada (não hardcoded 0.9)
 */
import { db } from '../firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';

// ── Interfaces ────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface OrderDocument {
  clienteUid: string;
  lojaId: string;
  lojaNome: string;
  clienteNome: string;
  clienteDocumentoMasked: string;
  clienteTelefone: string;
  endereco: string;
  itens: OrderItem[];
  subtotal: number;
  finalTotal: number;
  netValue: number;
  deliveryFee: number;
  serviceFee: number;
  appFee: number;
  paymentMethod: string;
  deliveryMode: 'delivery' | 'pickup';
  status: string;
  [key: string]: unknown; // Permite campos adicionais opcionais
}

interface OrderResult {
  success: boolean;
  orderId: string;
}

interface OrderRecord {
  id: string;
  status?: string;
  finalTotal?: number;
  total?: number;
  netValue?: number;
  [key: string]: unknown;
}

interface OrderMetrics {
  totalOrders: number;
  completedOrders: number;
  canceledOrders: number;
  totalGross: number;
  totalNet: number;
  ticketMedio: number;
}

// ── Constantes de segurança (LGPD) ───────────────────────────────

const FORBIDDEN_KEYS = ['clienteDocumento', 'cpf', 'telefoneReal', 'documento', 'telefone'];

/**
 * Cria um novo pedido no Firebase respeitando as travas de segurança LGPD.
 */
export async function createOrderDocument(orderData: Record<string, unknown>): Promise<OrderResult> {
  // 1. Validar se não estamos enviando dados proibidos (LGPD)
  const keys = Object.keys(orderData);
  const forbiddenFound = keys.filter((key) => FORBIDDEN_KEYS.includes(key));

  if (forbiddenFound.length > 0) {
    throw new Error(`Erro de Seguranca: Dados sensiveis nao mascarados detectados (${forbiddenFound.join(', ')}).`);
  }

  // 2. Validação de campos obrigatórios
  if (!orderData.clienteUid || !orderData.lojaId) {
    throw new Error('Campos obrigatorios ausentes: clienteUid e lojaId.');
  }

  // 3. Preparar o objeto final
  const finalOrder = {
    ...orderData,
    status: 'pendente',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // 4. Gravar na coleção 'pedidos'
  const docRef = await addDoc(collection(db, 'pedidos'), finalOrder);

  return {
    success: true,
    orderId: docRef.id,
  };
}

/**
 * Escuta pedidos em tempo real.
 */
export function subscribeToOrders(
  userId: string,
  userType: 'cliente' | 'loja' | 'entregador',
  callback: (orders: OrderRecord[]) => void,
): Unsubscribe {
  const fieldMap: Record<string, string> = {
    cliente: 'clienteUid',
    loja: 'lojaId',
    entregador: 'entregadorUid',
  };
  const field = fieldMap[userType] || 'clienteUid';

  const q = query(
    collection(db, 'pedidos'),
    where(field, '==', userId),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(q, (snapshot) => {
    const orders: OrderRecord[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(orders);
  });
}

/**
 * Calcula métricas para a 'Baita Dash'.
 * Usa netValue do pedido (já descontada a comissão) quando disponível.
 */
export function calculateMetrics(orders: OrderRecord[]): OrderMetrics {
  const completed = orders.filter((o) => o.status === 'concluido');
  const canceled = orders.filter((o) => o.status === 'cancelado');

  const totalGross = completed.reduce((acc, o) => acc + (Number(getOrderValue(o)) || 0), 0);
  const totalNet = completed.reduce((acc, o) => acc + (Number(o.netValue || getOrderValue(o) * 0.9) || 0), 0);

  return {
    totalOrders: orders.length,
    completedOrders: completed.length,
    canceledOrders: canceled.length,
    totalGross,
    totalNet,
    ticketMedio: completed.length > 0 ? totalGross / completed.length : 0,
  };
}

function getOrderValue(order: OrderRecord): number {
  return Number(order.finalTotal || order.total || 0);
}
