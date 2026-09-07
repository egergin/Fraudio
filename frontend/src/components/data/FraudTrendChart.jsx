import { useMemo } from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { formatCurrency, formatShortTime, toDate } from '@/lib/format.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

ChartJS.defaults.font.family = "'Inter', system-ui, sans-serif";
ChartJS.defaults.font.size = 10;
ChartJS.defaults.color = '#6b7280';

/**
 * Saatlik şüpheli işlem yoğunluğu.
 *
 * Kaynak: /api/frauds/recent (son 20 kayıt). Bu bir tam zaman serisi
 * DEĞİLDİR — backend toplu seri uç noktası sunmaz. Bu yüzden "trend" değil
 * "yoğunluk" olarak adlandırılır ve kompakt tutulur. Veri uydurulmaz.
 *
 * Grafik dekorasyonu asgaride: eksen çizgisi yok, yatay ızgara neredeyse
 * görünmez, gölge/gradyan yok.
 */
export function FraudTrendChart({ frauds }) {
  const { data, options, isEmpty } = useMemo(() => {
    const dated = frauds
      .map((f) => ({ ...f, date: toDate(f.occurredAt) }))
      .filter((f) => f.date)
      .sort((a, b) => a.date - b.date);

    if (dated.length === 0) return { isEmpty: true, data: null, options: null };

    // Saat başına gruplama.
    const buckets = new Map();
    dated.forEach((f) => {
      const bucket = new Date(f.date);
      bucket.setMinutes(0, 0, 0);
      const key = bucket.getTime();
      const existing = buckets.get(key) ?? { count: 0, amount: 0, time: bucket };
      existing.count += 1;
      existing.amount += Number(f.amount) || 0;
      buckets.set(key, existing);
    });

    const ordered = [...buckets.values()].sort((a, b) => a.time - b.time);

    return {
      isEmpty: false,
      data: {
        labels: ordered.map((b) => formatShortTime(b.time)),
        datasets: [
          {
            data: ordered.map((b) => b.count),
            backgroundColor: 'rgba(251, 113, 133, 0.32)',
            hoverBackgroundColor: 'rgba(251, 113, 133, 0.6)',
            borderColor: '#fb7185',
            borderWidth: { top: 1.5, right: 0, bottom: 0, left: 0 },
            borderRadius: 0,
            maxBarThickness: 28,
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
            backgroundColor: '#14171b',
            borderColor: '#2a2f37',
            borderWidth: 1,
            titleColor: '#e8ebf0',
            bodyColor: '#9aa4b2',
            padding: 8,
            cornerRadius: 4,
            displayColors: false,
            titleFont: { weight: '600', size: 11 },
            bodyFont: { size: 11 },
            callbacks: {
              title: (items) => items[0].label,
              label: (item) => [
                `${item.parsed.y} şüpheli işlem`,
                formatCurrency(ordered[item.dataIndex]?.amount ?? 0),
              ],
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { maxRotation: 0, autoSkipPadding: 16 },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.035)' },
            border: { display: false },
            ticks: { precision: 0, maxTicksLimit: 4 },
          },
        },
      },
    };
  }, [frauds]);

  if (isEmpty) return null;

  return (
    <div className="h-[132px] pt-3">
      <Bar data={data} options={options} aria-label="Saatlik şüpheli işlem yoğunluğu" />
    </div>
  );
}

export default FraudTrendChart;
