# 🚨 Implantar Regras do Firebase Firestore

## Problema Corrigido
As regras do Firestore foram atualizadas para permitir que vendedores acessem seus próprios pedidos através do campo `lojaId`.

## Como Implantar as Regras

### Opção 1: Firebase Console (Recomendado)
1. Abra o [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto: `offline-f2c69`
3. Vá para **Firestore Database** → **Rules**
4. Substitua todo o conteúdo das regras pelo arquivo `firestore.rules`
5. Clique em **Publish**

### Opção 2: Firebase CLI (Avançado)
```bash
# 1. Instalar Firebase CLI
npm install -g firebase-tools

# 2. Login no Firebase
firebase login

# 3. Navegar até o projeto
cd "e:/backup/eilanches---delivery-premium (1)"

# 4. Implantar regras
firebase deploy --only firestore:rules
```

## O que foi alterado?

### ANTES (muito restritivo):
```javascript
// Ler: apenas dono do pedido OU admin
allow read: if isAuthenticated() && (resource.data.clienteUid == request.auth.uid || isAdmin());
```

### DEPOIS (permitido para vendedores):
```javascript
// Ler: dono do pedido OU admin OU vendedor (lojaId == uid)
allow read: if isAuthenticated() && (
  resource.data.clienteUid == request.auth.uid || 
  isAdmin() ||
  resource.data.lojaId == request.auth.uid
);
```

## Resultado Esperado
Após implantar as regras, o dashboard do vendedor deverá:
- ✅ Carregar os pedidos normalmente
- ✅ Permitir atualização de status
- ✅ Mostrar métricas corretamente
- ✅ Sem erros de "Missing or insufficient permissions"

## Verificação
Após implantar, recarregue a página do dashboard e observe se:
1. Os pedidos aparecem na lista
2. Os erros no console desaparecem
3. As métricas são calculadas corretamente

## Debug
Se ainda houver erros, verifique no console:
- O campo `lojaId` está presente nos pedidos
- O UID do usuário logado corresponde ao `lojaId` dos pedidos
