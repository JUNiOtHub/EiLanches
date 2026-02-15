// CONFIGURAÇÃO DO FIREBASE (Projeto: offline-f2c69)
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, query, where, orderBy,
  updateDoc, doc, serverTimestamp, getDoc, setDoc, deleteDoc, getDocs, writeBatch, increment, runTransaction, limit
} from 'firebase/firestore';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup 
} from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validação Crítica de Configuração
if (!firebaseConfig.apiKey) {
  console.error('CRITICAL: Firebase API Key is missing. Check your .env file.');
}

// Inicialização Síncrona (Garante que auth nunca seja null na exportação)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Configurações de Desenvolvimento
if (import.meta.env.DEV && auth) {
  auth.settings.appVerificationDisabledForTesting = true;
}

// Inicialização segura do Messaging (Opcional)
let messaging: any = null;
if (typeof window !== 'undefined') {
  try {
    if (location.protocol === 'https:' || location.hostname === 'localhost') {
       messaging = getMessaging(app);
    }
  } catch (msgError) {
    console.warn('Firebase Messaging failed to initialize (expected in some environments):', msgError);
  }
}

export { 
  app, db, auth, googleProvider, signInWithPopup, collection, addDoc, onSnapshot, 
  query, where, orderBy, updateDoc, doc, serverTimestamp, getDoc, setDoc, deleteDoc,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, firebaseConfig,
  storage, ref, uploadBytes, getDownloadURL, messaging, getToken, onMessage, getDocs, writeBatch, increment, runTransaction, limit
};