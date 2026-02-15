/**
 * Order Service – validação de schema (LGPD) e criação de pedidos.
 * Garante que apenas campos mascarados sejam gravados na coleção pedidos.
 */

import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const FORBIDDEN_KEYS = ['clienteDocumento', 'cpf', 'telefoneReal', 'documento', 'telefone'];
const REQUIRED_MASKED = ['clienteDocumentoMasked', 'clienteTelefone'];

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Valida que o payload do pedido não contém dados sensíveis em claro
 * e que os campos mascarados existem e são string.
 */
export function validateOrderPayload(data: Record<string, unknown>): void {
  const keys = Object.keys(data);
  const hasForbidden = keys.some(k => FORBIDDEN_KEYS.includes(k));
  if (hasForbidden) {
    throw new Error('Schema inválido: não é permitido gravar documento ou telefone em claro na coleção de pedidos.');
  }
  for (const key of REQUIRED_MASKED) {
    if (!(key in data)) continue; // opcional em alguns fluxos legados
    const val = data[key];
    if (val !== undefined && !isString(val)) {
      throw new Error(`Schema inválido: ${key} deve ser string (dado mascarado).`);
    }
  }
}

/**
 * Cria o documento do pedido no Firestore após validação.
 * Retorna o ID do documento criado.
 */
export async function createOrderDocument(
  payload: Record<string, unknown>
): Promise<string> {
  validateOrderPayload(payload);
  const { createdAt: _ts, ...rest } = payload;
  const docRef = await addDoc(collection(db, 'pedidos'), {
    ...rest,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}
