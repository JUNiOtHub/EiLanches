# 🚀 Configuração do Mercado Pago - EiLanches

## 📋 Credenciais Fornecidas

### ✅ Dados Reais (Produção)
```
Public Key: APP_USR-c214f92c-b671-446f-80fb-caeba2252202
Access Token: APP_USR-2754483714539775-021417-2a09f35b4da8ff5f3a0eaaf98bd0ca44-3203099803
App ID: 2754483714539775
User ID: 3203099803
```

### ✅ Dados de Teste
```
Usuário: TESTUSER9000165659199812630
Senha: 2tJawOyaLk
Código: 099803
```

## 🔧 Passo 1: Configurar Ambiente Local

Crie o arquivo `.env.local` na raiz do projeto com:

```bash
# Copie e cole estas credenciais no seu .env.local
VITE_MERCADO_PAGO_PUBLIC_KEY=APP_USR-c214f92c-b671-446f-80fb-caeba2252202
VITE_MERCADO_PAGO_ACCESS_TOKEN=APP_USR-2754483714539775-021417-2a09f35b4da8ff5f3a0eaaf98bd0ca44-3203099803

# Crie o arquivo functions/.env com:
MP_ACCESS_TOKEN_PROD=APP_USR-2754483714539775-021417-2a09f35b4da8ff5f3a0eaaf98bd0ca44-3203099803

# Firebase Functions (ambiente)
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-2754483714539775-021417-2a09f35b4da8ff5f3a0eaaf98bd0ca44-3203099803
MERCADO_PAGO_WEBHOOK_URL=https://seu-dominio.com/webhook/mercadopago
```

## 🔧 Passo 2: Instalar Dependências

```bash
# Frontend
npm install @mercadopago/sdk-react @mercadopago/sdk-js

# Firebase Functions
cd functions
npm install mercadopago
```

## 🔧 Passo 3: Configurar Webhook

### 1. Acesse o Mercado Pago Developers
- URL: https://www.mercadopago.com/developers
- Faça login com suas credenciais

### 2. Configure o Webhook
- Vá para "Webhooks" no painel
- URL: `https://seu-projeto.web.app/webhook/mercadopago`
- Eventos: `payment`, `preapproval`
- Status: `pending`, `approved`, `rejected`

### 3. Teste o Webhook
- Use o botão "Test webhook"
- Verifique se recebe no Firebase Functions

## 🔧 Passo 4: Deploy das Functions

```bash
# Build e deploy
cd functions
npm run build
firebase deploy --only functions

# Deploy frontend
cd ..
npm run build
firebase deploy
```

## 🔧 Passo 5: Configurar Marketplace

### 1. Ativar Modo Marketplace
- No painel do Mercado Pago
- Vá para "Configurações" > "Marketplace"
- Ative o modo marketplace

### 2. Configurar Split de Pagamento
- Defina comissão padrão: 10%
- Configure regras de divisão
- Teste com transação real

## 🧪 Passo 6: Testes

### Teste 1: Pagamento Pix
1. Abra o app
2. Faça um pedido de teste
3. Selecione Pix
4. Gere QR Code
5. Use app de banco para pagar
6. Verifique webhook

### Teste 2: Pagamento Cartão
1. Faça pedido de teste
2. Selecione Cartão
3. Use dados de teste:
   - Número: 5031 4332 1540 6351
   - Validade: 11/25
   - CVV: 123
   - Titular: AP

### Teste 3: Split Automático
1. Verifique se lojista recebeu
2. Verifique se entregador recebeu
3. Verifique se app recebeu comissão
4. Confirme notificações

## 🚨 Validação de Produção

### ✅ Checklist Antes de Lançar
- [ ] Credenciais configuradas
- [ ] Webhook ativo e testado
- [ ] Functions deployadas
- [ ] Split funcionando
- [ ] Notificações enviadas
- [ ] Saques funcionando
- [ ] Assinaturas ativas