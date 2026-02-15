# Sistema de Onboarding - EiLanches

Este documento descreve o sistema completo de onboarding profissional implementado para o EiLanches, incluindo cadastro de usuários, termos de uso e integração com provedor de pagamento.

## 📋 Visão Geral

O sistema de onboarding foi projetado para:
- Coletar dados necessários para cadastro de clientes, vendedores e entregadores
- Garantar aceitação dos termos de uso de forma legalmente válida
- Integrar com o Asaas para criação de contas e subcontas
- Proteger o acesso a funcionalidades baseado no status de onboarding

## 🏗️ Estrutura dos Componentes

### 1. Componentes de Onboarding

#### `VendedorOnboarding.tsx`
- **Finalidade**: Cadastro completo de lojistas/vendedores
- **Dados Coletados**:
  - Nome da loja, CNPJ/CPF
  - Endereço completo (CEP, rua, número, bairro, cidade, estado)
  - Telefone de contato
  - Dados bancários (tipo e chave PIX)
  - Configurações de entrega (própria ou via app)
  - Tempo médio de preparo

#### `EntregadorOnboarding.tsx`
- **Finalidade**: Cadastro de entregadores parceiros
- **Dados Coletados**:
  - Nome completo, CPF
  - Telefone de contato
  - Dados bancários (tipo e chave PIX)
  - Dados do veículo (tipo, placa)
  - Foto da CNH (upload)

#### `ClienteOnboarding.tsx`
- **Finalidade**: Cadastro simplificado de clientes
- **Dados Coletados**:
  - Nome completo, CPF
  - Telefone de contato
  - Endereço (opcional, para facilitar entregas futuras)

### 2. Componentes de Suporte

#### `TermsModal.tsx`
- **Finalidade**: Exibir termos de uso de forma interativa
- **Características**:
  - Scroll obrigatório até o final
  - Botão "Aceitar" habilitado apenas após scroll completo
  - Textos diferentes para cada tipo de usuário
  - Design responsivo e acessível

#### `OnboardingGuard.tsx`
- **Finalidade**: Proteger rotas baseado no status de onboarding
- **Funcionalidades**:
  - Verificação automática de status
  - Redirecionamento inteligente
  - Mensagens de erro contextuais
  - Hook `useOnboardingGuard` para uso em componentes

## 🔧 Serviços

### `paymentProvider.ts`
Serviço central para integração com provedores de pagamento:

#### Funções Principais:
- `createVendedorAccount()`: Cria subconta no Asaas para vendedores
- `createEntregadorAccount()`: Cria conta no Asaas para entregadores
- `createClienteAccount()`: Cria conta no Asaas para clientes
- `validatePixKey()`: Valida formatos de chave PIX
- `checkOnboardingStatus()`: Verifica status do onboarding
- `updateAccount()`: Atualiza dados da conta

### `onboardingGuard.ts`
Classe estática para verificação de permissões:

#### Métodos:
- `checkAccess()`: Verifica acesso baseado em funcionalidade
- `checkVendedorAccess()`: Validações específicas para vendedores
- `checkEntregadorAccess()`: Validações específicas para entregadores
- `checkClienteAccess()`: Validações específicas para clientes

## 📝 Termos de Uso

### Estrutura dos Termos
Os termos estão organizados por tipo de usuário em `config/terms.ts`:

#### Cliente
- Responsabilidades da plataforma como intermediadora
- Direitos e deveres do cliente
- Política de cancelamentos e reembolsos

#### Vendedor
- Estrutura de comissões (R$ 60 ou 12%)
- Prazos de liberação de pagamentos
- Responsabilidades operacionais

#### Entregador
- Natureza autônoma da relação
- Sistema de remuneração por KM
- Normas de conduta e segurança

### Validação Legal
- Scroll obrigatório até o final
- Registro de data/hora do aceite
- Versionamento dos termos
- Armazenamento seguro do consentimento

## 🔐 Segurança

### Validações Implementadas
- **CPF/CNPJ**: Formato e dígitos verificadores
- **Telefone**: Formato brasileiro (10/11 dígitos)
- **Chave PIX**: Validação específica por tipo
- **Placa Veículo**: Formato Mercosul
- **Email**: Formato padrão RFC 5322

### Proteção de Dados
- Dados sensíveis enviados via HTTPS
- Validação client-side e server-side
- Armazenamento seguro no Firestore
- Máscara de dados sensíveis em logs

## 🚀 Fluxo de Onboarding

### 1. Seleção de Tipo de Usuário
```
Usuário logado → Tela de seleção → Escolha (cliente/vendedor/entregador)
```

### 2. Preenchimento do Formulário
```
Formulário específico → Validação → Salvar dados → Criar conta Asaas
```

### 3. Aceite dos Termos
```
Modal de termos → Scroll completo → Aceite → Redirecionamento
```

### 4. Acesso ao Dashboard
```
Verificação de status → Acesso liberado → Dashboard específico
```

## 🔄 Integração com Asaas

### Vendedores (Subcontas)
- Criação de subconta com `walletId`
- Configuração automática de split de pagamentos
- Retenção de comissões

### Entregadores (Clientes)
- Criação de conta como cliente
- Recebimento de pagamentos por entrega
- Liberação mediante validação

### Clientes (Clientes)
- Criação de conta para histórico
- Facilita recompras
- Programa de fidelidade

## 📊 Variáveis de Ambiente

### Obrigatórias
```bash
VITE_TERMS_VERSION=1.0
VITE_ASAAS_API_KEY=sua_chave_api
VITE_ASAAS_BASE_URL=https://sandbox.asaas.com/api/v3
```

### Opcionais
```bash
VITE_TWILIO_ACCOUNT_SID
VITE_TWILIO_AUTH_TOKEN
VITE_TWILIO_PHONE_NUMBER
```

## 🛣️ Rotas Protegidas

### Exemplo de Uso
```tsx
import { ProtectedRoute } from '../components/OnboardingGuard';

// Proteger dashboard de vendedor
<ProtectedRoute requiredFeature="dashboard">
  <VendedorDashboard />
</ProtectedRoute>

// Proteger área de pagamentos
<ProtectedRoute requiredFeature="payments">
  <PaymentsArea />
</ProtectedRoute>
```

### Tipos de Funcionalidades
- `dashboard`: Acesso geral ao dashboard
- `orders`: Gerenciamento de pedidos
- `payments`: Área financeira
- `delivery`: Área de entregas

## 📱 UX/UI

### Design System
- Tema dark consistente com o app
- Inputs flutuantes com feedback visual
- Mensagens de erro em vermelho neon
- Animações suaves e micro-interações

### Acessibilidade
- Labels semânticos
- Navegação por teclado
- Contraste adequado
- Leitores de tela compatíveis

## 🔄 Manutenção

### Atualização de Termos
1. Incrementar `VITE_TERMS_VERSION`
2. Atualizar textos em `config/terms.ts`
3. Usuários existentes serão notificados para novo aceite

### Mudança de Provedor
1. Implementar nova integração em `paymentProvider.ts`
2. Manter interface consistente
3. Migrar dados existentes

## 📈 Métricas e Monitoramento

### KPIs Sugeridos
- Taxa de conclusão de onboarding
- Tempo médio de conclusão
- Taxa de aceite dos termos
- Erros por etapa do formulário

### Logs Importantes
- Tentativas de onboarding
- Falhas na criação de contas
- Aceites dos termos
- Redirecionamentos do guard

## 🚨 Solução de Problemas

### Issues Comuns
1. **Usuário não consegue acessar dashboard**
   - Verificar status de onboarding
   - Confirmar aceite dos termos
   - Validar conta Asaas

2. **Erro na criação de conta Asaas**
   - Verificar API key
   - Validar formato dos dados
   - Consultar limites da API

3. **Modal de termos não aparece**
   - Verificar versão dos termos
   - Confirmar estado do componente
   - Validar scroll completo

## 📞 Suporte

Para dúvidas ou problemas:
1. Consultar os logs do console
2. Verificar variáveis de ambiente
3. Validar dados de teste
4. Contactar equipe de desenvolvimento

---

**Versão**: 1.0  
**Última Atualização**: 2026-02-14  
**Responsável**: Equipe de Desenvolvimento EiLanches
