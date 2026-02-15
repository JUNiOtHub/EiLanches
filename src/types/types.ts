
export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
}

export interface Shop {
  id: string;
  name: string;
  category: string;
  rating: number;
  deliveryTime: string;
  image: string;
  banner: string;
  phone: string;
  menu: MenuItem[];
}

export interface CartItem extends MenuItem {
  quantity: number;
  shopId: string;
  shopName: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  nome: string;
  tipoUsuario: 'cliente' | 'vendedor' | 'entregador' | null;
  createdAt: string;
  updatedAt?: string;
  telefone?: string;
  endereco?: string;
  documento?: string;
  onboardedAt?: string;
  lojaId?: string;
  nomeLoja?: string;
  chavePix?: string;
  deliveryMode?: 'own' | 'app';
  isOpen?: boolean;
  deliveryTime?: string;
  rating?: number;
  ratingCount?: number;
  temVeiculo?: boolean;
  vehicleType?: 'moto' | 'bike' | 'carro';
  isOnline?: boolean;
  loyaltyPoints?: number;

  // --- FINANCEIRO (Custódia) ---
  saldoDisponivel?: number; // Valor já liberado para saque
  saldoBloqueado?: number;  // Valor em custódia (aguardando PIN/Conclusão)
  
  // --- ONBOARDING ---
  termsAccepted?: boolean;
  termsVersion?: string;
  acceptedAt?: string;
  providerAccountId?: string;
  walletId?: string;
  isActive?: boolean;
  
  // --- DADOS DE ENDEREÇO COMPLETO ---
  cep?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  
  // --- DADOS BANCÁRIOS ---
  tipoChavePix?: 'cpf' | 'email' | 'telefone' | 'aleatoria';
  
  // --- DADOS DO VEÍCULO (ENTREGADOR) ---
  placaVeiculo?: string;
  cnhImage?: string;
  
  // --- ESTATÍSTICAS ENTREGADOR ---
  totalDeliveries?: number;
  totalKm?: number;
}

export interface OrderData {
  id: string;
  status: string;
  createdAt: any;
  lojaNome?: string;
  clienteNome?: string;
  endereco: string;
  deliveryMode?: string;
  driverFee?: number;
  deliveryFee?: number;
  entregueEm?: string;
  entregadorUid?: string;
  entregadorNome?: string;
  deliveryCode?: string;
  lat: number;
  lng: number;
  clienteUid?: string;
  lojaId?: string;
  subtotal?: number;
  discount?: number;
  finalTotal?: number;
  netValue?: number;
  paymentMethod?: string;
  itens?: any[];
  saldoLiberado?: boolean; // Se true, o valor já saiu de bloqueado para disponível
  clienteDocumentoMasked?: string; // CPF/CNPJ mascarado para exibição segura (LGPD)
}
