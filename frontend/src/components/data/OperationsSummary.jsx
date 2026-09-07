import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { InlineMetric, StatusDot } from '@/components/ui/primitives.jsx';
import { ConnectionState } from '@/hooks/useLiveStream.js';
import { HealthStatus, healthMeta } from '@/lib/domain.js';
import { formatRelative } from '@/lib/format.js';
import { cn } from '@/lib/utils.js';

/**
 * Operasyonel özet şeridi.
 *
 * KPI kartı yok. Tek satır: solda tek baskın sayı — analistin "şimdi ne
 * yapmalıyım?" sorusunun cevabı — sağında onu niteleyen satır içi metrikler
 * ve altyapı durumu.
 *
 * Sakin durumda arayüz nötr kalır; renk yalnızca gerçekten bir şey olduğunda
 * devreye girer.
 */

/** Baskın sayı, en yüksek önceliğe sahip gerçeği yansıtır. */
function derivePosture({ criticalCount, suspiciousCount, health }) {
  if (criticalCount > 0) {
    return { tone: 'critical', value: criticalCount, label: 'kritik uyarı' };
  }
  if (suspiciousCount > 0) {
    return { tone: 'warn', value: suspiciousCount, label: 'şüpheli işlem' };
  }
  if (health === HealthStatus.UNHEALTHY || health === HealthStatus.DEGRADED) {
    return { tone: 'warn', value: 0, label: 'şüpheli işlem' };
  }
  return { tone: 'ok', value: 0, label: 'şüpheli işlem' };
}

const EDGE = {
  ok: 'border-l-ok',
  warn: 'border-l-warn',
  critical: 'border-l-critical',
};

const FIGURE = {
  ok: 'text-fg',
  warn: 'text-warn-fg',
  critical: 'text-critical-fg',
};

export function OperationsSummary({
  health,
  criticalCount,
  suspiciousCount,
  sessionEvents,
  sessionSuspicious,
  connection,
  lastUpdatedAt,
  onRefresh,
  isRefreshing,
}) {
  const posture = derivePosture({ criticalCount, suspiciousCount, health });
  const connected = connection === ConnectionState.CONNECTED;

  return (
    <section
      aria-label="Operasyon durumu"
      className={cn(
        'flex flex-wrap items-center gap-x-6 gap-y-4 rounded-md border border-line border-l-2 bg-surface px-5 py-3',
        EDGE[posture.tone]
      )}
    >
      {/* Baskın sayı: sayfadaki en büyük tipografik öğe */}
      <div className="flex items-baseline gap-3">
        <span className={cn('text-3xl font-semibold tnum leading-none', FIGURE[posture.tone])}>
          {posture.value}
        </span>
        <span className="text-sm text-fg-secondary">{posture.label}</span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 border-line-strong pl-6 md:border-l">
        {criticalCount > 0 && suspiciousCount > criticalCount && (
          <InlineMetric value={suspiciousCount} label="şüpheli toplam" tone="warn" />
        )}
        <InlineMetric value={sessionEvents} label="oturum olayı" tone="live" />
        {sessionSuspicious > 0 && (
          <InlineMetric value={sessionSuspicious} label="oturumda şüpheli" tone="warn" />
        )}
      </div>

      <div className="ml-auto flex items-center gap-4">
        <StatusDot
          tone={connected ? 'live' : 'idle'}
          label={connected ? 'Canlı' : 'Bağlı değil'}
          pulse={connected}
        />
        {health !== HealthStatus.UNKNOWN && (
          <StatusDot
            tone={
              health === HealthStatus.HEALTHY
                ? 'ok'
                : health === HealthStatus.DEGRADED
                  ? 'warn'
                  : 'critical'
            }
            label={health === HealthStatus.HEALTHY ? 'Servisler' : healthMeta(health).label}
          />
        )}

        {lastUpdatedAt && (
          <span className="hidden font-mono text-2xs text-fg-subtle sm:inline">
            {formatRelative(lastUpdatedAt)}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRefresh}
          loading={isRefreshing}
          aria-label="Yenile"
        >
          {!isRefreshing && <RefreshCw />}
        </Button>
      </div>
    </section>
  );
}

export default OperationsSummary;
