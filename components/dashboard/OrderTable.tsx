import React, { useState } from 'react';
import { OrderData } from '../../types';
import { OrderStatus } from '../../services/orderManagementService';

interface OrderTableProps {
  pedidos: OrderData[];
  onAceitar: (orderId: string) => void;
  onIniciarPreparo: (orderId: string) => void;
  onMarcarPronto: (orderId: string) => void;
  onEnviarEntrega: (orderId: string) => void;
}

const OrderTable: React.FC<OrderTableProps> = ({
  pedidos,
  onAceitar,
  onIniciarPreparo,
  onMarcarPronto,
  onEnviarEntrega
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  const getStatusColor = (status: string) => {
    switch (status) {
      case OrderStatus.PENDENTE:
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case OrderStatus.CONFIRMADO:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case OrderStatus.PREPARANDO:
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case OrderStatus.PRONTO:
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case OrderStatus.SAIU_ENTREGA:
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case OrderStatus.ENTREGUE:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      case OrderStatus.CANCELADO:
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
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
    return date.toLocaleString('pt-BR', { 
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Filtrar pedidos
  const pedidosFiltrados = pedidos.filter(pedido => {
    const matchSearch = pedido.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       pedido.lojaNome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'todos' || pedido.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const renderActionButton = (pedido: OrderData) => {
    switch (pedido.status) {
      case OrderStatus.PENDENTE:
        return (
          <button
            onClick={() => onAceitar(pedido.id)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 active:scale-95 transition-all"
          >
            ✅ Aceitar
          </button>
        );
      
      case OrderStatus.CONFIRMADO:
        return (
          <button
            onClick={() => onIniciarPreparo(pedido.id)}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 active:scale-95 transition-all"
          >
            👨‍🍳 Preparar
          </button>
        );
      
      case OrderStatus.PREPARANDO:
        return (
          <button
            onClick={() => onMarcarPronto(pedido.id)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 active:scale-95 transition-all"
          >
            🚀 Pronto
          </button>
        );
      
      case OrderStatus.PRONTO:
        return (
          <button
            onClick={() => onEnviarEntrega(pedido.id)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 active:scale-95 transition-all"
          >
            🏍️ Entregar
          </button>
        );
      
      default:
        return (
          <span className="px-4 py-2 bg-gray-600 text-gray-300 rounded-lg font-medium">
            {getStatusIcon(pedido.status)} Finalizado
          </span>
        );
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">📦 Pedidos</h2>
          <span className="text-orange-200 font-medium">
            {pedidosFiltrados.length} pedidos encontrados
          </span>
        </div>
        
        {/* Filtros */}
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="🔍 Buscar por cliente ou loja..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-orange-300 focus:outline-none focus:border-orange-400"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-400"
          >
            <option value="todos">📊 Todos Status</option>
            <option value={OrderStatus.PENDENTE}>⏰ Pendentes</option>
            <option value={OrderStatus.CONFIRMADO}>✅ Confirmados</option>
            <option value={OrderStatus.PREPARANDO}>👨‍🍳 Preparando</option>
            <option value={OrderStatus.PRONTO}>🚀 Prontos</option>
            <option value={OrderStatus.SAIU_ENTREGA}>🏍️ Em Entrega</option>
            <option value={OrderStatus.ENTREGUE}>✅ Entregues</option>
            <option value={OrderStatus.CANCELADO}>❌ Cancelados</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        {pedidosFiltrados.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-orange-200 font-medium text-xl">Nenhum pedido encontrado</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-left text-orange-200 font-medium">Pedido</th>
                <th className="px-6 py-4 text-left text-orange-200 font-medium">Cliente</th>
                <th className="px-6 py-4 text-left text-orange-200 font-medium">Itens</th>
                <th className="px-6 py-4 text-left text-orange-200 font-medium">Total</th>
                <th className="px-6 py-4 text-left text-orange-200 font-medium">Status</th>
                <th className="px-6 py-4 text-left text-orange-200 font-medium">Data</th>
                <th className="px-6 py-4 text-left text-orange-200 font-medium">Ações</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-white/5">
              {pedidosFiltrados.map((pedido) => (
                <tr key={pedido.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-white font-medium">#{pedido.id.slice(-6)}</span>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-white font-medium">{pedido.clienteNome}</p>
                      <p className="text-orange-300 text-sm">{pedido.clienteTelefone}</p>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="max-w-xs">
                      {(pedido as any).itens?.slice(0, 2).map((item: any, index: number) => (
                        <p key={index} className="text-orange-200 text-sm">
                          {item.quantidade}x {item.produtoNome}
                        </p>
                      ))}
                      {(pedido as any).itens?.length > 2 && (
                        <p className="text-orange-300 text-xs">
                          +{(pedido as any).itens.length - 2} itens
                        </p>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <span className="text-white font-bold">
                      R$ {(pedido.finalTotal || 0).toFixed(2)}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(pedido.status)}`}>
                      {getStatusIcon(pedido.status)} {pedido.status}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4">
                    <span className="text-orange-200 text-sm">
                      {formatTime(pedido.createdAt)}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4">
                    {renderActionButton(pedido)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default OrderTable;
