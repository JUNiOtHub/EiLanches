# 🚀 Migração Asaas → Mercado Pago

## 📋 Visão Geral

Este documento descreve a migração completa do sistema de pagamentos do **Asaas** para o **Mercado Pago** na aplicação EiLanches.

## 🎯 Objetivos

- ✅ Substituir gateway de pagamento Asaas por Mercado Pago
- ✅ Implementar QR Code Pix dinâmico
- ✅ Manter compatibilidade com cartão de crédito
- ✅ Webhook para confirmação automática de pagamentos
- ✅ Tratamento de falhas e erros de pagamento

## 📁 Arquivos Modificados/Criados

### Novos Arquivos
```
├── services/mercadoPagoService.ts          # Serviço principal do Mercado Pago
├── components/MercadoPagoCheckout.tsx      # Componente de checkout
├── functions/src/mercadoPago.ts            # Firebase Functions
├── functions/src/config/mercadoPago.ts     # Configuração
└── docs/MERCADO_PAGO_MIGRATION.md          # Este documento
```

### Arquivos Atualizados
```
├── package.json                            # Dependências do Mercado Pago
├── functions/package.json                  # SDK do Mercado Pago
├── .env.example                            # Variáveis de ambiente
└── screens/Cart.tsx                       # Integração do checkout
```

## 🔧 Configuração

### 1. Variáveis de Ambiente

Adicione ao seu `.env.local`:
```bash
# Mercado Pago
VITE_MERCADO_PAGO_PUBLIC_KEY=TEST-PUBLIC-KEY-APP_USUARIO-123456789
VITE_MERCADO_PAGO_ACCESS_TOKEN=TEST-ACCESS-TOKEN-APP_USUARIO-123456789

# Firebase Functions (ambiente)
MERCADO_PAGO_ACCESS_TOKEN=TEST-ACCESS-TOKEN-APP_USUARIO-123456789
MERCADO_PAGO_WEBHOOK_URL=https://seu-dominio.com/webhook/mercadopago
```

### 2. Instalação de Dependências

```bash
# Frontend
npm install @mercadopago/sdk-react @mercadopago/sdk-js

# Firebase Functions
cd functions
npm install mercadopago
```

### 3. Deploy das Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

## 💡 Fluxo de Pagamento

### 1. Criação da Preferência
```typescript
const preference = await mercadoPagoService.createPaymentPreference({
    orderId: 'pedido-123',
    items: cartItems,
    total: 150.00,
    customerInfo: { name, email, phone, cpf },
    deliveryAddress: { street, number, neighborhood, city, state, zipCode }
});
```

### 2. Pagamento Pix
```typescript
// Gera QR Code
const qrCode = await mercadoPagoService.generatePixQRCode(preference.preferenceId);

// Exibe QR Code e código copia e cola
<QRCodeModal qrCode={qrCode} />
```

### 3. Pagamento Cartão
```typescript
// Redireciona para checkout do Mercado Pago
window.location.href = preference.initPoint;
```

### 4. Webhook de Confirmação
```typescript
// Firebase Function processa webhook
export const processMercadoPagoWebhook = https.onRequest(async (req, res) => {
    const { type, data } = req.body;
    
    if (type === 'payment') {
        const payment = data;
        
        if (payment.status === 'approved') {
            await db.collection('pedidos').doc(payment.external_reference).update({
                status: 'preparando',
                paymentStatus: 'approved',
                approvedAt: new Date()
            });
        }
    }
});
```

## 🔄 Status de Pagamento

| Status Mercado Pago | Status Pedido EiLanches | Descrição |
|---------------------|------------------------|-----------|
| `pending` | `pendente` | Aguardando pagamento |
| `approved` | `preparando` | Pagamento aprovado |
| `rejected` | `falha_pagamento` | Pagamento recusado |
| `cancelled` | `cancelado` | Pagamento cancelado |

## 🎨 Componentes

### MercadoPagoCheckout
- **Props**: `orderData`, `onSuccess`, `onError`, `onClose`
- **Features**: QR Code Pix, pagamento cartão, resumo pedido
- **UI**: Modal responsivo com design EiLanches

### QRCodeModal
- **Features**: QR Code visual, código copia e cola
- **Timer**: Expiração em 30 minutos
- **Actions**: Copiar código, fechar modal

## 🚨 Tratamento de Erros

### Falha no Pagamento
```typescript
// Status falha_pagamento
{
    status: 'falha_pagamento',
    icon: '💳❌',
    color: 'text-zinc-400',
    label: 'ERRO NO PAGAMENTO'
}
```

### Timeout do QR Code
```typescript
// QR Code expirado
if (expired) {
    toast.error('QR Code expirado. Gere um novo.');
    generateNewQRCode();
}
```

## 🔍 Debug e Logs

### Console Logs
```bash
[Checkout] Criando preferência...
[MercadoPago] Preferência criada: PREF_123456
[Checkout] Gerando QR Code Pix...
[MercadoPago] QR Code gerado: TXN_789012
[Webhook] Pagamento aprovado: payment_345678
```

### Firebase Functions Logs
```bash
[MercadoPago] Criando preferência para pedido: pedido-123
[MercadoPago] Preferência criada: 123456
[MercadoPago] Webhook recebido: { type: 'payment', data: {...} }
[MercadoPago] Pedido pedido-123 aprovado e atualizado para preparando
```

## 📱 Testes

### Ambiente de Teste
1. Use chaves de teste do Mercado Pago
2. Teste QR Code Pix com app de banco
3. Teste cartão com dados de teste
4. Verifique webhook no console Firebase

### Casos de Teste
- ✅ Pix aprovado → Status "preparando"
- ✅ Pix expirado → Gerar novo QR Code
- ✅ Cartão aprovado → Redirecionamento sucesso
- ✅ Cartão recusado → Status "falha_pagamento"
- ✅ Webhook recebido → Atualização automática

## 🚀 Deploy em Produção

### 1. Configurar Webhook
- Acesse [Mercado Pago Developers](https://www.mercadopago.com/developers)
- Configure webhook: `https://seu-dominio.com/webhook/mercadopago`
- Teste webhook com sandbox

### 2. Atualizar Chaves
- Substitua chaves de teste por produção
- Atualize `.env.production`
- Deploy frontend e functions

### 3. Monitoramento
- Configure alertas no Firebase Console
- Monitore logs de webhook
- Verifique taxas de sucesso

## 🆘 Suporte

### Problemas Comuns
1. **QR Code não gera**: Verifique ACCESS_TOKEN
2. **Webhook não recebe**: Configure URL correta
3. **Pagamento não aprova**: Verifique dados do cliente
4. **Status não atualiza**: Verifique Firebase Rules

### Contato
- Suporte Mercado Pago: [developers.mercadopago.com](https://www.mercadopago.com/developers)
- Documentação: [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers)

---

## 🎉 Benefícios da Migração

- ⚡ **Aprovação Instantânea**: Pix em segundos
- 💰 **Taxas Competitivas**: 0.99% + R$0.30 Pix
- 📱 **Experiência Mobile**: QR Code nativo
- 🔒 **Segurança**: Tokenização automática
- 🌍 **Escalabilidade**: Infraestrutura global

**Sua migração está completa! 🚀**
