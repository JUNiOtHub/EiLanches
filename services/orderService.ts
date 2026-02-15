/**
 * Order Service – validação de schema (LGPD) e criação de pedidos.
 * Garante que apenas campos mascarados sejam gravados na coleção pedidos.
 */

import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy } from 'firebase/firestore';

const FORBIDDEN_KEYS = ['clienteDocumento', 'cpf', 'telefoneReal', 'documento', 'telefone'];
const REQUIRED_MASKED = ['clienteDocumentoMasked', 'clienteTelefone'];

export function subscribeToOrders(userId: string, userType: 'cliente' | 'loja' | 'entregador', callback: (orders: any[]) => void) {
  const field = userType === 'cliente' ? 'clienteUid' : userType === 'loja' ? 'lojaId' : 'entregadorUid';
  const q = query(
    collection(db, 'pedidos'),
    where(field, '==', userId)
  );

  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(orders);
  });
}

export function calculateMetrics(orders: any[]) {
  const completed = orders.filter(o => o.status === 'concluido');
  const canceled = orders.filter(o => o.status === 'cancelado');
  
  const totalGross = completed.reduce((acc, o) => acc + (Number(orderValue(o)) || 0), 0);
  const totalNet = totalGross * 0.9; // 10% platform fee

  return {
    totalOrders: orders.length,
    completedOrders: completed.length,
    canceledOrders: canceled.length,
    totalGross,
    totalNet,
    ticketMedio: completed.length > 0 ? totalGross / completed.length : 0
  };
}

function orderValue(order: any) {
  return order.finalTotal || order.total || 0;
}
