import React from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const MetricCard: React.FC<{ title: string; value: string | number; icon: string; accentColor: string; subValue?: string; }> = ({ title, value, icon, accentColor, subValue }) => (
    <div className="bg-[#181818] p-6 rounded-2xl border border-white/5 flex items-start gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${accentColor}/20`}>
            <i className={`fa-solid ${icon} ${accentColor} text-xl`}></i>
        </div>
        <div>
            <p className="text-sm text-gray-400 uppercase font-bold tracking-wider">{title}</p>
            <p className="text-3xl font-bold text-white mt-1">{value}</p>
            {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
        </div>
    </div>
);

export const ModernMetrics: React.FC = () => {
    const { metrics } = useDashboard();
    
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { 
          backgroundColor: '#1A1A1A', 
          titleColor: '#fff', 
          bodyColor: '#FF8C00',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (context: any) => `R$ ${context.parsed.y.toFixed(2)}`
          }
        }
      },
      scales: {
        y: { 
          beginAtZero: true, 
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#888', font: { size: 10 }, callback: (value: any) => `R$ ${value}` },
          border: { display: false }
        },
        x: { 
          grid: { display: false },
          ticks: { color: '#AAA', font: { size: 12 } },
          border: { display: false }
        }
      }
    };


    return (
        <div className="h-full flex flex-col gap-8 animate-in fade-in">
             {/* Top Row Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard 
                    title="Faturamento Hoje"
                    value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.faturamentoBrutoHoje)}
                    subValue={`Líquido: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.faturamentoLiquidoHoje)}`}
                    icon="fa-sack-dollar"
                    accentColor="text-green-400"
                />
                 <MetricCard 
                    title="Pedidos Hoje"
                    value={metrics.totalPedidos}
                    icon="fa-receipt"
                    accentColor="text-blue-400"
                />
                 <MetricCard 
                    title="Ticket Médio"
                    value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.ticketMedio)}
                    icon="fa-calculator"
                    accentColor="text-yellow-400"
                />
                 <MetricCard 
                    title="Tempo Médio Preparo"
                    value={`${Math.round(metrics.tempoMedioPreparoMin ?? 0)} min`}
                    icon="fa-clock"
                    accentColor="text-red-400"
                />
            </div>
            
            {/* Charts and Lists */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Weekly Sales Chart */}
                <div className="lg:col-span-2 bg-[#181818] p-6 rounded-2xl border border-white/5">
                    <h3 className="text-base font-bold text-white mb-6">Vendas da Semana</h3>
                    <div className="h-80">
                        <Bar 
                            data={metrics.chartData} 
                            options={chartOptions}
                        />
                    </div>
                </div>

                {/* Best Sellers List */}
                <div className="bg-[#181818] p-6 rounded-2xl border border-white/5">
                    <h3 className="text-base font-bold text-white mb-6">Mais Vendidos</h3>
                    <div className="space-y-4">
                        {metrics.bestSellers?.map((item: any, index: number) => (
                            <div key={index} className="flex justify-between items-center">
                                <span className="text-gray-300 text-sm">{item.name}</span>
                                <span className="font-bold text-white bg-white/5 px-2 py-1 rounded-md text-sm">{item.count}</span>
                            </div>
                        ))}
                         {metrics.bestSellers?.length === 0 && <p className="text-center text-gray-500 text-xs py-10">Sem dados de vendas.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}