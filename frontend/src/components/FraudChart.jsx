import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function FraudChart({ alerts }) {
  const points = [...alerts]
    .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt))
    .slice(-15);

  const labels = points.map((p) =>
    p.occurredAt
      ? new Date(p.occurredAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : ''
  );

  const data = {
    labels: labels.length > 0 ? labels : ['00:00:00'],
    datasets: [
      {
        label: 'Şüpheli İşlem Tutarı (₺)',
        data: points.length > 0 ? points.map((p) => p.amount) : [0],
        borderColor: '#f43f5e',
        backgroundColor: 'rgba(244, 63, 94, 0.1)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#f43f5e',
        pointBorderColor: '#fff',
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#94a3b8',
          font: { family: 'Inter', size: 12 }
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true,
        callbacks: {
          label: (context) => `Şüpheli Tutar: ₺${Number(context.parsed.y || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: {
          color: '#64748b',
          font: { family: 'JetBrains Mono', size: 11 },
          callback: (value) => `₺${value}`
        }
      }
    }
  };

  return (
    <div className="glass-card" style={{ height: '340px' }}>
      <div className="card-title">
        <span>Şüpheli İşlem Trendi</span>
      </div>
      <div style={{ height: '260px', position: 'relative' }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
