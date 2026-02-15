# 🍔 EiLanches - Professional Delivery System

Sistema de marketplace para delivery com Split de Pagamento automático via Mercado Pago.

## 🏗️ Estrutura do Projeto
- `functions/`: Backend Serverless (Firebase Cloud Functions v2).
- `src/components/`: Componentes de UI divididos por contexto.
- `src/services/`: Motores de integração (Pagamento, Geolocalização, Firestore).
- `src/screens/`: Visões principais da aplicação.

## � Fluxo de Caixa (Marketplace Split)
O sistema divide cada transação automaticamente:
- **Taxa App:** 10% (Comissão de plataforma).
- **Lojista:** Valor dos produtos - Taxa App.
- **Entregador:** 100% da Taxa de Entrega.

## 🚀 Comandos de Manutenção
- `npm run dev`: Inicia o ambiente de desenvolvimento.
- `cd functions && npm run build`: Compila as funções do backend.
- `firebase deploy --only functions`: Sobe as atualizações financeiras.

---
© 2026 EiLanches - Tech Lead: Ronaldo Júnior

### 🔐 Autenticação & Perfis
- Login com E-mail/Senha e Google OAuth
- Onboarding inteligente para seleção de perfil
- Sistema de fidelidade com pontos acumulativos
- Gestão completa de dados pessoais e endereços

### 🛒 Cliente - App de Pedidos
- **Home Moderna** com algoritmo de ranking de lojas
- **Cardápio Digital** com busca e categorias inteligentes
- **Carrinho Inteligente**:
  - Cupons de desconto (percentual/fixo)
  - Agendamento de entrega
  - Múltiplas formas de pagamento
  - Cálculo automático de taxas
- **Pagamento PIX** via Asaas (sandbox/produção)
- **Acompanhamento em Tempo Real** do pedido
- **Sistema de Avaliação** para loja e entregador

### 🏪 Lojista - Dashboard Administrativo
- **Gestão de Pedidos** completa
- **Cardápio Digital** com editor de produtos
- **Sistema de Cupons** personalizados
- **Configurações da Loja** (horários, tempo de entrega)
- **Carteira Financeira**:
  - Saldo liberado vs retido
  - Histórico detalhado de vendas
  - Gráficos de evolução
  - Solicitação de saque

### 🚚 Entregador - App de Entrega
- **Dashboard com Mapa** interativo (Leaflet)
- **Sistema de Segurança** com código de 4 dígitos
- **Upload de Comprovantes** fotográficos
- **Carteira Digital** com acumulação de taxas
- **Configurações** de veículo e status

### 🔒 Segurança & Infraestrutura
- **Firestore Rules** avançadas
- **Custódia de Saldo** automática
- **Split de Pagamento** inteligente
- **Validações de Negócio** robustas

---

## ⚙️ Configuração do Ambiente

### 1. Pré-requisitos
```bash
# Node.js 18+ necessário
npm --version

# Clone o repositório
git clone <repository-url>
cd eilanches---delivery-premium
```

### 2. Instalação
```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas credenciais
```

### 3. Variáveis de Ambiente

**IMPORTANTE:** Copie o arquivo de exemplo e configure suas credenciais:

```bash
# Copiar arquivo de exemplo
cp .env.example .env
# Ou use o arquivo com dados preenchidos
cp .env.local.example .env
```

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_FIREBASE_VAPID_KEY=your_firebase_vapid_key

# Asaas Configuration
VITE_ASAAS_API_KEY=your_asaas_api_key
VITE_ASAAS_BASE_URL=https://sandbox.asaas.com/api/v3

# Services Configuration
VITE_IMGBB_KEY=your_imgbb_key
VITE_UNSPLASH_ACCESS_KEY=your_unsplash_access_key
VITE_ADMIN_PHONE=your_admin_phone

# App Configuration
VITE_TERMS_VERSION=1.0
VITE_APP_NAME=EiLanches
VITE_APP_VERSION=1.0.0
```

### 🔧 Solução de Problemas Firebase

**Erro CORS do Firestore:**
Se você encontrar erros de CORS com o Firestore, verifique:

1. **Variáveis de Ambiente:** Certifique-se de que todas as variáveis do Firebase estão preenchidas no `.env`
2. **Projeto Firebase:** Verifique se o projeto ID está correto
3. **Regras de Segurança:** As regras do Firestore devem permitir leitura/escrita para usuários autenticados

**Exemplo de regras básicas para Firestore:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 4. Firebase Setup
1. Crie projeto no [Firebase Console](https://console.firebase.google.com)
2. Ative **Authentication** (Email/Google)
3. Ative **Firestore Database**
4. Configure **Storage** para imagens
5. Aplique as **Firestore Rules** do projeto
6. Crie índices compostos se solicitado

### 5. Asaas Setup
1. Crie conta no [Asaas Sandbox](https://sandbox.asaas.com)
2. Gere API Key
3. Configure webhook para notificações

---

## 🚀 Executando a Aplicação

### Desenvolvimento Web
```bash
# Iniciar servidor de desenvolvimento
npm run dev

# Acessar: http://localhost:5173
```

### Build para Produção
```bash
# Build otimizado
npm run build

# Preview do build
npm run preview
```

### Mobile (Capacitor)
```bash
# Sincronizar com plataformas nativas
npx cap sync

# Abrir projeto Android
npx cap open android

# Abrir projeto iOS (requer Mac)
npx cap open ios
```

---

## 🔐 Auditoria de Segurança

Execute auditoria completa de segurança:
```bash
# Executar auditoria de segurança
node scripts/security-audit.js
```

A auditoria verifica:
- 🔐 Chaves expostas no código
- 🛡️ Configurações de segurança
- 📋 Variáveis de ambiente
- 🔍 Padrões de código seguro

---

## 📱 Build & Deploy (EAS)

### Configuração EAS
```bash
# Login no EAS
npx eas login

# Inicializar projeto EAS
npx eas init
```

### Build para Android
```bash
# Build de desenvolvimento
npx eas build --platform android --profile development

# Build para preview/testes
npx eas build --platform android --profile preview

# Build para produção
npx eas build --platform android --profile production
```

### Build para iOS
```bash
# Build para produção (requer conta Apple)
npx eas build --platform ios --profile production
```

---

## � Estrutura do Projeto

```
eilanches---delivery-premium/
├── src/
│   ├── components/         # Componentes reutilizáveis
│   ├── screens/           # Telas da aplicação
│   ├── context/           # Contextos React
│   ├── services/          # Serviços externos
│   ├── config/            # Configurações
│   └── types/             # Tipos TypeScript
├── styles/                # Estilos CSS
├── scripts/               # Scripts de utilidade
├── functions/             # Cloud Functions (Firebase)
├── public/                # Arquivos estáticos
├── capacitor.config.ts    # Configuração Capacitor
├── eas.json              # Configuração EAS Build
├── app.json              # Configuração Expo
└── package.json          # Dependências do projeto
```

---

## 🚧 Próximos Passos

### Backend (Cloud Functions)
- [ ] Implementar webhook Asaas automático
- [ ] Cron job para liberação de saldos
- [ ] Notificações push (FCM)
- [ ] Processamento de saques automáticos

### Painel Administrativo
- [ ] Dashboard Super Admin
- [ ] Gestão de saques pendentes
- [ ] Análises e métricas globais
- [ ] Gestão de usuários e lojas

### Melhorias
- [ ] Modo claro/escuro automático
- [ ] Offline-first com Service Worker
- [ ] Geolocalização avançada
- [ ] Sistema de notificações in-app

---

## 🛠️ Tecnologias Utilizadas

### Frontend
- **React 18** - UI Framework
- **TypeScript** - Tipagem segura
- **Vite** - Build tool rápido
- **TailwindCSS** - Framework CSS
- **React Router** - Navegação
- **React Hook Form** - Formulários
- **Framer Motion** - Animações

### Backend & Services
- **Firebase** - Database & Auth
- **Firestore** - NoSQL Database
- **Asaas** - Processamento PIX
- **Capacitor** - App Nativo
- **EAS Build** - Deploy Mobile

### Development
- **ESLint** - Linting
- **TypeScript** - Type Safety
- **Git Hooks** - Pre-commit
- **Prettier** - Code Formatting

---

## 📈 Status do Projeto

### ✅ Concluído
- MVP completo funcionando
- Integração com Asaas (PIX)
- Sistema de fidelidade
- Dashboard administrativo
- App de entregadores
- Build mobile ready

### 🚧 Em Progresso
- Cloud Functions production
- Painel Super Admin
- Otimizações de performance

### 🎯 Roadmap
- Q2 2024: Lançamento oficial
- Q3 2024: Expansão para novas cidades
- Q4 2024: Recursos avançados de IA

---

## 🤝 Contribuição

1. Fork o projeto
2. Crie branch para feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para branch (`git push origin feature/AmazingFeature`)
5. Abra Pull Request

---

## 📄 Licença

Este projeto é privado e proprietário. Todos os direitos reservados.

---

## 📞 Suporte

Para suporte técnico, entre em contato:
- 📧 Email: support@eilanches.com
- 📱 Telefone: (XX) XXXXX-XXXX

**🚀 EiLanches - O futuro dos delivery apps em pequenos povoados!**