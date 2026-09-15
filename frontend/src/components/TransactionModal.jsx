import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { tr } from '../i18n/tr.js';
import { RuleChips, StatusBadge, formatAmount, formatTime } from './ui.jsx';

export function TransactionModal({ item, onClose }) {
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!item) return null;
  const rules = item.triggeredRules ?? [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="txn-detail-title"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 520 }}
      >
        <h2 id="txn-detail-title">{tr.alerts.detailTitle}</h2>
        <p className="sub">
          <StatusBadge status={item.status} />
        </p>

        <div className="detail-grid">
          <section aria-label={tr.alerts.secTxn}>
            <h3>{tr.alerts.secTxn}</h3>
            <dl>
              <dt>{tr.alerts.txnId}</dt>
              <dd>{item.transactionId}</dd>
              <dt>{tr.alerts.date}</dt>
              <dd>{formatTime(item.occurredAt)}</dd>
              <dt>{tr.dashboard.colAmount}</dt>
              <dd>{formatAmount(item.amount)}</dd>
              <dt>{tr.dashboard.colStatus}</dt>
              <dd>
                <StatusBadge status={item.status} />
              </dd>
            </dl>
          </section>

          <section aria-label={tr.alerts.secUser}>
            <h3>{tr.alerts.secUser}</h3>
            <dl>
              <dt>{tr.submit.userId}</dt>
              <dd>
                <Link to={`/users/${encodeURIComponent(item.userId)}`}>{item.userId}</Link>
              </dd>
            </dl>
          </section>

          <section aria-label={tr.alerts.secTech}>
            <h3>{tr.alerts.secTech}</h3>
            <dl>
              <dt>{tr.alerts.city}</dt>
              <dd>{item.city ?? '—'}</dd>
            </dl>
          </section>

          <section aria-label={tr.alerts.secRisk}>
            <h3>{tr.alerts.secRisk}</h3>
            <dl>
              <dt>{tr.alerts.rules}</dt>
              <dd>
                {rules.length === 0 ? tr.alerts.reasonNone : <RuleChips rules={rules} />}
              </dd>
            </dl>
          </section>
        </div>

        <div className="modal-actions">
          <button ref={firstRef} className="btn btn-ghost" type="button" onClick={onClose}>
            {tr.alerts.close}
          </button>
        </div>
      </div>
    </div>
  );
}

export function shortId(id) {
  const s = String(id ?? '');
  return s.length > 13 ? `${s.slice(0, 8)}…` : s;
}
