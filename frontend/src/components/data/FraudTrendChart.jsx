import { useMemo } from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { formatCurrency, formatShortTime, toDate } from '../../lib/format.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip
);

ChartJS.defaults.font.family = "'Inter', system-ui, sans-serif";
ChartJS.defaults.font.size = 11;
ChartJS.defaults.color = '#6e7889';

const GRID = 'rgba(255, 255, 255, 0.045)';

/**
 * Şüpheli işlem yoğunluğu — saat aralıklarına göre gruplanır.
 *
 * Veri kaynağı: /api/frauds/recent (son 20 şüpheli işlem).
 * Bu bir tam geçmiş serisi DEĞİLDİR; backend toplu zaman serisi uç noktası
 * sunmaz. Bu sınır, panel altyazısında kullanıcıya açıkça belirtilir.
 */
export function FraudTrendChart({ frauds }) {
  const { data, options, isEmpty } = useMemo(() => {
    const dated = frauds
      .map((fraud) => ({ ...fraud, date: toDate(fraud.occurredAt) }))
      .filter((fraud) => fraud.date)
      .sort((a, b) => a.date - b.date);

    if (dated.length === 0) {
      return { isEmpty: true, data: null, options: null };
    }

    // Saat başına gruplama — tek işlem varsa bile anlamlı bir kova oluşur.
    const buckets = new Map();
    dated.forEach((fraud) => {
      const bucket = new Date(fraud.date);
      bucket.setMinutes(0, 0, 0);
      const key = bucket.getTime();
      const existing = buckets.get(key) ?? { count: 0, amount: 0, time: bucket };
      existing.count += 1;
      existing.amount += Number(fraud.amount) || 0;
      buckets.set(key, existing);
    });

    const ordered = [...buckets.values()].sort((a, b) => a.time - b.time);

    return {
      isEmpty: false,
      data: {
        labels: ordered.map((bucket) => formatShortTime(bucket.time)),
        datasets: [
          {
            label: 'Şüpheli işlem',
            data: ordered.map((bucket) => bucket.count),
            backgroundColor: 'rgba(248, 113, 113, 0.55)',
            hoverBackgroundColor: 'rgba(248, 113, 113, 0.85)',
            borderColor: '#f87171',
            borderWidth: { top: 2, right: 0, bottom: 0, left: 0 },
            borderRadius: 2,
            barThickness: 'flex',
            maxBarThickness: 30,
            // Tutar toplamını ipucu içinde göstermek için taşırız.
            _amounts: ordered.map((bucket) => bucket.amount),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0d1015',
            borderColor: '#242935',
            borderWidth: 1,
            titleColor: '#e8ecf3',
            bodyColor: '#a3adbe',
            padding: 10,
            cornerRadius: 6,
            displayColors: false,
            titleFont: { weight: '600', size: 12 },
            callbacks: {
              title: (items) => `${items[0].label} saat aralığı`,
              label: (item) => {
                const total = ordered[item.dataIndex]?.amount ?? 0;
                return [
                  `${item.parsed.y} şüpheli işlem`,
                  `Toplam ${formatCurrency(total)}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: '#242935' },
            ticks: { maxRotation: 0, autoSkipPadding: 12 },
          },
          y: {
            beginAtZero: true,
            grid: { color: GRID },
            border: { display: false },
            ticks: {
              precision: 0,
              maxTicksLimit: 5,
              font: { family: "'JetBrains Mono', monospace", size: 10 },
            },
          },
        },
      },
    };
  }, [frauds]);

  if (isEmpty) return null;

  return (
    <div className="chart chart--md">
      <Bar data={data} options={options} aria-label="Saatlik şüpheli işlem dağılımı grafiği" />
    </div>
  );
}

export default FraudTrendChart;
