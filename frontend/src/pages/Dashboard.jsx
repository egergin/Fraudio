import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import {
  ArrowRightLeft,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  MapPin,
  Percent,
  Siren,
  UserRoundSearch,
  Zap,
} from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { tr } from '../i18n/tr.js';
import { APP_TIME_ZONE, DAY_MS, periodRange, periodSpanMs, toMs, zonedParts } from '../dates.js';
import { amountYScale, countYScale } from '../components/charts.js';
import { useRealtimeEvents } from '../realtime.jsx';
import {
  RuleChips,
  StateBox,
  StatusBadge,
  formatAmount,
  formatTime,
} from '../components/ui.jsx';

Chart.register(...registerables);
Chart.defaults.font.family =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const FEED_CAP = 120;
const ALERT_CAP = 30;
const PAGE_SIZE = 3;

const DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const PERIODS = [
  { id: 'hour', label: 'Son 1 Saat' },
  { id: 'three', label: 'Son 3 Saat' },
  { id: 'day', label: 'Son 24 Saat' },
  { id: 'week', label: 'Son 7 Gün' },
  { id: 'month', label: 'Son 1 Ay' },
];

const PERIOD_SPANS = {
  hour: 3600_000,
  three: 3 * 3600_000,
  day: 24 * 3600_000,
  week: 7 * 24 * 3600_000,
  month: 30 * 24 * 3600_000,
};

function useChart(setup, deps) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = setup(canvas);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, deps);
  return canvasRef;
}

const RULE_META = {
  Velocity: { icon: Zap, tone: 'amber', title: 'Hız' },
  Amount: { icon: Percent, tone: 'blue', title: 'Tutar' },
  Location: { icon: MapPin, tone: 'green', title: 'Konum' },
};

export function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dakika önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}

function initials(name) {
  const clean = String(name ?? '').replace(/[^A-Za-z0-9]+/g, ' ').trim();
  const parts = clean.split(/\s+/);
  const letters = parts.map((p) => p.replace(/[^A-Za-z0-9]/g, '').slice(0, 1)).join('');
  return (letters || '?').slice(0, 2).toUpperCase();
}

function avatarColor(name) {
  const palette = ['#2b62d9', '#0e9f6e', '#9333ea', '#b54708', '#0369a1', '#be123c'];
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) % 997;
  return palette[h % palette.length];
}

function lira0(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `₺${n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
}

function Kpi({ icon: Icon, tone, value, label }) {
  return (
    <div className="card kpi" role="listitem">
      <span className={`kpi-ico ${tone}`} aria-hidden="true">
        <Icon size={38} strokeWidth={1.6} />
      </span>
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}

export function Dashboard() {
  const { username } = useAuth();
  const [feed, setFeed] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('day');
  const [filterOpen, setFilterOpen] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const [showValues, setShowValues] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [trend, setTrend] = useState({ labels: [], totals: [], titles: [] });
  const [volume, setVolume] = useState({ labels: [], cur: [], prev: [], titles: [] });
  
  const periodRef = useRef(period);
  periodRef.current = period;
  
  function rangeFor(id) {
    const range = periodRange(id);
    const span = periodSpanMs(id) ?? DAY_MS;
    const nowIso = new Date().toISOString();
    const fromIso = range.from ?? new Date(Date.parse(nowIso) - span).toISOString();
    const gran = span <= DAY_MS ? 'hour' : 'day';
    const prevFrom = new Date(Date.parse(fromIso) - span).toISOString();
    return { range: { from: fromIso, to: nowIso }, gran, prevRange: { from: prevFrom, to: fromIso } };
  }

  function labelsFor(points, gran) {
    return points.map((p) => {
      const ts = Date.parse(p.start);
      const z = zonedParts(ts);
      if (gran === 'hour') {
        return `${String(z.hours).padStart(2, '0')}:00`;
      }
      return `${DAYS_SHORT[z.dayIdx]} ${z.date}`;
    });
  }

  function titlesFor(points, gran) {
    return points.map((p) => {
      const d = new Date(p.start);
      const date = d.toLocaleString('tr-TR', { timeZone: APP_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' });
      if (gran === 'hour') {
        return `${date} ${String(zonedParts(Date.parse(p.start)).hours).padStart(2, '0')}:00`;
      }
      return date;
    });
  }
  
  async function fetchAll() {
    const id = periodRef.current;
    const { range, gran, prevRange } = rangeFor(id);
    const [frauds, recent, summaryData, curPoints, prevPoints] = await Promise.all([
      api.recentFrauds(),
      api.recentTransactions(),
      api.dashboardSummary(range),
      api.dashboardSeries({ ...range, granularity: gran, timeZone: APP_TIME_ZONE }),
      api.dashboardSeries({ ...prevRange, granularity: gran, timeZone: APP_TIME_ZONE }),
    ]);
    const merged = new Map();
    for (const t of [...recent, ...frauds]) {
      if (t && t.transactionId && !merged.has(t.transactionId)) {
        merged.set(t.transactionId, t);
      }
    }
    return {
      alerts: frauds.slice(0, ALERT_CAP),
      feed: [...merged.values()]
        .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
        .slice(0, FEED_CAP),
      summary: summaryData,
      trend: {
        labels: labelsFor(curPoints, gran),
        totals: curPoints.map((p) => p.total),
        titles: titlesFor(curPoints, gran),
      },
      volume: {
        labels: labelsFor(curPoints, gran),
        cur: curPoints.map((p) => p.volume),
        prev: prevPoints.map((p) => p.volume),
        titles: titlesFor(curPoints, gran),
      },
    };
  }

  const load = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const data = await fetchAll();
      setAlerts(data.alerts);
      setFeed(data.feed);
      setSummary(data.summary);
      setTrend(data.trend);
      setVolume(data.volume);
      setState('ready');
    } catch (err) {
      setError(err.message);
      setState('error');
    }
  }, []);

  const refreshQuiet = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError('');
    try {
      const data = await fetchAll();
      setAlerts(data.alerts);
      setFeed(data.feed);
      setSummary(data.summary);
      setTrend(data.trend);
      setVolume(data.volume);
    } catch {
      setRefreshError('Yenileme başarısız');
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);
  
  useEffect(() => {
    if (state !== 'ready') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAll();
        if (cancelled) return;
        setAlerts(data.alerts);
        setFeed(data.feed);
        setSummary(data.summary);
        setTrend(data.trend);
        setVolume(data.volume);
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period, state]);

  useRealtimeEvents(
    useCallback((msg) => {
      if (msg.event === 'transaction.received') {
        setFeed((prev) =>
          [
            {
              transactionId: msg.transactionId,
              userId: msg.userId,
              amount: msg.amount,
              city: msg.city,
              status: 'Received',
              triggeredRules: [],
              occurredAt: msg.occurredAt,
            },
            ...prev,
          ].slice(0, FEED_CAP),
        );
      } else if (msg.event === 'transaction.approved' || msg.event === 'transaction.suspicious') {
        const item = {
          transactionId: msg.transactionId,
          userId: msg.userId,
          amount: msg.amount,
          city: msg.city,
          status: msg.status,
          triggeredRules: msg.triggeredRules ?? [],
          occurredAt: msg.occurredAt,
        };
        setFeed((prev) =>
          [item, ...prev.filter((t) => t.transactionId !== item.transactionId)].slice(0, FEED_CAP),
        );
        if (msg.event === 'transaction.suspicious') {
          setAlerts((prev) => [item, ...prev].slice(0, ALERT_CAP));
          setPage(0);
        }
        refreshQuiet();
      }
    }, [period, refreshQuiet]),
  );
  
  const visible = useMemo(() => {
    const span = PERIOD_SPANS[period] ?? 24 * 3600_000;
    const cut = Date.now() - span;
    return feed.filter((t) => {
      const ts = toMs(t.occurredAt);
      return ts !== null && ts >= cut;
    });
  }, [feed, period]);
  
  const stats = useMemo(() => {
    if (!summary) {
      return { total: 0, susp: 0, rate: 0, suspUsers: 0, volRate: 0, userRate: 0 };
    }
    const total = summary.totalTransactions;
    const susp = summary.suspiciousTransactions;
    return {
      total,
      susp,
      rate: total === 0 ? 0 : Math.round((susp / total) * 100),
      suspUsers: summary.suspiciousUsers,
      volRate:
        summary.totalVolume === 0
          ? 0
          : Math.round((summary.suspiciousVolume / summary.totalVolume) * 100),
      userRate:
        summary.totalUsers === 0
          ? 0
          : Math.round((summary.suspiciousUsers / summary.totalUsers) * 100),
    };
  }, [summary]);

  const trendRef = useChart(
    (canvas) =>
      new Chart(canvas, {
        type: 'line',
        data: {
          labels: trend.labels,
          datasets: [
            {
              data: trend.totals,
              borderColor: '#2d9cdb',
              backgroundColor: 'rgba(45,156,219,0.16)',
              fill: true,
              tension: 0.45,
              pointRadius: 0,
              pointHoverRadius: 5,
              borderWidth: 2.5,
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
              callbacks: {
                title: (items) => (items.length ? trend.titles[items[0].dataIndex] ?? '' : ''),
                label: (item) => ` İşlem Sayısı: ${item.parsed.y}`,
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: countYScale(Math.max(0, ...trend.totals)),
          },
        },
      }),
    [trend.labels.join('|'), trend.totals.join(','), state],
  );

  const volumeRef = useChart(
    (canvas) =>
      new Chart(canvas, {
        type: 'line',
        data: {
          labels: volume.labels,
          datasets: [
            {
              label: tr.dashboard.thisPeriod,
              data: volume.cur,
              borderColor: '#2e9beb',
              tension: 0.45,
              pointRadius: 0,
              pointHoverRadius: 5,
              borderWidth: 2.5,
            },
            {
              label: tr.dashboard.prevPeriod,
              data: volume.prev,
              borderColor: '#f4504c',
              tension: 0.45,
              pointRadius: 0,
              pointHoverRadius: 5,
              borderWidth: 2.5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', align: 'end', labels: { usePointStyle: true, pointStyle: 'circle' } },
            tooltip: {
              callbacks: {
                title: (items) => (items.length ? volume.titles[items[0].dataIndex] ?? '' : ''),
                label: (item) => ` ${item.dataset.label}: ${formatAmount(item.parsed.y)}`,
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: amountYScale(Math.max(0, ...volume.cur, ...volume.prev), (v) =>
              `₺${Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
            ),
          },
        },
      }),
    [volume.cur.join(','), volume.prev.join(','), state],
  );

  function clampPct(v) {
    return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;
  }

  function donut(canvas, value, color, track) {
    const v = clampPct(value);
    return new Chart(canvas, {
      type: 'doughnut',
      data: { datasets: [{ data: [v, 100 - v], backgroundColor: [color, track], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: false },
    });
  }
  const donutVolRef = useChart(
    (c) => donut(c, stats.volRate, '#f4504c', '#fde7e6'),
    [stats.volRate, showChart, state],
  );
  const donutCountRef = useChart(
    (c) => donut(c, stats.rate, '#1fb867', '#d9f2e5'),
    [stats.rate, showChart, state],
  );
  const donutUserRef = useChart(
    (c) => donut(c, stats.userRate, '#2e9beb', '#e3f2fd'),
    [stats.userRate, showChart, state],
  );

  const recent = useMemo(() => [...visible].slice(0, 2), [visible]);
  const pages = Math.max(1, Math.ceil(alerts.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const pageAlerts = alerts.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const periodLabel = PERIODS.find((p) => p.id === period)?.label ?? '';

  function saveReport() {
    const rows = [
      ['transactionId', 'userId', 'amount', 'city', 'status', 'triggeredRules', 'occurredAt'],
      ...visible.map((t) => [
        t.transactionId,
        t.userId,
        t.amount,
        t.city ?? '',
        t.status,
        (t.triggeredRules ?? []).join('|'),
        t.occurredAt,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fraudio-rapor.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tr.dashboard.title}</h1>
          <p>{tr.dashboard.greeting(username)}</p>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            className="filter-card"
            type="button"
            aria-haspopup="listbox"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((v) => !v)}
          >
            <span className="filter-ico" aria-hidden="true">
              <CalendarDays size={24} />
            </span>
            <span>
              <strong>Filtrele</strong>
              <small>{periodLabel}</small>
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </button>
          {filterOpen && (
            <div className="filter-menu" role="listbox" aria-label="Döneme göre filtrele">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={period === p.id}
                  aria-pressed={period === p.id}
                  onClick={() => {
                    setPeriod(p.id);
                    setFilterOpen(false);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {state === 'loading' && <StateBox kind="loading" />}
      {state === 'error' && <StateBox kind="error" onRetry={load}>{error}</StateBox>}

      {state === 'ready' && (
        <>
          <div className="kpi-grid" role="list" aria-label="Temel göstergeler">
            <Kpi icon={ArrowRightLeft} tone="mint" value={stats.total} label={tr.dashboard.kpiTotal} />
            <Kpi icon={Siren} tone="red" value={stats.susp} label={tr.dashboard.kpiSuspicious} />
            <Kpi icon={Percent} tone="red" value={`%${stats.rate}`} label={tr.dashboard.kpiRate} />
            <Kpi icon={UserRoundSearch} tone="red" value={stats.suspUsers} label={tr.dashboard.kpiUsers} />
          </div>

          <div className="grid-2">
            <section className="card" aria-labelledby="pasta">
              <div className="card-head">
                <h2 id="pasta">{tr.dashboard.donutTitle}</h2>
                <div className="card-tools">
                  <label className="checkline">
                    <input type="checkbox" checked={showChart} onChange={(e) => setShowChart(e.target.checked)} />
                    {tr.dashboard.showChart}
                  </label>
                  <label className="checkline">
                    <input type="checkbox" checked={showValues} onChange={(e) => setShowValues(e.target.checked)} />
                    {tr.dashboard.showValues}
                  </label>
                  <div className="kebab-wrap">
                    <button
                      className="icon-btn"
                      type="button"
                      aria-label={tr.dashboard.menuOpen}
                      aria-expanded={menuOpen}
                      onClick={() => setMenuOpen((v) => !v)}
                    >
                      ⋮
                    </button>
                    {menuOpen && (
                      <div className="kebab-menu" role="menu">
                        <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); refreshQuiet(); }}>
                          {tr.dashboard.refresh}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {(refreshing || refreshError) && (
                  <p className={`refresh-note${refreshError ? ' error' : ''}`} role="status">
                    {refreshError || 'Yenileniyor…'}
                  </p>
                )}
              </div>
              {showChart ? (
                <div className="donut-trio">
                  {[
                    { ref: donutVolRef, value: stats.volRate, t: tr.dashboard.donutVolume, s: tr.dashboard.donutVolumeSub },
                    { ref: donutCountRef, value: stats.rate, t: tr.dashboard.donutCount, s: tr.dashboard.donutCountSub },
                    { ref: donutUserRef, value: stats.userRate, t: tr.dashboard.donutUsers, s: tr.dashboard.donutUsersSub },
                  ].map((d) => (
                    <div className="donut-cell" key={d.t}>
                      <div className="donut-wrap">
                        <canvas ref={d.ref} role="img" aria-label={`${d.t} %${d.value}`} />
                        {showValues && (
                          <div className="donut-center" aria-hidden="true">
                            <strong>%{d.value}</strong>
                          </div>
                        )}
                      </div>
                      <p>
                        {d.t}
                        <br />
                        {d.s}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mini-stats">
                  {[
                    { value: stats.volRate, color: '#f4504c', t: tr.dashboard.donutVolume, s: tr.dashboard.donutVolumeSub },
                    { value: stats.rate, color: '#1fb867', t: tr.dashboard.donutCount, s: tr.dashboard.donutCountSub },
                    { value: stats.userRate, color: '#2e9beb', t: tr.dashboard.donutUsers, s: tr.dashboard.donutUsersSub },
                  ].map((d) => (
                    <div className="mini-stat" key={d.t}>
                      <svg width="52" height="52" viewBox="0 0 52 52" role="img" aria-label={`${d.t} %${d.value}`}>
                        <circle cx="26" cy="26" r="21" fill="none" stroke="#edf0f5" strokeWidth="7" />
                        <circle
                          cx="26"
                          cy="26"
                          r="21"
                          fill="none"
                          stroke={d.color}
                          strokeWidth="7"
                          strokeLinecap="round"
                          strokeDasharray={`${(clampPct(d.value) / 100) * 131.9} 131.9`}
                          transform="rotate(-90 26 26)"
                        />
                      </svg>
                      <span>
                        <strong>%{d.value}</strong>
                        <small>{d.t}<br />{d.s}</small>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card" aria-labelledby="islem-grafigi">
              <div className="card-head">
                <div>
                  <h2 id="islem-grafigi">{tr.dashboard.trendTitle}</h2>
                  <p className="sub">{tr.dashboard.trendSub}</p>
                </div>
                <button className="btn-outline-blue btn" type="button" onClick={saveReport}>
                  <Download size={16} aria-hidden="true" />
                  {tr.dashboard.saveReport}
                </button>
              </div>
              <div className="chart-box">
                <canvas ref={trendRef} role="img" aria-label={tr.dashboard.trendTitle} />
              </div>
            </section>
          </div>

          <div className="grid-2b">
            <section className="card" aria-labelledby="hacim">
              <div className="card-head">
                <h2 id="hacim">{tr.dashboard.volumeTitle}</h2>
              </div>
              <div className="chart-box">
                <canvas ref={volumeRef} role="img" aria-label={tr.dashboard.volumeTitle} />
              </div>
            </section>

            <section className="card" aria-labelledby="son-islemler">
              <div className="card-head">
                <h2 id="son-islemler">{tr.dashboard.recentTitle}</h2>
              </div>
              {recent.length > 0 && (
                <div className="panel-stack">
                  {recent.map((t) => (
                    <article
                      key={t.transactionId}
                      className={`txn-panel ${t.status === 'Suspicious' ? 'bad' : 'ok'}`}
                      aria-label={`${t.userId} ${t.status}`}
                    >
                      <div className="row">
                        <span className="avatar-sm" aria-hidden="true">
                          {initials(t.userId)}
                        </span>
                        <Link
                          to={`/users/${encodeURIComponent(t.userId)}`}
                          className="pill"
                          style={{ textDecoration: 'none' }}
                        >
                          {t.userId}
                        </Link>
                      </div>
                      <div className="row">
                        <span className="pill">{lira0(t.amount)}</span>
                        <span className="pill">{t.city}</span>
                        <span className="pill">{formatTime(t.occurredAt)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="section-head" id="uyarilar" tabIndex={-1}>
            <div>
              <h2>{tr.dashboard.alertsTitle}</h2>
              <p>{tr.dashboard.alertsSub}</p>
            </div>
            <div className="carousel-btns" role="group" aria-label="Uyarı sayfaları">
              <button
                type="button"
                aria-label={tr.dashboard.prevPage}
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={tr.dashboard.nextPage}
                disabled={safePage >= pages - 1}
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              >
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="alert-cards" id="canli-akisi" aria-live="polite">
            {pageAlerts.map((t) => (
              <article className="card alert-card" key={t.transactionId} aria-label={`${t.userId} uyarısı`}>
                <div className="who">
                  <span
                    className="avatar-lg"
                    style={{ background: avatarColor(t.userId), color: '#fff' }}
                    aria-hidden="true"
                  >
                    {initials(t.userId)}
                  </span>
                  <span className="who-text">
                    <strong className="who-name">
                      <Link to={`/users/${encodeURIComponent(t.userId)}`}>{t.userId}</Link>
                    </strong>
                    <span className="who-time">{timeAgo(t.occurredAt)}</span>
                  </span>
                </div>
                <h3>{tr.dashboard.suspiciousCases}</h3>
                <ul className="rule-items">
                  {(t.triggeredRules ?? []).map((r) => {
                    const meta = RULE_META[r] ?? { icon: Zap, tone: 'amber', title: r };
                    const Icon = meta.icon;
                    return (
                      <li key={r} className="rule-item">
                        <span className={`rule-ico ${meta.tone}`} aria-hidden="true">
                          <Icon size={17} />
                        </span>
                        <span>
                          <strong>{meta.title}</strong>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
