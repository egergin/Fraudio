import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { HOUR_MS, DAY_MS, toMs } from '../dates.js';
import { tr } from '../i18n/tr.js';
import { useRealtimeEvents } from '../realtime.jsx';
import { StateBox, StatusBadge, formatAmount, formatTime } from '../components/ui.jsx';
import { TransactionModal, shortId } from '../components/TransactionModal.jsx';

const ALERT_CAP = 60;

const RANGES = [
  { id: 'all', label: 'Tümü', span: null },
  { id: 'hour', label: 'Son 1 Saat', span: HOUR_MS },
  { id: 'day', label: 'Son 24 Saat', span: DAY_MS },
  { id: 'days3', label: 'Son 3 Gün', span: 3 * DAY_MS },
  { id: 'week', label: 'Son 1 Hafta', span: 7 * DAY_MS },
];

function reasonText(rules) {
  const list = rules ?? [];
  if (list.length === 0) return tr.alerts.reasonNone;
  return list.map((r) => tr.rules[r] ?? r).join(', ');
}

export function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [rule, setRule] = useState('all');
  const [range, setRange] = useState('all');
  const [order, setOrder] = useState('desc');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const data = await api.recentFrauds();
      setAlerts(data.slice(0, ALERT_CAP));
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
  }, [load]);

  useRealtimeEvents(
    useCallback((msg) => {
      if (msg.event !== 'transaction.suspicious') return;
      const item = {
        transactionId: msg.transactionId,
        userId: msg.userId,
        amount: msg.amount,
        city: msg.city,
        status: msg.status,
        triggeredRules: msg.triggeredRules ?? [],
        occurredAt: msg.occurredAt,
      };
      setAlerts((prev) =>
        prev.some((t) => t.transactionId === item.transactionId)
          ? prev
          : [item, ...prev].slice(0, ALERT_CAP),
      );
    }, []),
  );

  const rows = useMemo(() => {
    const now = Date.now();
    const span = RANGES.find((r) => r.id === range)?.span ?? null;
    const cut = span === null ? 0 : now - span;
    const filtered = alerts.filter((t) => {
      const ts = toMs(t.occurredAt);
      if (ts === null || ts < cut) return false;
      if (rule !== 'all' && !(t.triggeredRules ?? []).includes(rule)) return false;
      return true;
    });
    return filtered.sort((a, b) =>
      order === 'desc'
        ? new Date(b.occurredAt) - new Date(a.occurredAt)
        : new Date(a.occurredAt) - new Date(b.occurredAt),
    );
  }, [alerts, rule, range, order]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tr.alerts.title}</h1>
        </div>
      </div>

      {state === 'loading' && <StateBox kind="loading" />}
      {state === 'error' && <StateBox kind="error" onRetry={load}>{error}</StateBox>}

      {state === 'ready' && (
        <section className="card" aria-label={tr.alerts.title}>
          <div className="toolbar" role="group" aria-label="Filtreler">
            <label className="field">
              <span>{tr.alerts.ruleFilter}</span>
              <select className="input" value={rule} onChange={(e) => setRule(e.target.value)}>
                <option value="all">{tr.alerts.allRules}</option>
                <option value="Velocity">{tr.rules.Velocity}</option>
                <option value="Amount">{tr.rules.Amount}</option>
                <option value="Location">{tr.rules.Location}</option>
              </select>
            </label>
            <label className="field">
              <span>{tr.alerts.dateFilter}</span>
              <select className="input" value={range} onChange={(e) => setRange(e.target.value)}>
                {RANGES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{tr.alerts.sort}</span>
              <select className="input" value={order} onChange={(e) => setOrder(e.target.value)}>
                <option value="desc">{tr.alerts.newest}</option>
                <option value="asc">{tr.alerts.oldest}</option>
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
                  <th scope="col">Şüphe Nedeni</th>
                  <th scope="col">{tr.dashboard.colCity}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr
                    key={t.transactionId}
                    className="clickable row-bad"
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
                    <td>{reasonText(t.triggeredRules)}</td>
                    <td>{t.city ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <TransactionModal item={selected} onClose={() => setSelected(null)} />
    </>
  );
}
