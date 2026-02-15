# EiLanches – Cloud Functions

## Funções

### `onOrderConcludedCreditLoyalty`
- **Trigger:** atualização de um documento em `pedidos/{pedidoId}`.
- **Condição:** `status` passa a ser `concluido`.
- **Ação:** soma `loyaltyPointsEarned` ao campo `loyaltyPoints` do usuário em `users/{clienteUid}` e marca o pedido com `loyaltyPointsCredited: true` para evitar crédito duplicado.

### `validateDeliveryPIN` (callable)
- **Uso:** o entregador informa o PIN do pedido para finalizar a entrega (DeliveryDashboard).
- **Chamada no front:** `httpsCallable(functions, 'validateDeliveryPIN')` com `{ orderId, pin }`. Use a mesma região (`southamerica-east1`) em `getFunctions(app, 'southamerica-east1')` para evitar CORS/roteamento.
- **Comportamento:** callable do Firebase já lida com CORS; não é necessário middleware `cors` manual.

## Deploy

1. Instalar dependências e compilar:
   ```bash
   cd functions
   npm install
   npm run build
   ```
2. Configurar o projeto Firebase (se ainda não tiver):
   ```bash
   firebase login
   firebase use <seu-project-id>
   ```
3. Fazer o deploy apenas das functions:
   ```bash
   npm run deploy
   ```
   ou, na raiz do projeto:
   ```bash
   firebase deploy --only functions
   ```

## Região

As funções estão configuradas para `southamerica-east1` (São Paulo). Altere em `src/index.ts` se precisar de outra região.
