import React from 'react';

interface DesktopMetricsProps {
  metrics: {
    totalHoje: number;
    pendentes: number;
    preparando: number;
    prontos: number;
    faturamentoHoje: number;
  };
  isMobile: boolean;
}

const DesktopMetrics: React.FC<DesktopMetricsProps> = ({ metrics, isMobile }) => {
  const MetricCard = ({ 
    title, 
    value, 
    icon, 
    color, 
    trend 
  }: { 
    title: string; 
    value: string | number; 
    icon: string; 
    color: string;
    trend?: { value: number; isPositive: boolean };
  }) => (
    <div className={`${color} rounded-2xl p-6 shadow-lg transform hover:scale-105 transition-all duration-200`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/80 text-sm font-medium">{title}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-white font-bold text-2xl mb-1">{value}</div>
      {trend && (
        <div className={`text-xs font-medium ${
          trend.isPositive ? 'text-green-200' : 'text-red-200'
        }`}>
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% vs ontem
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          title="Pedidos Hoje"
          value={metrics.totalHoje}
          icon="📦"
          color="bg-gradient-to-r from-blue-600 to-blue-700"
        />
        <MetricCard
          title="Faturamento"
          value={`R$ ${metrics.faturamentoHoje.toFixed(2)}`}
          icon="💰"
          color="bg-gradient-to-r from-green-600 to-green-700"
        />
        <MetricCard
          title="Pendentes"
          value={metrics.pendentes}
          icon="⏰"
          color="bg-gradient-to-r from-yellow-600 to-yellow-700"
        />
        <MetricCard
          title="Em Preparo"
          value={metrics.preparando}
          icon="👨‍🍳"
          color="bg-gradient-to-r from-orange-600 to-orange-700"
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      <MetricCard
        title="Pedidos Hoje"
        value={metrics.totalHoje}
        icon="📦"
        color="bg-gradient-to-r from-blue-600 to-blue-700"
        trend={{ value: 12, isPositive: true }}
      />
      
      <MetricCard
        title="Faturamento Hoje"
        value={`R$ ${metrics.faturamentoHoje.toFixed(2)}`}
        icon="💰"
        color="bg-gradient-to-r from-green-600 to-green-700"
        trend={{ value: 8, isPositive: true }}
      />
      
      <MetricCard
        title="Pendentes"
        value={metrics.pendentes}
        icon="⏰"
        color="bg-gradient-to-r from-yellow-600 to-yellow-700"
      />
      
      <MetricCard
        title="Em Preparo"
        value={metrics.preparando}
        icon="👨‍🍳"
        color="bg-gradient-to-r from-orange-600 to-orange-700"
      />
      
      <MetricCard
        title="Prontos"
        value={metrics.prontos}
        icon="🚀"
        color="bg-gradient-to-r from-purple-600 to-purple-700"
      />
    </div>
  );
};

export default DesktopMetrics;
