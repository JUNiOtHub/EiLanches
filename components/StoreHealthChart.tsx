import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface StoreHealthChartProps {
  rating: number;
}

const StoreHealthChart: React.FC<StoreHealthChartProps> = ({ rating }) => {
  const data = {
    datasets: [
      {
        data: [rating, 5 - rating],
        backgroundColor: ['#FF8C00', '#1E1E1E'],
        borderColor: ['#FF8C00', '#1E1E1E'],
        borderWidth: 1,
        circumference: 180,
        rotation: 270,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
    },
    cutout: '80%',
  };

  return (
    <div className="bg-[#1E1E1E] p-6 rounded-[32px] border border-white/5 shadow-xl">
      <h3 className="text-white font-bold mb-6 text-sm flex items-center">
        <i className="fa-solid fa-heart-pulse text-[#FF8C00] mr-2"></i>
        Saúde da Loja
      </h3>
      <div className="relative h-40 w-full flex items-center justify-center">
        <Doughnut data={data} options={options} />
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-4xl font-black text-[#FF8C00]">{rating.toFixed(1)}</span>
          <span className="text-gray-500 text-xs font-bold">/ 5.0</span>
        </div>
      </div>
    </div>
  );
};

export default StoreHealthChart;
