import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { HOUR_MS, DAY_MS, toMs } from '../dates.js';
import { tr } from '../i18n/tr.js';
import { useRealtimeEvents } from '../realtime.jsx';
import { StateBox, StatusBadge, formatAmount, formatTime } from '../components/ui.jsx';
import { TransactionModal, shortId } from '../components/TransactionModal.jsx';

const ROW_CAP = 100;
const PAGE_SIZE = 10;

const RANGES = [
  { id: 'all', label: 'Tümü', span: null },
  { id: 'hour', label: 'Son 1 Saat', span: HOUR_MS },
  { id: 'day', label: 'Son 24 Saat', span: DAY_MS },
  { id: 'days3', label: 'Son 3 Gün', span: 3 * DAY_MS },
  { id: 'week', label: 'Son 1 Hafta', span: 7 * DAY_MS },
];

const LIMITS = [5, 10, 20, 50, 100];

export function LiveTransactions() {
  const [rows, setRows] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [range, setRange] = useState('all');
  const [order, setOrder] = useState('desc');
  const [limit, setLimit] = useState(() => {
    const saved = Number(localStorage.getItem('tum-limit'));
    return LIMITS.includes(saved) ? saved : 20;
  });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  
  const limitRef = useRef(limit);
  limitRef.current = limit;

  const load = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const data = await api.recentTransactions({ limit: limitRef.current });
      setRows(data.slice(0, ROW_CAP));
      setPage(0);
      setState('ready');
    } catch (err) {
      setError(err.message);
      setState('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load, limit]);

  function upsert(item) {
    setRows((prev) =>
      (prev.some((t) => t.transactionId === item.transactionId)
        ? [item, ...prev.filter((t) => t.transactionId !== item.transactionId)]
        : [item, ...prev]
      ).slice(0, ROW_CAP),
    );
  }

  useRealtimeEvents(
    useCallback(
      (msg) => {
        if (
          msg.event !== 'transaction.received' &&
          msg.event !== 'transaction.approved' &&
          msg.event !== 'transaction.suspicious'
        ) {
          return;
        }
        upsert({
          transactionId: msg.transactionId,
          userId: msg.userId,
          amount: msg.amount,
          city: msg.city,
          status: msg.event === 'transaction.received' ? 'Received' : msg.status,
          triggeredRules: msg.triggeredRules ?? [],
          occurredAt: msg.occurredAt,
        });
      },
      [],
    ),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    const now = Date.now();
    const span = RANGES.find((r) => r.id === range)?.span ?? null;
    const cut = span === null ? 0 : now - span;
    const out = rows.filter((t) => {
      if (status !== 'all' && t.status !== status) return false;
      const ts = toMs(t.occurredAt);
      if (ts === null || ts < cut) return false;
      if (
        q &&
        !String(t.transactionId).toLocaleLowerCase('tr-TR').includes(q) &&
        !String(t.userId).toLocaleLowerCase('tr-TR').includes(q)
      ) {
        return false;
      }
      return true;
    });
    const sorted = out.sort((a, b) =>
      order === 'desc'
        ? new Date(b.occurredAt) - new Date(a.occurredAt)
        : new Date(a.occurredAt) - new Date(b.occurredAt),
    );
    return sorted.slice(0, limit);
  }, [rows, query, status, range, order, limit]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function resetPage() {
    setPage(0);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tr.live.title}</h1>
        </div>
      </div>

      {state === 'loading' && <StateBox kind="loading" />}
      {state === 'error' && <StateBox kind="error" onRetry={load}>{error}</StateBox>}

      {state === 'ready' && (
        <section className="card" aria-label={tr.live.title}>
          <div className="toolbar" role="group" aria-label="Arama ve filtreler">
            <label className="field grow">
              <input
                className="input"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetPage();
                }}
                placeholder={tr.live.search}
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span>{tr.live.statusFilter}</span>
              <select
                className="input"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  resetPage();
                }}
              >
                <option value="all">{tr.live.allStatuses}</option>
                <option value="Approved">{tr.status.Approved}</option>
                <option value="Suspicious">{tr.status.Suspicious}</option>
              </select>
            </label>
            <label className="field">
              <span>{tr.live.dateFilter}</span>
              <select
                className="input"
                value={range}
                onChange={(e) => {
                  setRange(e.target.value);
                  resetPage();
                }}
              >
                {RANGES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{tr.live.limit}</span>
              <select
                className="input"
                value={limit}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setLimit(v);
                  try {
                    localStorage.setItem('tum-limit', String(v));
                  } catch {
                  }
                  resetPage();
                }}
              >
                {LIMITS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{tr.live.sort}</span>
              <select className="input" value={order} onChange={(e) => setOrder(e.target.value)}>
                <option value="desc">{tr.live.newest}</option>
                <option value="asc">{tr.live.oldest}</option>
              </select>
            </label>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{tr.alerts.txnId}</th>
                  <th scope="col">{tr.dashboard.colTime}</th>
                  <th scope="col">{tr.dashboard.colUser}</th>
                  <th scope="col">{tr.dashboard.colAmount}</th>
                  <th scope="col">{tr.dashboard.colStatus}</th>
                  <th scope="col">{tr.dashboard.colCity}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((t) => (
                  <tr
                    key={t.transactionId}
                    className={`clickable${t.status === 'Suspicious' ? ' row-bad' : ''}`}
                    tabIndex={0}
                    onClick={() => setSelected(t)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelected(t);
                      }
                    }}
                    aria-label={`${t.userId} detayını aç`}
                  >
                    <td className="num" title={t.transactionId}>{shortId(t.transactionId)}</td>
                    <td className="num">{formatTime(t.occurredAt)}</td>
                    <td>{t.userId}</td>
                    <td className="num">{formatAmount(t.amount)}</td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                    <td>{t.city ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pager">
            <span>
              {tr.live.pageOf(safePage + 1, pages, filtered.length)}
            </span>
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {tr.live.prev}
            </button>
            <button
              type="button"
              disabled={safePage >= pages - 1}
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            >
              {tr.live.next}
            </button>
          </div>
        </section>
      )}

      <TransactionModal item={selected} onClose={() => setSelected(null)} />
    </>
  );
}
