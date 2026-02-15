/**
 * Order Service – validação de schema (LGPD) e criação de pedidos.
 */
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  onSnapshot, 
  orderBy 
} from 'firebase/firestore';

// 🚨 Definição das constantes de segurança (LGPD)
const FORBIDDEN_KEYS = ['clienteDocumento', 'cpf', 'telefoneReal', 'documento', 'telefone'];
const REQUIRED_MASKED = ['clienteDocumentoMasked', 'clienteTelefone'];

/**
 * Cria um novo pedido no Firebase respeitando as travas de segurança.
 */
export async function createOrderDocument(orderData: any) {
  try {
    // 1. Validar se não estamos enviando dados proibidos
    const keys = Object.keys(orderData);
    const hasForbidden = keys.some(key => FORBIDDEN_KEYS.includes(key));
    
    if (hasForbidden) {
      throw new Error("Erro de Segurança: Dados sensíveis não mascarados detectados.");
    }

    // 2. Preparar o objeto final
    const finalOrder = {
      ...orderData,
      status: 'pendente',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // 3. Gravar na coleção 'pedidos'
    const docRef = await addDoc(collection(db, 'pedidos'), finalOrder);
    
    return {
      success: true,
      orderId: docRef.id
    };
  } catch (error: any) {
    console.error("Erro ao criar pedido:", error);
    throw new Error(error.message || "Falha ao processar pedido.");
  }
}

/**
 * Escuta pedidos em tempo real.
 */
export function subscribeToOrders(userId: string, userType: 'cliente' | 'loja' | 'entregador', callback: (orders: any[]) => void) {
  const field = userType === 'cliente' ? 'clienteUid' : userType === 'loja' ? 'lojaId' : 'entregadorUid';
  
  const q = query(
    collection(db, 'pedidos'),
    where(field, '==', userId),
    orderBy('createdAt', 'desc') // Adicionado para ver os novos primeiro
  );

  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(orders);
  });
}

/**
 * Calcula métricas para a 'Baita Dash'.
 */
export function calculateMetrics(orders: any[]) {
  const completed = orders.filter(o => o.status === 'concluido');
  const canceled = orders.filter(o => o.status === 'cancelado');
  
  const totalGross = completed.reduce((acc, o) => acc + (Number(orderValue(o)) || 0), 0);
  const totalNet = totalGross * 0.9; // Taxa de 10% da plataforma

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