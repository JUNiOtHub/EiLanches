// src/utils/statusConfig.ts

export const statusConfig: Record<string, {
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  animation?: string;
}> = {
  pendente: {
    label: 'Aguardando Loja',
    icon: '⏳',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400'
  },
  preparando: {
    label: 'Na Cozinha',
    icon: '👨‍🍳',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400'
  },
  entrega: { // Mapeado de 'entrega' no backend
    label: 'Saiu para Entrega',
    icon: '🛵',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400'
  },
  pronto_retirada: {
    label: 'Pronto p/ Retirada',
    icon: '🛍️',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    border: 'border-green-400'
  },
  atrasado: {
    label: 'Atrasado',
    icon: '🔥',
    color: 'text-red-500',
    bg: 'bg-red-500/20',
    border: 'border-red-600',
    animation: 'animate-pulse'
  },
  falha_pagamento: {
    label: 'Erro no Pagamento',
    icon: '❌',
    color: 'text-red-600',
    bg: 'bg-red-600/10',
    border: 'border-red-600'
  },
  concluido: {
    label: 'Entregue',
    icon: '✅',
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    border: 'border-green-500'
  },
  cancelado: {
    label: 'Cancelado',
    icon: '🚫',
    color: 'text-gray-400',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500'
  }
};

export const getStatusConfig = (status: string, createdAt?: any) => {
  // Lógica de atraso (ex: > 45 min e não concluído)
  if (createdAt && ['pendente', 'preparando'].includes(status)) {
    const created = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const diffMinutes = (new Date().getTime() - created.getTime()) / 1000 / 60;
    if (diffMinutes > 45) return statusConfig['atrasado'];
  }
  
  return statusConfig[status] || {
    label: status,
    icon: '❓',
    color: 'text-gray-400',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500'
  };
};
