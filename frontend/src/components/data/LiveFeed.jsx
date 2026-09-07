import { Link } from 'react-router-dom';
import { RuleChips, StatusBadge } from '../ui/primitives.jsx';
import { severityOf } from '../../lib/domain.js';
import {
  formatCurrency,
  formatDateTime,
  formatLocation,
  formatTime,
} from '../../lib/format.js';

/**
 * Canlı olay akışı — WebSocket'ten gelen geçici olaylar.
 *
 * Önemli: buradaki veriler oturuma özgü, geçicidir ve geçmiş toplamı temsil
 * etmez. Bu ayrım UI metinlerinde açıkça belirtilir.
 */
export function LiveFeed({ events, onInspect, limit }) {
  const items = typeof limit === 'number' ? events.slice(0, limit) : events;

  return (
    <div className="feed" role="log" aria-label="Canlı işlem akışı" aria-live="polite">
      {items.map((event) => {
        const severity = severityOf(event.triggeredRules, event.status);
        const isSuspicious = String(event.status).toLowerCase() === 'suspicious';
        // Son 6 saniye içinde gelen olaylar giriş animasyonu alır.
        const isNew = event._receivedAt && Date.now() - event._receivedAt < 6000;

        return (
          <button
            type="button"
            key={event.transactionId}
            className={`feed__item ${isNew ? 'feed__item--new' : ''}`}
            onClick={() => onInspect?.(event)}
            aria-label={`${event.userId} · ${formatCurrency(event.amount)} · ${event.status}`}
          >
            <span
              className="sev-bar"
              data-sev={severity}
              style={{ height: 22 }}
              aria-hidden="true"
            />

            <time
              className="feed__time"
              dateTime={event.occurredAt}
              title={formatDateTime(event.occurredAt)}
            >
              {formatTime(event.occurredAt)}
            </time>

            <span className="feed__body">
              <span className="feed__primary">
                <Link
                  to={`/users/${encodeURIComponent(event.userId)}`}
                  className="entity-link truncate"
                  onClick={(clickEvent) => clickEvent.stopPropagation()}
                >
                  {event.userId}
                </Link>
                <StatusBadge status={event.status} />
              </span>
              <span className="feed__secondary truncate">
                {formatLocation(event.city, event.country)}
                {Array.isArray(event.triggeredRules) && event.triggeredRules.length > 0 && (
                  <RuleChips rules={event.triggeredRules} />
                )}
              </span>
            </span>

            <span
              className={`feed__amount ${isSuspicious ? 'feed__amount--danger' : ''}`}
            >
              {formatCurrency(event.amount)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default LiveFeed;
