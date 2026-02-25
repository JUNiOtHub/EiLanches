/**
 * Centralização da inicialização do Firebase Admin.
 * Todas as Cloud Functions devem importar `db` e `admin` daqui.
 * Evita múltiplas chamadas a initializeApp() que causam crash.
 */
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export { admin };
