import { useCallback, useMemo } from 'react';
import Icon from '../components/ui/Icon.jsx';
import {
  Button,
  HealthBadge,
  Notice,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
} from '../components/ui/primitives.jsx';
import { ErrorState, ForbiddenState, SkeletonList } from '../components/ui/states.jsx';
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
import { formatDateTime, formatRelative } from '../lib/format.js';

const SERVICE_ICON = {
  postgreSql: 'database',
  redis: 'server',
  rabbitMq: 'queue',
};

/** Genel duruşa göre başlık metni. */
const OVERALL_COPY = {
  [HealthStatus.HEALTHY]: {
    tone: 'ok',
    glyph: 'checkCircle',
    headline: 'Tüm sistemler çalışıyor',
    detail: 'İzlenen üç bağımlılık da sağlık kontrolüne başarıyla yanıt veriyor.',
  },
  [HealthStatus.DEGRADED]: {
    tone: 'warn',
    glyph: 'warning',
    headline: 'Sistem bozulmuş durumda',
    detail: 'Bağımlılıkların bir kısmı yanıt vermiyor. İşlem işleme etkilenebilir.',
  },
  [HealthStatus.UNHEALTHY]: {
    tone: 'danger',
    glyph: 'xCircle',
    headline: 'Sistem hizmet dışı',
    detail: 'İzlenen bağımlılıkların tümü yanıt vermiyor. İşlem alımı durmuş olabilir.',
  },
  [HealthStatus.UNKNOWN]: {
    tone: 'unknown',
    glyph: 'info',
    headline: 'Durum belirlenemedi',
    detail: 'Sağlık kontrolü henüz tamamlanmadı veya yanıt yorumlanamadı.',
  },
};

/**
 * Sistem sağlığı sayfası — yalnızca Yönetici.
 *
 * Veri: GET /api/system/health → { postgreSql, redis, rabbitMq }
 * Backend sağlıklıysa 200, herhangi biri hatalıysa 503 döndürür; her iki
 * durumda da gövde aynıdır ve geçerli sayılır.
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
  const copy = OVERALL_COPY[overall];
  const degradedCount = services.filter(
    (service) => service.status !== HealthStatus.HEALTHY
  ).length;

  // Rol tabanlı engelleme — sayfa Admin dışına hiç açılmaz.
  if (!admin) {
    return (
      <div className="page page--narrow">
        <header className="page-header">
          <div className="page-header__text">
            <h1 className="page-header__title">
              <Icon name="health" size={20} />
              Sistem sağlığı
            </h1>
          </div>
        </header>
        <Panel>
          <ForbiddenState message="Sistem sağlığı uç noktası yalnızca Yönetici rolüne sahip kullanıcılar tarafından çağrılabilir. Analist rolüyle bu bilgiye erişilemez." />
        </Panel>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">
            <Icon name="health" size={20} />
            Sistem sağlığı
          </h1>
          <p className="page-header__desc">
            Fraudio'nun çalışması için gereken altyapı bağımlılıklarının canlı durumu.
            Her 15 saniyede bir otomatik olarak yenilenir.
          </p>
        </div>
        <div className="page-header__actions">
          <Button
            icon="refresh"
            onClick={health.refresh}
            loading={health.isRefreshing}
          >
            Şimdi kontrol et
          </Button>
        </div>
      </header>

      {/* İlk yükleme */}
      {health.isLoading && health.data === null ? (
        <Panel>
          <PanelBody flush>
            <SkeletonList rows={3} />
          </PanelBody>
        </Panel>
      ) : health.data === null && health.isError ? (
        <Panel>
          <ErrorState error={health.error} onRetry={health.retry} />
        </Panel>
      ) : (
        <>
          {/* Genel duruş */}
          <section className="opsbar" data-posture={copy.tone} aria-label="Genel sistem durumu">
            <div className="opsbar__cell opsbar__cell--primary">
              <span className="opsbar__label">Genel Durum</span>
              <div className="posture" data-posture={copy.tone}>
                <span className="posture__glyph">
                  <Icon name={copy.glyph} size={16} />
                </span>
                <span className="posture__text">
                  <span className="posture__headline">{copy.headline}</span>
                  <span className="posture__detail">{copy.detail}</span>
                </span>
              </div>
            </div>

            <div className="opsbar__cell">
              <span className="opsbar__label">Sağlıklı Servis</span>
              <span className="opsbar__value">
                {services.length - degradedCount}
                <span className="opsbar__unit">/ {services.length}</span>
              </span>
            </div>

            <div className="opsbar__cell">
              <span className="opsbar__label">HTTP Yanıtı</span>
              <span
                className={`opsbar__value ${
                  health.httpStatus === 503 ? 'opsbar__value--danger' : ''
                }`}
                style={{ fontSize: 'var(--text-lg)' }}
              >
                {health.httpStatus ?? '—'}
              </span>
              <span className="opsbar__note">
                {health.httpStatus === 503
                  ? 'Service Unavailable'
                  : health.httpStatus === 200
                    ? 'OK'
                    : 'Bilinmiyor'}
              </span>
            </div>

            <div className="opsbar__cell">
              <span className="opsbar__label">Son Kontrol</span>
              <span className="opsbar__value" style={{ fontSize: 'var(--text-md)' }}>
                {health.lastUpdatedAt ? formatRelative(health.lastUpdatedAt) : '—'}
              </span>
              <span className="opsbar__note">
                {health.lastUpdatedAt ? formatDateTime(health.lastUpdatedAt) : 'Henüz yok'}
              </span>
            </div>

            <div className="opsbar__cell opsbar__cell--actions">
              {health.isRefreshing && (
                <span className="opsbar__note">Kontrol ediliyor…</span>
              )}
            </div>
          </section>

          {/* Yenileme başarısız olduysa eski veriyi işaretle */}
          {health.isError && health.data !== null && (
            <div className="notice notice--warn" role="status">
              <Icon name="warning" size={13} className="notice__icon" />
              <span style={{ flex: 1 }}>
                Son sağlık kontrolü tamamlanamadı; aşağıdaki durumlar{' '}
                {health.lastUpdatedAt ? formatRelative(health.lastUpdatedAt) : 'daha önce'}{' '}
                alınan sonuçtur.
              </span>
              <Button variant="ghost" size="sm" onClick={health.retry}>
                Yeniden dene
              </Button>
            </div>
          )}

          {/* Servis listesi */}
          <Panel flush className={health.isRefreshing ? 'is-refreshing' : undefined}>
            <PanelHeader
              title="Bağımlı servisler"
              subtitle="Her servis backend tarafından doğrudan yoklanır"
            />
            <div className="svc-list">
              {services.map((service) => (
                <div className="svc" data-status={service.status} key={service.field}>
                  <span className="svc__glyph">
                    <Icon name={SERVICE_ICON[service.field] ?? 'server'} size={15} />
                  </span>
                  <span className="svc__text">
                    <span className="svc__name">{service.name}</span>
                    <span className="svc__role">{service.role}</span>
                  </span>
                  <span
                    className="svc-compact__status"
                    data-status={service.status}
                    style={{ marginRight: 'var(--sp-2)' }}
                  >
                    <span className="dot" aria-hidden="true" />
                  </span>
                  <HealthBadge status={service.status} />
                </div>
              ))}
            </div>
            <PanelFooter>
              <span>
                Kaynak:{' '}
                <code style={{ fontFamily: 'var(--font-mono)' }}>
                  GET /api/system/health
                </code>
              </span>
              <span>
                {overall === HealthStatus.HEALTHY
                  ? 'Tümü sağlıklı'
                  : `${degradedCount} servis dikkat gerektiriyor`}
              </span>
            </PanelFooter>
          </Panel>

          <Notice icon="info">
            Sağlık uç noktası yalnızca üç bağımlılığın erişilebilirliğini bildirir:
            PostgreSQL bağlantısı, Redis ping yanıtı ve RabbitMQ bağlantı durumu. Gecikme,
            kaynak kullanımı veya kuyruk derinliği gibi ölçümler backend tarafından
            sunulmamaktadır.
          </Notice>
        </>
      )}
    </div>
  );
}

export default HealthPage;
