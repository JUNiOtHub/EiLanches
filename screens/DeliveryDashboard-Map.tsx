import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { DeliveryMap } from '@/src/components/DeliveryMap';
import { useHighPrecisionGeolocation } from '../services/highPrecisionGeolocation';
import { toast } from 'react-hot-toast';
import '../styles/delivery-map.css';

interface DeliveryOrder {
  id: string;
  customerName: string;
  customerAddress: string;
  customerLocation: { latitude: number; longitude: number };
  items: string[];
  totalValue: number;
  estimatedTime: number;
  distance: number;
  status: 'pending' | 'accepted' | 'delivering' | 'completed';
  earnings: number;
}

interface DeliveryStats {
  todayEarnings: number;
  todayDeliveries: number;
  totalDistance: number;
  averageRating: number;
  onlineTime: string;
}

export const DeliveryDashboardMap: React.FC = () => {
  const navigate = useNavigate();
  const [currentOrder, setCurrentOrder] = useState<DeliveryOrder | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [stats, setStats] = useState<DeliveryStats>({
    todayEarnings: 0,
    todayDeliveries: 0,
    totalDistance: 0,
    averageRating: 4.8,
    onlineTime: '0h 0m'
  });
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  const { location: currentLocation, quality, isRural } = useHighPrecisionGeolocation({
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
    forceHighAccuracy: true
  });

  // Simulação de pedidos (em produção, viria do Firebase)
  useEffect(() => {
    const mockOrders: DeliveryOrder[] = [
      {
        id: '1',
        customerName: 'João Silva',
        customerAddress: 'Rua das Flores, 123 - Jardim Botânico',
        customerLocation: { latitude: -23.5605, longitude: -46.6433 },
        items: ['X-Burger', 'Batata Frita', 'Refrigerante'],
        totalValue: 45.90,
        estimatedTime: 25,
        distance: 3.2,
        status: 'pending',
        earnings: 15.20
      },
      {
        id: '2',
        customerName: 'Maria Santos',
        customerAddress: 'Av. Paulista, 2000 - Bela Vista',
        customerLocation: { latitude: -23.5625, longitude: -46.6545 },
        items: ['Pizza Calabresa', 'Coca-Cola 2L'],
        totalValue: 68.50,
        estimatedTime: 35,
        distance: 5.8,
        status: 'pending',
        earnings: 24.30
      }
    ];

    // Simular chegada de um novo pedido após 5 segundos
    const timer = setTimeout(() => {
      if (isOnline && !currentOrder) {
        const newOrder = mockOrders[0];
        setCurrentOrder(newOrder);
        toast.success('🔔 Novo pedido recebido!', {
          duration: 5000
        });
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isOnline, currentOrder]);

  // Aceitar pedido
  const acceptOrder = () => {
    if (currentOrder) {
      setCurrentOrder({ ...currentOrder, status: 'accepted' });
      setShowOrderDetails(true);
      toast.success('✅ Pedido aceito! Inicie a entrega.');
    }
  };

  // Iniciar entrega
  const startDelivery = () => {
    if (currentOrder) {
      setCurrentOrder({ ...currentOrder, status: 'delivering' });
      toast('🚀 Entrega iniciada!');
    }
  };

  // Completar entrega
  const completeDelivery = () => {
    if (currentOrder) {
      setCurrentOrder({ ...currentOrder, status: 'completed' });
      setStats(prev => ({
        ...prev,
        todayEarnings: prev.todayEarnings + currentOrder.earnings,
        todayDeliveries: prev.todayDeliveries + 1,
        totalDistance: prev.totalDistance + currentOrder.distance
      }));
      
      toast.success('✅ Entrega concluída! Ganho: R$ ' + currentOrder.earnings.toFixed(2), {
        duration: 5000
      });

      setTimeout(() => {
        setCurrentOrder(null);
        setShowOrderDetails(false);
      }, 3000);
    }
  };

  // Rejeitar pedido
  const rejectOrder = () => {
    if (currentOrder) {
      setCurrentOrder(null);
      setShowOrderDetails(false);
      toast.error('❌ Pedido rejeitado');
    }
  };

  // Toggle online status
  const toggleOnlineStatus = () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    
    if (newStatus) {
      toast.success('🟢 Você está online para receber pedidos!');
    } else {
      toast('🔴 Você está offline. Não receberá novos pedidos.');
    }
  };

  return (
    <div className="delivery-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="dashboard-title">
              🏍️ Painel do Entregador
            </h1>
            <div className="location-info">
              <span className="location-text">
                📍 {isRural ? 'Zona Rural' : 'Zona Urbana'}
              </span>
              {quality && (
                <span className="accuracy-text">
                  🎯 {quality.accuracy.description}
                </span>
              )}
            </div>
          </div>
          
          <div className="header-right">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleOnlineStatus}
              className={`online-toggle ${isOnline ? 'online' : 'offline'}`}
            >
              <span className="toggle-icon">
                {isOnline ? '🟢' : '🔴'}
              </span>
              <span className="toggle-text">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/profile')}
              className="profile-btn"
            >
              👤
            </motion.button>
          </div>
        </div>
      </div>

      {/* Mapa */}
      <div className="map-section">
        <DeliveryMap
          deliveryLocation={currentOrder?.customerLocation}
          customerLocation={currentLocation || undefined}
          showRoute={!!currentOrder}
          isDelivering={currentOrder?.status === 'delivering'}
          onLocationUpdate={() => {}}
        />
      </div>

      {/* Painel de estatísticas */}
      <div className="stats-panel">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <div className="stat-value">R$ {stats.todayEarnings.toFixed(2)}</div>
              <div className="stat-label">Ganho Hoje</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📦</div>
            <div className="stat-content">
              <div className="stat-value">{stats.todayDeliveries}</div>
              <div className="stat-label">Entregas Hoje</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🛵</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalDistance.toFixed(1)} km</div>
              <div className="stat-label">Distância Total</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">⭐</div>
            <div className="stat-content">
              <div className="stat-value">{stats.averageRating.toFixed(1)}</div>
              <div className="stat-label">Avaliação Média</div>
            </div>
          </div>
        </div>
      </div>

      {/* Painel de pedidos */}
      <AnimatePresence>
        {currentOrder && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="order-panel"
          >
            <div className="order-header">
              <div className="order-title">
                <h2>📦 Novo Pedido</h2>
                <span className="order-id">#{currentOrder.id}</span>
              </div>
              
              <div className="order-amount">
                <span className="amount-label">Ganho:</span>
                <span className="amount-value">R$ {currentOrder.earnings.toFixed(2)}</span>
              </div>
            </div>

            <div className="order-details">
              <div className="customer-info">
                <h3>👤 Cliente</h3>
                <p className="customer-name">{currentOrder.customerName}</p>
                <p className="customer-address">{currentOrder.customerAddress}</p>
              </div>
              
              <div className="order-info">
                <h3>📋 Pedido</h3>
                <ul className="items-list">
                  {currentOrder.items.map((item, index) => (
                    <li key={index} className="item">• {item}</li>
                  ))}
                </ul>
                <div className="order-summary">
                  <div className="summary-item">
                    <span>Distância:</span>
                    <span>{currentOrder.distance.toFixed(1)} km</span>
                  </div>
                  <div className="summary-item">
                    <span>Tempo estimado:</span>
                    <span>{currentOrder.estimatedTime} min</span>
                  </div>
                  <div className="summary-item total">
                    <span>Valor total:</span>
                    <span>R$ {currentOrder.totalValue.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-actions">
              {currentOrder.status === 'pending' && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={acceptOrder}
                    className="accept-btn"
                  >
                    ✅ Aceitar Pedido
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={rejectOrder}
                    className="reject-btn"
                  >
                    ❌ Rejeitar
                  </motion.button>
                </>
              )}
              
              {currentOrder.status === 'accepted' && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startDelivery}
                  className="start-delivery-btn"
                >
                  🚀 Iniciar Entrega
                </motion.button>
              )}
              
              {currentOrder.status === 'delivering' && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={completeDelivery}
                  className="complete-btn"
                >
                  ✅ Concluir Entrega
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mensagem quando não há pedidos */}
      {!currentOrder && isOnline && (
        <div className="no-orders">
          <div className="no-orders-content">
            <div className="no-orders-icon">📱</div>
            <h3>Aguardando Pedidos</h3>
            <p>Você está online e pronto para receber entregas!</p>
            <div className="status-indicators">
              <div className="indicator">
                <div className="indicator-dot online"></div>
                <span>GPS Ativo</span>
              </div>
              <div className="indicator">
                <div className="indicator-dot online"></div>
                <span>Conectado</span>
              </div>
              {isRural && (
                <div className="indicator">
                  <div className="indicator-dot warning"></div>
                  <span>Zona Rural</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mensagem quando offline */}
      {!currentOrder && !isOnline && (
        <div className="offline-message">
          <div className="offline-content">
            <div className="offline-icon">🔴</div>
            <h3>Você está Offline</h3>
            <p>Toque no botão "Online" para começar a receber pedidos</p>
          </div>
        </div>
      )}
    </div>
  );
};