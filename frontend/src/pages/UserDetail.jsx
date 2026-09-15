import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { tr } from '../i18n/tr.js';
import { BackToDashboard } from '../components/Shell.jsx';
import { RuleChips, StateBox, StatusBadge, formatAmount, formatTime } from '../components/ui.jsx';

export function UserDetail() {
  const { userId } = useParams();
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState('loading');
      setError('');
      try {
        const [d, h] = await Promise.all([api.userDetail(userId), api.userHistory(userId)]);
        if (!cancelled) {
          setDetail(d);
          setHistory(h);
          setState('ready');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setState('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <>
      <p>
        <BackToDashboard />
      </p>
      <div className="page-head">
        <div>
          <h1>{tr.user.title(userId)}</h1>
        </div>
      </div>

      {state === 'loading' && <StateBox kind="loading" />}
      {state === 'error' && (
        <StateBox kind="error" onRetry={() => window.location.reload()}>
          {error}
        </StateBox>
      )}

      {state === 'ready' && detail && (
        <>
          <section className="card" aria-labelledby="ozet">
            <h2 id="ozet">{tr.user.summary}</h2>
            <div className="summary-grid">
              <div className="stat">
                <small>{tr.user.total}</small>
                <strong>{detail.totalTransactions}</strong>
              </div>
              <div className="stat">
                <small>{tr.user.suspicious}</small>
                <strong>{detail.suspiciousTransactions}</strong>
              </div>
              {detail.lastTransaction && (
                <div className="stat">
                  <small>{tr.user.last}</small>
                  <strong className="num">{formatAmount(detail.lastTransaction.amount)}</strong>
                  <div>
                    {detail.lastTransaction.city}{' '}
                    <StatusBadge status={detail.lastTransaction.status} />
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="card" aria-labelledby="gecmis">
            <h2 id="gecmis">{tr.user.history(history.length)}</h2>
            {history.length === 0 ? (
              <p className="state-box">{tr.user.noHistory}</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">{tr.dashboard.colAmount}</th>
                      <th scope="col">{tr.dashboard.colCity}</th>
                      <th scope="col">{tr.dashboard.colStatus}</th>
                      <th scope="col">{tr.dashboard.colRules}</th>
                      <th scope="col">{tr.dashboard.colTime}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((t) => (
                      <tr
                        key={t.transactionId}
                        className={t.status === 'Suspicious' ? 'row-bad' : ''}
                      >
                        <td className="num">{formatAmount(t.amount)}</td>
                        <td>{t.city}</td>
                        <td>
                          <StatusBadge status={t.status} />
                        </td>
                        <td>
                          <RuleChips rules={t.triggeredRules} />
                        </td>
                        <td className="num">{formatTime(t.occurredAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
