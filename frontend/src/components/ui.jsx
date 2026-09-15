import { ruleName, statusName, tr } from '../i18n/tr.js';
import { APP_TIME_ZONE } from '../dates.js';

export function StatusBadge({ status }) {
  const tone = status === 'Suspicious' ? 'bad' : status === 'Approved' ? 'ok' : 'info';
  return <span className={`badge ${tone}`}>{statusName(status)}</span>;
}

export function HealthBadge({ state }) {
  const tone = state === 'Healthy' ? 'ok' : state === 'Degraded' ? 'warn' : 'bad';
  return <span className={`badge ${tone}`}>{statusName(state)}</span>;
}

export function RuleChips({ rules }) {
  const list = rules ?? [];
  if (list.length === 0) return <span>{tr.dashboard.rulesNone}</span>;
  return (
    <span>
      {list.map((r) => (
        <span key={r} className="rule-chip">
          {ruleName(r)}
        </span>
      ))}
    </span>
  );
}

export function StateBox({ kind, children, onRetry }) {
  if (kind === 'loading') return <p className="state-box" role="status">{tr.common.loading}</p>;
  if (kind === 'error')
    return (
      <div className="state-box" role="alert">
        <p>{children || tr.common.error}</p>
        {onRetry && (
          <button className="btn-ghost btn" type="button" onClick={onRetry}>
            {tr.common.retry}
          </button>
        )}
      </div>
    );
  return <p className="state-box">{children}</p>;
}

export function formatAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso ?? '');
  return d.toLocaleString('tr-TR', { timeZone: APP_TIME_ZONE });
}