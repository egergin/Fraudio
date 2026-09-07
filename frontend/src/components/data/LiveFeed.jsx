import { Link } from 'react-router-dom';
import { RuleTags } from '@/components/ui/data-bits.jsx';
import { SeverityBar } from '@/components/ui/primitives.jsx';
import { severityOf } from '@/lib/domain.js';
import {
  formatCurrency,
  formatDateTime,
  formatLocation,
  formatTime,
} from '@/lib/format.js';
import { cn } from '@/lib/utils.js';

/**
 * Canlı olay akışı.
 *
 * Her olay bir kart değil, bir satır. Yeni olay geldiğinde kayma animasyonu
 * yoktur — sol kenarda sönümlenen bir işaret ve kısa bir arka plan parlaması
 * kullanılır; sürekli akan bir listede kayma okumayı bozar.
 *
 * Veriler oturuma özgüdür ve geçmiş toplamı temsil etmez.
 */
export function LiveFeed({ events, onInspect, limit }) {
  const items = typeof limit === 'number' ? events.slice(0, limit) : events;

  return (
    <div role="log" aria-label="Canlı işlem akışı" aria-live="polite" className="flex flex-col">
      {items.map((event) => {
        const severity = severityOf(event.triggeredRules, event.status);
        const suspicious = String(event.status).toLowerCase() === 'suspicious';
        const isNew = event._receivedAt && Date.now() - event._receivedAt < 6000;

        return (
          <button
            key={event.transactionId}
            type="button"
            onClick={() => onInspect?.(event)}
            aria-label={`${event.userId} · ${formatCurrency(event.amount)} · ${event.status}`}
            className={cn(
              'relative flex items-stretch gap-2.5 border-b border-line py-1.5 pl-2 pr-1 text-left',
              'transition-colors hover:bg-hover',
              isNew && 'event-new'
            )}
          >
            <SeverityBar severity={severity} />

            <time
              dateTime={event.occurredAt}
              title={formatDateTime(event.occurredAt)}
              className="shrink-0 self-center font-mono text-2xs tnum text-fg-subtle"
            >
              {formatTime(event.occurredAt)}
            </time>

            <div className="flex min-w-0 flex-1 flex-col gap-0.5 self-center">
              <Link
                to={`/users/${encodeURIComponent(event.userId)}`}
                onClick={(e) => e.stopPropagation()}
                className="truncate font-mono text-2xs text-fg-secondary underline-offset-2 hover:text-live-fg hover:underline"
              >
                {event.userId}
              </Link>
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-2xs text-fg-subtle">
                  {formatLocation(event.city, event.country)}
                </span>
                {Array.isArray(event.triggeredRules) && event.triggeredRules.length > 0 && (
                  <RuleTags rules={event.triggeredRules} />
                )}
              </span>
            </div>

            <span
              className={cn(
                'shrink-0 self-center font-mono text-xs font-semibold tnum',
                suspicious ? 'text-critical-fg' : 'text-fg'
              )}
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
