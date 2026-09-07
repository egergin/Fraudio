import { Link } from 'react-router-dom';
import { useIsCompact } from '@/hooks/useMediaQuery.js';
import { SeverityBar } from '@/components/ui/primitives.jsx';
import { RuleTags } from '@/components/ui/data-bits.jsx';
import { severityOf, severityMeta } from '@/lib/domain.js';
import {
  formatCurrency,
  formatDateTime,
  formatLocation,
  formatRelative,
} from '@/lib/format.js';
import { cn } from '@/lib/utils.js';

/**
 * İnceleme kuyruğu.
 *
 * Yalnızca /api/frauds/recent alanları: transactionId, userId, amount, city,
 * country, status, occurredAt, triggeredRules.
 *
 * Şiddet üç kanaldan aynı anda okunur: sol kenar çubuğu, tutarın rengi ve
 * kural sayısı. Ayrı bir "şiddet rozeti" sütunu yok — satırı rozet duvarına
 * çevirirdi.
 *
 * Dar ekranda tablo yerine yığılmış satırlar render edilir; aynı içeriği
 * CSS ile gizleyip iki kez DOM'a koymak erişilebilirlik hatasıdır.
 */

const AMOUNT_TONE = {
  high: 'text-critical-fg',
  medium: 'text-warn-fg',
  low: 'text-fg',
  none: 'text-fg',
};

export function FraudQueue({ rows, onInspect, showUser = true }) {
  const compact = useIsCompact();

  if (compact) {
    return (
      <div className="flex flex-col">
        {rows.map((row) => {
          const severity = severityOf(row.triggeredRules, row.status);
          return (
            <button
              key={row.transactionId}
              type="button"
              onClick={() => onInspect(row)}
              className="flex items-stretch gap-3 border-b border-line py-2.5 text-left transition-colors hover:bg-hover"
            >
              <SeverityBar severity={severity} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  {showUser && (
                    <span className="truncate font-mono text-xs text-fg">{row.userId}</span>
                  )}
                  <span
                    className={cn('font-mono text-sm font-semibold tnum', AMOUNT_TONE[severity])}
                  >
                    {formatCurrency(row.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <RuleTags rules={row.triggeredRules} />
                  <span className="shrink-0 font-mono text-2xs text-fg-subtle">
                    {formatRelative(row.occurredAt)}
                  </span>
                </div>
                <span className="truncate text-2xs text-fg-muted">
                  {formatLocation(row.city, row.country)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Şüpheli işlemler: şiddet, kullanıcı, tutar, konum, tetiklenen kurallar, zaman
        </caption>
        <thead>
          <tr className="border-b border-line-strong">
            <th scope="col" className="w-0.5 p-0">
              <span className="sr-only">Şiddet</span>
            </th>
            {showUser && <Th>Kullanıcı</Th>}
            <Th align="right">Tutar</Th>
            <Th>Konum</Th>
            <Th>Kurallar</Th>
            <Th align="right">Zaman</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const severity = severityOf(row.triggeredRules, row.status);
            return (
              <tr
                key={row.transactionId}
                tabIndex={0}
                role="button"
                aria-label={`${row.userId} · ${formatCurrency(row.amount)} · ${severityMeta(severity).label} · incele`}
                onClick={() => onInspect(row)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onInspect(row);
                  }
                }}
                className="cursor-pointer border-b border-line transition-colors hover:bg-hover focus-visible:bg-hover"
              >
                <td className="p-0">
                  <div className="flex h-full min-h-[30px] items-stretch">
                    <SeverityBar severity={severity} />
                  </div>
                </td>

                {showUser && (
                  <Td>
                    <Link
                      to={`/users/${encodeURIComponent(row.userId)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono text-xs text-fg underline-offset-2 hover:text-live-fg hover:underline"
                    >
                      {row.userId}
                    </Link>
                  </Td>
                )}

                <Td align="right">
                  <span
                    className={cn('font-mono text-sm font-semibold tnum', AMOUNT_TONE[severity])}
                  >
                    {formatCurrency(row.amount)}
                  </span>
                </Td>

                <Td className="max-w-[180px] truncate text-fg-secondary">
                  {formatLocation(row.city, row.country)}
                </Td>

                <Td>
                  <RuleTags rules={row.triggeredRules} />
                </Td>

                <Td align="right">
                  <span
                    className="font-mono text-2xs text-fg-muted"
                    title={formatDateTime(row.occurredAt)}
                  >
                    {formatRelative(row.occurredAt)}
                  </span>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align = 'left' }) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-3 py-2 text-3xs font-semibold uppercase tracking-[0.08em] text-fg-subtle',
        align === 'right' ? 'text-right' : 'text-left'
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left', className }) {
  return (
    <td
      className={cn(
        'px-3 py-2 align-middle',
        align === 'right' ? 'text-right' : 'text-left',
        className
      )}
    >
      {children}
    </td>
  );
}

export default FraudQueue;
