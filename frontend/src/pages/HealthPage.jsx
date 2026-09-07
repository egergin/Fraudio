import { useCallback, useMemo } from 'react';
import {
  Button,
  InlineMetric,
  Section,
  SectionHeader,
  StatusDot,
} from '../components/ui/primitives.jsx';
import {
  ErrorState,
  ForbiddenState,
  SkeletonList,
  StaleBanner,
} from '../components/ui/states.jsx';
import { useApiResource } from '../hooks/useApiResource.js';
import { endpoints } from '../lib/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  HealthStatus,
  SERVICE_DEFS,
  healthMeta,
  isAdmin,
  normalizeHealth,
  overallHealth,
} from '../lib/domain.js';
import { formatRelative } from '../lib/format.js';

/** Genel duruş — tek satırlık başlık, açıklama cümlesi yok. */
const OVERALL_LABEL = {
  [HealthStatus.HEALTHY]: 'Tüm sistemler çalışıyor',
  [HealthStatus.DEGRADED]: 'Sistem bozulmuş durumda',
  [HealthStatus.UNHEALTHY]: 'Sistem hizmet dışı',
  [HealthStatus.UNKNOWN]: 'Durum belirlenemedi',
};

const TONE = {
  [HealthStatus.HEALTHY]: 'ok',
  [HealthStatus.DEGRADED]: 'warn',
  [HealthStatus.UNHEALTHY]: 'danger',
  [HealthStatus.UNKNOWN]: 'neutral',
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
  const healthyCount = services.filter(
    (service) => service.status === HealthStatus.HEALTHY
  ).length;

  if (!admin) {
    return (
      <div className="page page--narrow">
        <ForbiddenState message="Sistem sağlığı yalnızca Yönetici rolüne açıktır." />
      </div>
    );
  }

  if (health.isLoading && health.data === null) {
    return (
      <div className="page">
        <SkeletonList rows={3} />
      </div>
    );
  }

  if (health.data === null && health.isError) {
    return (
      <div className="page">
        <ErrorState error={health.error} onRetry={health.retry} />
      </div>
    );
  }

  return (
    <div className="page">
      <section className="opsbar" data-tone={TONE[overall]} aria-label="Genel sistem durumu">
        <div className="opsbar__lead">
          <span className="opsbar__figure">
            {healthyCount}
            <span className="opsbar__figure-of">/{services.length}</span>
          </span>
          <span className="opsbar__figure-label">{OVERALL_LABEL[overall]}</span>
        </div>

        <div className="opsbar__metrics">
          <InlineMetric
            value={health.httpStatus ?? '—'}
            label="HTTP"
            tone={health.httpStatus === 503 ? 'danger' : 'neutral'}
          />
        </div>

        <div className="opsbar__actions">
          {health.lastUpdatedAt && (
            <span className="opsbar__stamp mono">
              {formatRelative(health.lastUpdatedAt)}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon="refresh"
            onClick={health.refresh}
            loading={health.isRefreshing}
            aria-label="Şimdi kontrol et"
          />
        </div>
      </section>

      {health.isError && health.data !== null && (
        <StaleBanner error={health.error} onRetry={health.retry} />
      )}

      <Section className={health.isRefreshing ? 'is-refreshing' : undefined}>
        <SectionHeader title="Bağımlı servisler" />
        <ul className="roster roster--lg">
          {services.map((service) => (
            <li className="roster__row" key={service.field}>
              <span className="roster__name">{service.name}</span>
              <StatusDot
                status={service.status}
                label={healthMeta(service.status).label}
              />
            </li>
          ))}
        </ul>
        <p className="section__note">
          <code>GET /api/system/health</code> · 15 sn'de bir yenilenir
        </p>
      </Section>
    </div>
  );
}

export default HealthPage;
