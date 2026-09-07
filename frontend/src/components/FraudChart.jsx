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
        label: 'Şüpheli işlem tutarı (₺)',
        data: points.length > 0 ? points.map((p) => p.amount) : [0],
        borderColor: '#f06b62',
        backgroundColor: 'rgba(240, 107, 98, 0.08)',
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointBackgroundColor: '#f06b62',
        pointBorderColor: '#111518',
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#171c20',
        titleColor: '#ecf1ef',
        bodyColor: '#9ba8a9',
        borderColor: '#293136',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true,
        titleFont: { family: 'JetBrains Mono', size: 11 },
        bodyFont: { family: 'JetBrains Mono', size: 11 },
        callbacks: {
          label: (context) => `Tutar: ₺${Number(context.parsed.y || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#687578', font: { family: 'JetBrains Mono', size: 10 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#687578',
          font: { family: 'JetBrains Mono', size: 10 },
          callback: (value) => `₺${value}`
        }
      }
    }
  };

  return (
    <section className="panel panel-chart">
      <div className="panel-heading">
        <div>
          <p className="eyebrow eyebrow-alert">TREND</p>
          <h3>Şüpheli işlem tutarı</h3>
        </div>
        <span className="count-badge">son {points.length || 0} kayıt</span>
      </div>
      <div className="chart-wrap">
        <Line data={data} options={options} />
      </div>
    </section>
  );
}
