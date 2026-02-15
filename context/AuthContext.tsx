
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { auth, db, onAuthStateChanged, doc, getDoc, updateDoc, signOut as firebaseSignOut, messaging, getToken } from '../firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

interface UserProfile {
  uid: string;
  email: string;
  nome: string;
  tipoUsuario: 'cliente' | 'vendedor' | 'entregador' | null;
  lojaId: string | null;
  chavePix?: string;
  nomeLoja?: string;
  telefone?: string;
  documento?: string;
  isOpen?: boolean;
  deliveryTime?: string;
  openingDays?: string;
  temVeiculo?: boolean;
  deliveryMode?: 'own' | 'app'; // 'own' = Entregadores Próprios, 'app' = Contratar do App
  fcmToken?: string;
  loyaltyPoints?: number;
}

interface AuthContextData {
  user: any;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  requestNotificationPermission: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid: string) => {
    try {
      if (!db) {
        if (import.meta.env.DEV) {
          console.warn('Firestore not initialized');
        }
        return;
      }
      
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const profileData = userDoc.data() as UserProfile;
        console.log(`🔍 [DEBUG] Perfil carregado:`, profileData);
        console.log(`🔍 [DEBUG] tipoUsuario:`, profileData.tipoUsuario);
        setProfile(profileData);
      } else {
        console.log(`🔍 [DEBUG] Nenhum perfil encontrado para UID: ${uid}`);
        setProfile(null);
      }
    } catch (error) {
      console.error('🚨 [DEBUG] Erro ao buscar perfil:', error);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        await fetchProfile(firebaseUser.uid);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchProfile]);

  const signOut = async () => {
    await firebaseSignOut(auth);
    // Forçar o redirecionamento para a raiz, onde a lógica de autenticação irá levá-lo para o Login.
    window.location.href = '/';
  };

  const refreshProfile = async () => {
    if (user) {
      console.log(`🔄 [DEBUG] Atualizando perfil para UID: ${user.uid}`);
      // Ativa o estado de loading global. O App.tsx mostrará a tela de carregamento,
      // o que desmonta o componente atual (ex: Onboarding) e previne loops ou timeouts.
      setLoading(true);
      try {
        await fetchProfile(user.uid);
        console.log(`✅ [DEBUG] Perfil atualizado com sucesso`);
      } finally {
        setLoading(false);
      }
    } else {
      console.log(`⚠️ [DEBUG] Nenhum usuário para atualizar perfil`);
    }
  };

  const requestNotificationPermission = async () => {
    if (!user || !messaging) {
      toast.error("Notificações não suportadas neste navegador.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (token) {
          await updateDoc(doc(db, 'users', user.uid), { fcmToken: token });
          toast.success("Dispositivo pronto para receber alertas!");
        }
      } else {
        toast.error("Permissão negada. Você não receberá alertas de pedidos.");
      }
    } catch (error) {
      toast.error("Erro ao configurar notificações.");
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile, requestNotificationPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
