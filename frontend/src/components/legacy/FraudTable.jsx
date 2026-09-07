import { Link } from 'react-router-dom';
import { useIsCompact } from '../../hooks/useMediaQuery.js';
import {
  CopyableId,
  RuleChips,
  SeverityBar,
  StatusBadge,
} from './primitives.jsx';
import { severityOf } from '../../lib/domain.js';
import {
  formatCurrency,
  formatDateTime,
  formatLocation,
  formatRelative,
} from '../../lib/format.js';

/**
 * Şüpheli işlem tablosu.
 *
 * Yalnızca /api/frauds/recent yanıtındaki alanları gösterir:
 *   transactionId, userId, amount, city, status, occurredAt, triggeredRules
 *
 * Mobilde tablo, yığılmış listeye dönüşür (yatay kaydırma zorunluluğu yok).
 */
export function FraudTable({ rows, onInspect, showUser = true }) {
  const compact = useIsCompact();

  // Mobilde yığılmış kartlar: tabloyu CSS ile gizlemek yerine hiç render
  // etmiyoruz; aksi hâlde aynı içerik DOM'da iki kez bulunur.
  if (compact) {
    return (
      <div className="stacked-list" style={{ display: 'flex' }}>
        {rows.map((row) => {
          const severity = severityOf(row.triggeredRules, row.status);
          return (
            <button
              type="button"
              key={row.transactionId}
              className="stacked-item"
              onClick={() => onInspect(row)}
            >
              <div className="stacked-item__top">
                <span className="row" style={{ gap: 'var(--sp-2)' }}>
                  <SeverityBar severity={severity} />
                  {showUser && (
                    <span className="mono truncate" style={{ fontSize: 'var(--text-xs)' }}>
                      {row.userId}
                    </span>
                  )}
                </span>
                <span className="mono table__amount" data-sev={severity}>
                  {formatCurrency(row.amount)}
                </span>
              </div>
              <div className="stacked-item__bottom">
                <RuleChips rules={row.triggeredRules} />
                <span className="mono table__cell-muted" style={{ fontSize: 'var(--text-2xs)' }}>
                  {formatLocation(row.city, row.country)} · {formatRelative(row.occurredAt)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {/* Masaüstü / tablet: yoğun tablo */}
      <div className="table-scroll">
        <table className="table">
          <caption className="visually-hidden">
            Şüpheli işlemler; şiddet, kullanıcı, tutar, konum ve tetiklenen kurallar
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 3 }}>
                <span className="visually-hidden">Şiddet</span>
              </th>
              {showUser && <th scope="col">Kullanıcı</th>}
              <th scope="col" className="is-numeric">
                Tutar
              </th>
              <th scope="col">Konum</th>
              <th scope="col">Tetiklenen kurallar</th>
              <th scope="col">Zaman</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const severity = severityOf(row.triggeredRules, row.status);
              return (
                <tr
                  key={row.transactionId}
                  data-interactive="true"
                  tabIndex={0}
                  role="button"
                  aria-label={`${row.userId} kullanıcısının ${formatCurrency(row.amount)} tutarındaki işlemini incele`}
                  onClick={() => onInspect(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onInspect(row);
                    }
                  }}
                >
                  <td className="table__sev">
                    <SeverityBar severity={severity} />
                  </td>
                  {showUser && (
                    <td>
                      <Link
                        to={`/users/${encodeURIComponent(row.userId)}`}
                        className="entity-link"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {row.userId}
                      </Link>
                    </td>
                  )}
                  <td className="is-numeric mono table__amount" data-sev={severity}>
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="truncate" style={{ maxWidth: 160 }}>
                    {formatLocation(row.city, row.country)}
                  </td>
                  <td>
                    <RuleChips rules={row.triggeredRules} />
                  </td>
                  <td>
                    <span
                      className="mono table__cell-muted"
                      title={formatDateTime(row.occurredAt)}
                    >
                      {formatRelative(row.occurredAt)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </>
  );
}

/**
 * Kullanıcı işlem geçmişi tablosu.
 * /api/transaction-users/{id}/transactions alanlarını gösterir.
 */
export function UserTransactionTable({ rows }) {
  return (
    <div className="table-scroll">
      <table className="table">
        <caption className="visually-hidden">Kullanıcının son işlemleri</caption>
        <thead>
          <tr>
            <th scope="col" style={{ width: 30 }}>
              <span className="visually-hidden">Şiddet</span>
            </th>
            <th scope="col">Durum</th>
            <th scope="col" className="is-numeric">
              Tutar
            </th>
            <th scope="col">Konum</th>
            <th scope="col">Kurallar</th>
            <th scope="col">Zaman</th>
            <th scope="col">İşlem kimliği</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const severity = severityOf(row.triggeredRules, row.status);
            return (
              <tr key={row.transactionId}>
                <td className="table__sev">
                  <SeverityBar severity={severity} />
                </td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td className="is-numeric mono table__amount" data-sev={severity}>
                  {formatCurrency(row.amount)}
                </td>
                <td className="truncate" style={{ maxWidth: 150 }}>
                  {formatLocation(row.city, row.country)}
                </td>
                <td>
                  <RuleChips rules={row.triggeredRules} />
                </td>
                <td>
                  <span className="mono table__cell-muted" title={formatDateTime(row.occurredAt)}>
                    {formatRelative(row.occurredAt)}
                  </span>
                </td>
                <td>
                  <CopyableId value={row.transactionId} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default FraudTable;
