import { useCallback, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import {
  InlineMetric,
  Section,
  SectionHeader,
  SectionNote,
  StatusDot,
} from '@/components/ui/primitives.jsx';
import {
  ErrorState,
  ForbiddenState,
  SkeletonRows,
  StaleBanner,
} from '@/components/ui/states.jsx';
import { useApiResource } from '@/hooks/useApiResource.js';
import { endpoints } from '@/lib/api.js';
import { useAuth } from '@/auth/AuthContext.jsx';
import {
  HealthStatus,
  SERVICE_DEFS,
  healthMeta,
  isAdmin,
  normalizeHealth,
  overallHealth,
} from '@/lib/domain.js';
import { formatRelative } from '@/lib/format.js';
import { cn } from '@/lib/utils.js';

/** Genel duruş — tek satır, açıklama cümlesi yok. */
const OVERALL_LABEL = {
  [HealthStatus.HEALTHY]: 'Tüm sistemler çalışıyor',
  [HealthStatus.DEGRADED]: 'Sistem bozulmuş durumda',
  [HealthStatus.UNHEALTHY]: 'Sistem hizmet dışı',
  [HealthStatus.UNKNOWN]: 'Durum belirlenemedi',
};

const EDGE = {
  [HealthStatus.HEALTHY]: 'border-l-ok',
  [HealthStatus.DEGRADED]: 'border-l-warn',
  [HealthStatus.UNHEALTHY]: 'border-l-critical',
  [HealthStatus.UNKNOWN]: 'border-l-idle',
};

const FIGURE = {
  [HealthStatus.HEALTHY]: 'text-fg',
  [HealthStatus.DEGRADED]: 'text-warn-fg',
  [HealthStatus.UNHEALTHY]: 'text-critical-fg',
  [HealthStatus.UNKNOWN]: 'text-fg-muted',
};

const DOT_TONE = {
  [HealthStatus.HEALTHY]: 'ok',
  [HealthStatus.DEGRADED]: 'warn',
  [HealthStatus.UNHEALTHY]: 'critical',
  [HealthStatus.UNKNOWN]: 'idle',
};

/**
 * Sistem sağlığı — yalnızca Yönetici.
 *
 * Veri: GET /api/system/health → { postgreSql, redis, rabbitMq }
 * Backend sağlıklıysa 200, biri hatalıysa 503 döndürür; gövde her iki
 * durumda da geçerlidir.
 */
export function HealthPage() {
  const { role } = useAuth();
  const admin = isAdmin(role);

  const health = useApiResource(
    useCallback((token, signal) => endpoints.systemHealth(token, signal), []),
    { enabled: admin, refreshInterval: 15_000 }
  );

  const services = useMemo(() => {
    if (!health.data) return [];
    return SERVICE_DEFS.map((def) => ({
      ...def,
      status: normalizeHealth(health.data[def.field]),
    }));
  }, [health.data]);

  const overall = overallHealth(services);
  const healthyCount = services.filter((s) => s.status === HealthStatus.HEALTHY).length;

  if (!admin) return <ForbiddenState message="Yönetici rolü gerekir" />;

  if (health.isLoading && health.data === null) return <SkeletonRows rows={3} />;

  if (health.data === null && health.isError) {
    return <ErrorState error={health.error} onRetry={health.retry} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Genel sistem durumu"
        className={cn(
          'flex flex-wrap items-center gap-x-6 gap-y-4 rounded-md border border-line border-l-2 bg-surface px-5 py-3',
          EDGE[overall]
        )}
      >
        <div className="flex items-baseline gap-3">
          <span className={cn('text-3xl font-semibold leading-none tnum', FIGURE[overall])}>
            {healthyCount}
            <span className="text-lg font-medium text-fg-subtle">/{services.length}</span>
          </span>
          <span className="text-sm text-fg-secondary">{OVERALL_LABEL[overall]}</span>
        </div>

        <div className="flex items-baseline border-line-strong pl-6 md:border-l">
          <InlineMetric
            value={health.httpStatus ?? '—'}
            label="HTTP"
            tone={health.httpStatus === 503 ? 'critical' : 'muted'}
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          {health.lastUpdatedAt && (
            <span className="font-mono text-2xs text-fg-subtle">
              {formatRelative(health.lastUpdatedAt)}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={health.refresh}
            loading={health.isRefreshing}
            aria-label="Şimdi kontrol et"
          >
            {!health.isRefreshing && <RefreshCw />}
          </Button>
        </div>
      </section>

      {health.isError && health.data !== null && (
        <StaleBanner error={health.error} onRetry={health.retry} />
      )}

      <Section className={health.isRefreshing ? 'opacity-60 transition-opacity' : undefined}>
        <SectionHeader title="Bağımlı servisler" />
        {/* Hizalanmış ad → durum. İzleme aracı gibi okunur. */}
        <ul className="flex flex-col">
          {services.map((service) => (
            <li
              key={service.field}
              className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-b-0"
            >
              <span className="text-sm text-fg">{service.name}</span>
              <StatusDot
                tone={DOT_TONE[service.status]}
                label={healthMeta(service.status).label}
              />
            </li>
          ))}
        </ul>
        <SectionNote>
          <code className="font-mono">GET /api/system/health</code> · 15 sn'de bir yenilenir
        </SectionNote>
      </Section>
    </div>
  );
}

export default HealthPage;
