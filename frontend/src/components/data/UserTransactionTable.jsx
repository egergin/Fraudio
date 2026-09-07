import { useIsCompact } from '@/hooks/useMediaQuery.js';
import { SeverityBar } from '@/components/ui/primitives.jsx';
import { RuleTags } from '@/components/ui/data-bits.jsx';
import { severityOf, statusMeta } from '@/lib/domain.js';
import {
  formatCurrency,
  formatDateTime,
  formatLocation,
  formatRelative,
} from '@/lib/format.js';
import { cn } from '@/lib/utils.js';

/**
 * Bir kullanıcının işlem geçmişi.
 *
 * Kuyruktan farkı: kullanıcı sütunu yoktur (zaten bağlam), buna karşılık
 * durum sütunu vardır — burada onaylı ve şüpheli işlemler bir arada listelenir.
 */

const STATUS_TONE = {
  suspicious: 'text-critical-fg',
  approved: 'text-ok-fg',
  received: 'text-info-fg',
};

export function UserTransactionTable({ rows }) {
  const compact = useIsCompact();

  if (compact) {
    return (
      <div className="flex flex-col">
        {rows.map((row) => {
          const severity = severityOf(row.triggeredRules, row.status);
          const key = String(row.status).toLowerCase();
          return (
            <div
              key={row.transactionId ?? row.id}
              className="flex items-stretch gap-3 border-b border-line py-2.5"
            >
              <SeverityBar severity={severity} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className={cn('text-xs', STATUS_TONE[key] ?? 'text-fg-secondary')}>
                    {statusMeta(row.status).label}
                  </span>
                  <span className="font-mono text-sm font-semibold tnum text-fg">
                    {formatCurrency(row.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-2xs text-fg-muted">
                    {formatLocation(row.city, row.country)}
                  </span>
                  <span className="shrink-0 font-mono text-2xs text-fg-subtle">
                    {formatRelative(row.occurredAt)}
                  </span>
                </div>
                <RuleTags rules={row.triggeredRules} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Kullanıcının son işlemleri</caption>
        <thead>
          <tr className="border-b border-line-strong">
            <th scope="col" className="w-0.5 p-0">
              <span className="sr-only">Şiddet</span>
            </th>
            {['Durum', 'Tutar', 'Konum', 'Kurallar', 'Zaman'].map((h, i) => (
              <th
                key={h}
                scope="col"
                className={cn(
                  'whitespace-nowrap px-3 py-2 text-3xs font-semibold uppercase tracking-[0.08em] text-fg-subtle',
                  i === 1 || i === 4 ? 'text-right' : 'text-left'
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const severity = severityOf(row.triggeredRules, row.status);
            const key = String(row.status).toLowerCase();
            return (
              <tr key={row.transactionId ?? row.id} className="border-b border-line">
                <td className="p-0">
                  <div className="flex h-full min-h-[30px] items-stretch">
                    <SeverityBar severity={severity} />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={cn('text-xs', STATUS_TONE[key] ?? 'text-fg-secondary')}>
                    {statusMeta(row.status).label}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={cn(
                      'font-mono text-sm font-semibold tnum',
                      key === 'suspicious' ? 'text-critical-fg' : 'text-fg'
                    )}
                  >
                    {formatCurrency(row.amount)}
                  </span>
                </td>
                <td className="max-w-[180px] truncate px-3 py-2 text-fg-secondary">
                  {formatLocation(row.city, row.country)}
                </td>
                <td className="px-3 py-2">
                  <RuleTags rules={row.triggeredRules} />
                </td>
                <td className="px-3 py-2 text-right">
                  <span
                    className="font-mono text-2xs text-fg-muted"
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
  );
}

export default UserTransactionTable;
