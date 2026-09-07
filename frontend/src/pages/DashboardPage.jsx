import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/ui/Icon.jsx';
import {
  Button,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
} from '../components/ui/primitives.jsx';
import {
  AsyncBoundary,
  EmptyState,
  ForbiddenState,
  SkeletonList,
  SkeletonTable,
  StaleBanner,
} from '../components/ui/states.jsx';
import OperationsBar from '../components/data/OperationsBar.jsx';
import FraudTable from '../components/data/FraudTable.jsx';
import LiveFeed from '../components/data/LiveFeed.jsx';
import FraudTrendChart from '../components/data/FraudTrendChart.jsx';
import RuleBreakdown from '../components/data/RuleBreakdown.jsx';
import InvestigationDrawer from '../components/investigate/InvestigationDrawer.jsx';
import { useApiResource } from '../hooks/useApiResource.js';
import { endpoints } from '../lib/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  HealthStatus,
  SERVICE_DEFS,
  Severity,
  healthMeta,
  isAdmin,
  normalizeHealth,
  overallHealth,
  severityOf,
} from '../lib/domain.js';
import { ConnectionState } from '../hooks/useLiveStream.js';
import { formatRelative } from '../lib/format.js';

/** Yan sütundaki kompakt sağlık özeti. */
function HealthSummaryPanel({ resource, admin }) {
  const services = useMemo(() => {
    if (!resource.data) return [];
    return SERVICE_DEFS.map((def) => ({
      ...def,
      status: normalizeHealth(resource.data[def.field]),
    }));
  }, [resource.data]);

  const overall = overallHealth(services);

  return (
    <Panel flush>
      <PanelHeader
        title="Sistem sağlığı"
        actions={
          admin && (
            <Link to="/health" className="btn btn--ghost btn--sm">
              Ayrıntı
              <Icon name="chevronRight" size={12} />
            </Link>
          )
        }
      />

      {!admin ? (
        <ForbiddenState
          compact
          message="Sistem sağlığı yalnızca Yönetici rolüne açıktır."
        />
      ) : (
        <AsyncBoundary
          resource={resource}
          skeleton={<SkeletonList rows={3} />}
          compact
        >
          {() => (
            <>
              <div
                style={{
                  padding: 'var(--sp-3) var(--sp-4)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <span className={`badge ${healthMeta(overall).badgeClass}`}>
                  {overall === HealthStatus.HEALTHY
                    ? 'Tüm servisler sağlıklı'
                    : healthMeta(overall).label}
                </span>
              </div>
              {services.map((service) => (
                <div className="svc-compact" key={service.field}>
                  <span className="svc-compact__name">
                    <Icon
                      name={
                        service.field === 'postgreSql'
                          ? 'database'
                          : service.field === 'redis'
                            ? 'server'
                            : 'queue'
                      }
                      size={14}
                    />
                    {service.name}
                  </span>
                  <span className="svc-compact__status" data-status={service.status}>
                    <span className="dot" aria-hidden="true" />
                    {healthMeta(service.status).label}
                  </span>
                </div>
              ))}
            </>
          )}
        </AsyncBoundary>
      )}
    </Panel>
  );
}

export function DashboardPage({ live }) {
  const { role } = useAuth();
  const admin = isAdmin(role);
  const [inspected, setInspected] = useState(null);

  // Şüpheli işlemler — otoriter kaynak (son 20 kayıt).
  const frauds = useApiResource(
    useCallback((token, signal) => endpoints.recentFrauds(token, signal), []),
    { refreshInterval: 30_000 }
  );

  // Sağlık — yalnızca Admin çağırır (403 gürültüsü üretmemek için).
  const health = useApiResource(
    useCallback((token, signal) => endpoints.systemHealth(token, signal), []),
    { enabled: admin, refreshInterval: 20_000 }
  );

  const fraudRows = useMemo(
    () => (Array.isArray(frauds.data) ? frauds.data : []),
    [frauds.data]
  );

  /**
   * Şüpheli işlemler şiddete, sonra zamana göre sıralanır.
   * Analistin en kritik kaydı en üstte görmesi gerekir.
   */
  const triaged = useMemo(() => {
    return [...fraudRows].sort((a, b) => {
      const sevA = severityOf(a.triggeredRules, a.status);
      const sevB = severityOf(b.triggeredRules, b.status);
      const rank = { high: 3, medium: 2, low: 1, none: 0 };
      if (rank[sevB] !== rank[sevA]) return rank[sevB] - rank[sevA];
      return new Date(b.occurredAt) - new Date(a.occurredAt);
    });
  }, [fraudRows]);

  const criticalCount = useMemo(
    () =>
      fraudRows.filter(
        (row) => severityOf(row.triggeredRules, row.status) === Severity.HIGH
      ).length,
    [fraudRows]
  );

  const healthStatus = useMemo(() => {
    if (!admin) return HealthStatus.UNKNOWN;
    if (!health.data) return HealthStatus.UNKNOWN;
    return overallHealth(
      SERVICE_DEFS.map((def) => ({ status: normalizeHealth(health.data[def.field]) }))
    );
  }, [admin, health.data]);

  const refreshAll = useCallback(() => {
    frauds.refresh();
    if (admin) health.refresh();
  }, [frauds, admin, health]);

  return (
    <div className="page">
      <OperationsBar
        health={healthStatus}
        criticalCount={criticalCount}
        suspiciousCount={fraudRows.length}
        sessionEvents={live.events.length}
        sessionSuspicious={live.totalSuspicious}
        connection={live.connection}
        lastUpdatedAt={frauds.lastUpdatedAt}
        onRefresh={refreshAll}
        isRefreshing={frauds.isRefreshing || health.isRefreshing}
      />

      {/* Yenileme başarısız olduysa ama eski veri duruyorsa uyar */}
      {frauds.isError && frauds.data !== null && (
        <StaleBanner error={frauds.error} onRetry={frauds.retry} />
      )}

      <div className="grid grid--dashboard">
        {/* Ana sütun: önceliklendirilmiş inceleme kuyruğu + eğilim */}
        <div className="stack">
          <Panel flush>
            <PanelHeader
              title="İnceleme kuyruğu"
              subtitle="Şiddete göre sıralanmış şüpheli işlemler"
              actions={
                <Link to="/alerts" className="btn btn--secondary btn--sm">
                  Tümünü aç
                  <Icon name="arrowRight" size={12} />
                </Link>
              }
            />
            <AsyncBoundary
              resource={frauds}
              isEmpty={triaged.length === 0}
              skeleton={<SkeletonTable rows={6} columns={6} />}
              empty={
                <EmptyState
                  icon="shield"
                  title="Şüpheli işlem yok"
                  message="Kural motoru şu ana kadar iki veya daha fazla ihlal içeren bir işlem işaretlemedi. Yeni olaylar geldiğinde bu liste otomatik güncellenir."
                />
              }
            >
              {() => (
                <FraudTable rows={triaged.slice(0, 8)} onInspect={setInspected} />
              )}
            </AsyncBoundary>

            {triaged.length > 8 && (
              <PanelFooter>
                <span>
                  {triaged.length} kaydın ilk 8'i gösteriliyor
                </span>
                <Link to="/alerts" className="btn btn--ghost btn--sm">
                  Tümünü görüntüle
                </Link>
              </PanelFooter>
            )}
          </Panel>

          {/* Eğilim — yalnızca veri varsa anlamlı */}
          {fraudRows.length > 0 && (
            <Panel>
              <PanelHeader
                title="Şüpheli işlem yoğunluğu"
                subtitle="Saat aralıklarına göre, son 20 kayıt"
              />
              <PanelBody>
                <FraudTrendChart frauds={fraudRows} />
              </PanelBody>
              <PanelFooter>
                <span>
                  Backend toplu zaman serisi sunmaz; grafik yalnızca API'nin döndürdüğü
                  son 20 şüpheli işlemi temsil eder.
                </span>
              </PanelFooter>
            </Panel>
          )}
        </div>

        {/* Yan sütun: sağlık, canlı akış, kural dağılımı */}
        <div className="stack">
          <HealthSummaryPanel resource={health} admin={admin} />

          <Panel flush>
            <PanelHeader
              title="Canlı akış"
              subtitle={
                live.connection === ConnectionState.CONNECTED
                  ? `${live.events.length} olay`
                  : undefined
              }
              actions={
                <Link to="/stream" className="btn btn--ghost btn--sm">
                  Tümü
                  <Icon name="chevronRight" size={12} />
                </Link>
              }
            />
            {live.events.length === 0 ? (
              <EmptyState
                compact
                icon={
                  live.connection === ConnectionState.CONNECTED ? 'pulse' : 'plug'
                }
                title={
                  live.connection === ConnectionState.CONNECTED
                    ? 'Akış bağlı, olay bekleniyor'
                    : 'Canlı akış bağlı değil'
                }
                message={
                  live.connection === ConnectionState.CONNECTED
                    ? 'Yeni bir işlem alındığında burada anında görünecek.'
                    : 'Bağlantı yeniden kurulduğunda olaylar otomatik olarak akmaya başlar.'
                }
                action={
                  live.connection === ConnectionState.DISCONNECTED && (
                    <Button size="sm" icon="refresh" onClick={live.reconnect}>
                      Yeniden bağlan
                    </Button>
                  )
                }
              />
            ) : (
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                <LiveFeed events={live.events} onInspect={setInspected} limit={12} />
              </div>
            )}
            <PanelFooter>
              <span>Oturuma özgü, kalıcı değildir</span>
              {live.lastEventAt && <span>{formatRelative(live.lastEventAt)}</span>}
            </PanelFooter>
          </Panel>

          {fraudRows.length > 0 && (
            <Panel flush>
              <PanelHeader
                title="Kural dağılımı"
                subtitle={`${fraudRows.length} kayıt üzerinden`}
              />
              <RuleBreakdown frauds={fraudRows} />
            </Panel>
          )}
        </div>
      </div>

      <InvestigationDrawer
        transaction={inspected}
        open={Boolean(inspected)}
        onClose={() => setInspected(null)}
      />
    </div>
  );
}

export default DashboardPage;
