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
ChartJS.defaults.color = '#6b7482';

const GRID = 'rgba(255, 255, 255, 0.045)';

/**
 * Şüpheli işlem yoğunluğu — saat aralıklarına göre gruplanır.
 *
 * Veri kaynağı: /api/frauds/recent (son 20 şüpheli işlem). Tam bir geçmiş
 * serisi değildir; backend toplu zaman serisi uç noktası sunmaz. Bu yüzden
 * kompakt bir yoğunluk şeridi olarak sunulur, "trend grafiği" olarak değil.
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
            backgroundColor: 'rgba(251, 113, 133, 0.4)',
            hoverBackgroundColor: 'rgba(251, 113, 133, 0.75)',
            borderColor: '#fb7185',
            borderWidth: { top: 1.5, right: 0, bottom: 0, left: 0 },
            borderRadius: 0,
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
            backgroundColor: '#14181e',
            borderColor: '#252a33',
            borderWidth: 1,
            titleColor: '#e9edf3',
            bodyColor: '#9ba5b4',
            padding: 9,
            cornerRadius: 4,
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
            border: { color: '#252a33' },
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
    <div className="chart chart--sm">
      <Bar data={data} options={options} aria-label="Saatlik şüpheli işlem dağılımı grafiği" />
    </div>
  );
}

export default FraudTrendChart;
