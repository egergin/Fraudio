import { Button, InlineMetric, StatusDot } from '../ui/primitives.jsx';
import { ConnectionState } from '../../hooks/useLiveStream.js';
import { HealthStatus, healthMeta } from '../../lib/domain.js';
import { formatRelative } from '../../lib/format.js';

/**
 * Operasyon şeridi.
 *
 * Dört KPI kartı değil: tek satır. Solda tek bir baskın sayı — analistin
 * "şimdi ne yapmalıyım?" sorusunun cevabı. Sağda onu niteleyen ince metrikler.
 *
 * Sayı ne kadar kritikse renk o kadar güçlü; sakin durumda arayüz nötr kalır.
 */

/** Baskın sayı ve tonu, en yüksek önceliğe sahip gerçeği yansıtır. */
function derivePosture({ health, criticalCount, suspiciousCount }) {
  if (criticalCount > 0) {
    return { tone: 'danger', value: criticalCount, label: 'kritik uyarı' };
  }
  if (suspiciousCount > 0) {
    return { tone: 'warn', value: suspiciousCount, label: 'şüpheli işlem' };
  }
  if (health === HealthStatus.UNHEALTHY || health === HealthStatus.DEGRADED) {
    return { tone: 'warn', value: 0, label: 'şüpheli işlem' };
  }
  return { tone: 'ok', value: 0, label: 'şüpheli işlem' };
}

export function OperationsBar({
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
  const posture = derivePosture({ health, criticalCount, suspiciousCount });
  const connected = connection === ConnectionState.CONNECTED;

  return (
    <section className="opsbar" data-tone={posture.tone} aria-label="Operasyon durumu">
      <div className="opsbar__lead">
        <span className="opsbar__figure">{posture.value}</span>
        <span className="opsbar__figure-label">{posture.label}</span>
      </div>

      <div className="opsbar__metrics">
        {criticalCount > 0 && suspiciousCount > criticalCount && (
          <InlineMetric value={suspiciousCount} label="şüpheli toplam" tone="warn" />
        )}
        <InlineMetric value={sessionEvents} label="oturum olayı" tone="accent" />
        {sessionSuspicious > 0 && (
          <InlineMetric value={sessionSuspicious} label="oturumda şüpheli" tone="warn" />
        )}
      </div>

      <div className="opsbar__status">
        <StatusDot
          status={connected ? 'healthy' : 'unknown'}
          label={connected ? 'Canlı' : 'Bağlı değil'}
          pulse={connected}
        />
        {health !== HealthStatus.UNKNOWN && (
          <StatusDot
            status={health}
            label={
              health === HealthStatus.HEALTHY ? 'Servisler' : healthMeta(health).label
            }
          />
        )}
      </div>

      <div className="opsbar__actions">
        {lastUpdatedAt && (
          <span className="opsbar__stamp mono">{formatRelative(lastUpdatedAt)}</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon="refresh"
          onClick={onRefresh}
          loading={isRefreshing}
          aria-label="Yenile"
        />
      </div>
    </section>
  );
}

export default OperationsBar;
