# RELATÓRIO DE APIs E SERVIÇOS EXTERNOS - EILANCHES

---

## 💸 PAGAMENTOS (FINANCEIRO)
### 1. Asaas (Ambiente Sandbox)
- **Base URL:** `https://sandbox.asaas.com/api/v3`
- **Uso:** Geração de cobranças PIX, criação de clientes, estornos e gestão de subcontas.
- **Referência:** `services/asaas.ts` (usado em `screens/Cart.tsx`, `screens/Dashboard.tsx`)

---

## 🖼️ IMAGENS E MÍDIA
### 2. ImgBB (Hospedagem de Imagens)
- **Endpoint:** `https://api.imgbb.com/1/upload`
- **Uso:** Upload de fotos de produtos (Painel do Lojista) e comprovantes de entrega (App do Entregador).
- **Chave de API (Publicada):** `4f069942c132182449dea4cf00814506`
- **Arquivos:** `screens/Dashboard.tsx`, `screens/DeliveryDashboard.tsx`

### 3. Unsplash (Banco de Imagens)
- **Endpoint:** `https://api.unsplash.com/search/photos`
- **Uso:** Busca de imagens de alta qualidade para cadastrar produtos e imagens de fallback (padrão).
- **Chave de API (Publicada):** `Ndzz_oRd3vCbU72lDHnZZ8qq5cbwuuNG3LVYLldfHoc`
- **Arquivos:** `screens/Dashboard.tsx`, `screens/Menu.tsx`, `screens/Home.tsx`

### 4. Google Charts API
- **Endpoint:** `https://chart.googleapis.com/chart`
- **Uso:** Geração dinâmica de QR Code para exibir a chave PIX do lojista no painel.
- **Arquivo:** `screens/Dashboard.tsx`

---

## 🗺️ MAPAS E GEOLOCALIZAÇÃO
### 5. CartoDB (via Leaflet)
- **Endpoint:** `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- **Uso:** Fornece os "tiles" (imagens do mapa) com o tema escuro (Dark Mode).
- **Arquivos:** `screens/DeliveryDashboard.tsx`, `screens/Cart.tsx`

### 6. OpenStreetMap
- **Uso:** Fonte de dados geográficos base para o Leaflet.

---

## ☁️ BACKEND & INFRAESTRUTURA (FIREBASE)
### 7. Firebase Authentication
- **Uso:** Gerenciamento de identidade e login (Email/Senha, Google).

### 8. Firebase Firestore (Banco de Dados NoSQL)
- **Coleções:** `users`, `pedidos`, `saques`, `avaliacoes`, `cardapio`, `coupons`, `favorites`.

### 9. Firebase Cloud Functions
- **Função:** `validateDeliveryPIN` (Validação segura do código de entrega).

---

## 🔗 OUTROS
### 10. WhatsApp API (Link Direto)
- **Endpoint:** `https://wa.me/`
- **Uso:** Redirecionamento para suporte e envio de mensagens pré-formatadas.