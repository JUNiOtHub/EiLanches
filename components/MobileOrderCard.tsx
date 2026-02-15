import React from 'react';
import { OrderData, OrderStatus } from '../types';

interface MobileOrderCardProps {
  pedido: OrderData;
  onAceitar: () => void;
  onIniciarPreparo: () => void;
  onMarcarPronto: () => void;
  onEnviarEntrega: () => void;
}

const MobileOrderCard: React.FC<MobileOrderCardProps> = ({
  pedido,
  onAceitar,
  onIniciarPreparo,
  onMarcarPronto,
  onEnviarEntrega
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case OrderStatus.PENDENTE:
        return 'bg-yellow-500';
      case OrderStatus.CONFIRMADO:
        return 'bg-blue-500';
      case OrderStatus.PREPARANDO:
        return 'bg-orange-500';
      case OrderStatus.PRONTO:
        return 'bg-green-500';
      case OrderStatus.SAIU_ENTREGA:
        return 'bg-purple-500';
      case OrderStatus.ENTREGUE:
        return 'bg-gray-500';
      case OrderStatus.CANCELADO:
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case OrderStatus.PENDENTE:
        return '⏰';
      case OrderStatus.CONFIRMADO:
        return '✅';
      case OrderStatus.PREPARANDO:
        return '👨‍🍳';
      case OrderStatus.PRONTO:
        return '🚀';
      case OrderStatus.SAIU_ENTREGA:
        return '🏍️';
      case OrderStatus.ENTREGUE:
        return '✅';
      case OrderStatus.CANCELADO:
        return '❌';
      default:
        return '📦';
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderActionButtons = () => {
    switch (pedido.status) {
      case OrderStatus.PENDENTE:
        return (
          <button
            onClick={onAceitar}
            className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-green-700 active:scale-95 transition-all"
          >
            ✅ Aceitar Pedido
          </button>
        );
      
      case OrderStatus.CONFIRMADO:
        return (
          <button
            onClick={onIniciarPreparo}
            className="flex-1 bg-orange-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-orange-700 active:scale-95 transition-all"
          >
            👨‍🍳 Iniciar Preparo
          </button>
        );
      
      case OrderStatus.PREPARANDO:
        return (
          <button
            onClick={onMarcarPronto}
            className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-green-700 active:scale-95 transition-all"
          >
            🚀 Marcar como Pronto
          </button>
        );
      
      case OrderStatus.PRONTO:
        return (
          <button
            onClick={onEnviarEntrega}
            className="flex-1 bg-purple-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-purple-700 active:scale-95 transition-all"
          >
            🏍️ Enviar para Entrega
          </button>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4 border border-white/20 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${getStatusColor(pedido.status)}`}></div>
          <span className="text-white font-bold text-lg">
            {getStatusIcon(pedido.status)} {pedido.status}
          </span>
        </div>
        <span className="text-orange-200 text-sm">
          {formatTime(pedido.createdAt)}
        </span>
      </div>

      {/* Cliente */}
      <div className="mb-3">
        <p className="text-white font-bold text-lg">{pedido.clienteNome}</p>
        <p className="text-orange-200 text-sm">{pedido.clienteTelefone}</p>
      </div>

      {/* Itens do Pedido */}
      <div className="bg-black/20 rounded-2xl p-3 mb-3">
        <p className="text-orange-200 text-sm font-bold mb-2">📦 Itens:</p>
        {(pedido as any).itens?.map((item: any, index: number) => (
          <div key={index} className="flex justify-between items-center mb-1">
            <span className="text-white text-sm">
              {item.quantidade}x {item.produtoNome}
            </span>
            <span className="text-orange-200 text-sm">
              R$ {item.subtotal?.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Endereço (se houver) */}
      {(pedido as any).endereco && (
        <div className="bg-black/20 rounded-2xl p-3 mb-3">
          <p className="text-orange-200 text-sm font-bold mb-1">📍 Entrega:</p>
          <p className="text-white text-sm">
            {(pedido as any).endereco.rua}, {(pedido as any).endereco.numero}
          </p>
          <p className="text-orange-200 text-sm">
            {(pedido as any).endereco.bairro}
          </p>
        </div>
      )}

      {/* Total */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-white font-bold text-lg">Total:</span>
        <span className="text-orange-200 font-bold text-xl">
          R$ {(pedido.finalTotal || 0).toFixed(2)}
        </span>
      </div>

      {/* Botão de Ação */}
      {renderActionButtons()}
    </div>
  );
};

export default MobileOrderCard;
