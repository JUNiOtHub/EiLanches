import React from 'react';
import toast from 'react-hot-toast';

// Helper to format time nicely
const getTimeAgo = (date: any) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    const diffMinutes = (new Date().getTime() - d.getTime()) / 1000 / 60;
    if (diffMinutes < 1) return 'Agora';
    return `${Math.floor(diffMinutes)} min atrás`;
};

// Helper for status colors
const getStatusMeta = (status: string) => {
    switch (status) {
        case 'pendente':
            return { color: 'border-yellow-400', label: 'Novo' };
        case 'preparando':
            return { color: 'border-blue-400', label: 'Em Preparo' };
        case 'entrega':
        case 'pronto_retirada':
            return { color: 'border-green-400', label: 'Pronto / Saiu' };
        case 'cancelado':
            return { color: 'border-red-500', label: 'Cancelado' };
        default:
            return { color: 'border-gray-600', label: 'Indefinido' };
    }
};

interface ModernOrderCardProps {
    order: any;
    onUpdateStatus: (orderId: string, newStatus: string) => void;
}

export const ModernOrderCard: React.FC<ModernOrderCardProps> = ({ order, onUpdateStatus }) => {
    const { color: statusColor } = getStatusMeta(order.status);

    const handleCopyTicket = (e: React.MouseEvent) => {
        e.stopPropagation();
        const text = `*PEDIDO #${order.id.slice(-4)}*\nCliente: ${order.clienteNome}\nItens: ${order.itens.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}\nTotal: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.finalTotal || order.total)}`;
        navigator.clipboard.writeText(text);
        toast.success("Ticket do pedido copiado!");
    };
    
    // Determine the next logical action
    const getNextAction = () => {
        switch (order.status) {
            case 'pendente':
                return {
                    label: 'Aceitar',
                    icon: 'fa-arrow-right',
                    action: () => onUpdateStatus(order.id, 'preparando'),
                    className: 'bg-yellow-400/10 text-yellow-300 hover:bg-yellow-400/20'
                };
            case 'preparando':
                 const isPickup = order.deliveryMode === 'pickup';
                 const nextStatus = isPickup ? 'pronto_retirada' : 'entrega';
                 return {
                    label: isPickup ? 'Pronto p/ Retirada' : 'Saiu p/ Entrega',
                    icon: isPickup ? 'fa-person-walking-luggage' : 'fa-motorcycle',
                    action: () => onUpdateStatus(order.id, nextStatus),
                    className: 'bg-blue-400/10 text-blue-300 hover:bg-blue-400/20'
                 };
            case 'entrega':
            case 'pronto_retirada':
                return {
                    label: 'Concluir Pedido',
                    icon: 'fa-flag-checkered',
                    action: () => onUpdateStatus(order.id, 'concluido'),
                    className: 'bg-green-400/10 text-green-300 hover:bg-green-400/20'
                };
            default:
                return null;
        }
    };

    const nextAction = getNextAction();

    return (
        <div className={`bg-[#181818] border-l-4 ${statusColor} rounded-lg p-4 shadow-md hover:shadow-lg transition-all ease-in-out duration-300 cursor-pointer animate-in fade-in slide-in-from-bottom-3`}>
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-white text-lg">#{order.id.slice(-4)}</span>
                    <span className="text-gray-500 text-xs">{getTimeAgo(order.createdAt)}</span>
                </div>
                <button
                    onClick={handleCopyTicket}
                    className="w-8 h-8 flex items-center justify-center bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
                    title="Copiar Ticket"
                >
                    <i className="fa-solid fa-clipboard text-xs"></i>
                </button>
            </div>

            {/* Body */}
            <div className="mb-4">
                <p className="font-semibold text-white truncate">{order.clienteNome}</p>
                <div className="text-gray-400 text-sm mt-2 space-y-1">
                    {order.itens.map((item: any, index: number) => (
                        <div key={index}>
                            <span className="font-medium text-gray-300">{item.quantity}x</span> {item.name}
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-3 border-t border-white/5">
                <div className="font-bold text-lg text-white">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.finalTotal || order.total)}
                </div>
                {nextAction && (
                    <button
                        onClick={(e) => { e.stopPropagation(); nextAction.action(); }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition-all ${nextAction.className}`}
                    >
                        <span>{nextAction.label}</span>
                        <i className={`fa-solid ${nextAction.icon}`}></i>
                    </button>
                )}
            </div>
        </div>
    );
};