# 🚨 Configuração de Segurança do Firebase (Firestore Rules)

Para corrigir o erro `Missing or insufficient permissions` ao adicionar ao carrinho, favoritar itens ou criar pedidos, você precisa atualizar as regras de segurança no Console do Firebase.

## 📜 Regras Completas (Copie e Cole)

Vá em **Firestore Database** > **Rules** e substitua tudo por isso:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Função auxiliar para verificar se está logado
    function isAuthenticated() {
      return request.auth != null;
    }

    // Função para verificar se é o dono do documento
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // 1. USUÁRIOS (Perfil)
    // Cada um lê e edita o seu. Vendedores/Entregadores também.
    match /users/{userId} {
      allow read: if true; // Necessário para ler dados da loja (cardápio)
      allow write: if isOwner(userId);
      
      // Subcoleção: CARDÁPIO (Lojas)
      match /cardapio/{itemId} {
        allow read: if true; // Público para clientes verem
        allow write: if isOwner(userId); // Só a loja edita
      }
      
      // Subcoleção: CUPONS
      match /coupons/{couponId} {
        allow read: if true;
        allow write: if isOwner(userId);
      }
      
      // Subcoleção: FAVORITOS (Clientes)
      match /favorites/{itemId} {
        allow read, write: if isOwner(userId);
      }
    }

    // 2. PEDIDOS
    // Cliente cria. Loja e Entregador leem/atualizam se estiverem envolvidos.
    match /pedidos/{orderId} {
      allow create: if isAuthenticated();
      allow read: if isAuthenticated() && (
        resource.data.clienteUid == request.auth.uid || 
        resource.data.lojaId == request.auth.uid || 
        resource.data.entregadorUid == request.auth.uid
      );
      allow update: if isAuthenticated() && (
        resource.data.clienteUid == request.auth.uid || 
        resource.data.lojaId == request.auth.uid || 
        resource.data.entregadorUid == request.auth.uid ||
        // Permite entregador aceitar (se o campo entregadorUid ainda não existir ou for null)
        (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'entregadorUid', 'entregadorNome']))
      );
    }
    
    // 3. AVALIAÇÕES
    match /avaliacoes/{reviewId} {
      allow read: if true;
      allow create: if isAuthenticated();
    }

    // 4. CARTEIRAS E SAQUES (Financeiro)
    match /wallets/{userId} {
      allow read: if isOwner(userId);
      allow write: if false; // Somente via Cloud Functions (backend)
    }
    
    match /saques/{saqueId} {
      allow create: if isAuthenticated();
      allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
    }
  }
}
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
