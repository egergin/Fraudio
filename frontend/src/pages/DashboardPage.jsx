import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Section,
  SectionHeader,
  StatusDot,
} from '../components/ui/primitives.jsx';
import {
  AsyncBoundary,
  EmptyState,
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

/**
 * Genel bakış.
 *
 * Kompozisyon bilinçli olarak asimetriktir: inceleme kuyruğu sayfanın
 * ağırlığını taşır, canlı akış ve sağlık onu destekleyen dar bir sütunda
 * kalır. Hiçbir bölüm kart içinde değildir; ayrım başlık kuralı ve
 * boşlukla kurulur.
 */

/** Sağlık: hizalanmış ad + durum listesi. Kart yok, rozet yok. */
function HealthRoster({ resource, admin }) {
  if (!admin) {
    return <p className="section__note">Yönetici rolü gerekir</p>;
  }

  return (
    <AsyncBoundary resource={resource} skeleton={<SkeletonList rows={3} />} compact>
      {(data) => (
        <ul className="roster">
          {SERVICE_DEFS.map((def) => {
            const status = normalizeHealth(data[def.field]);
            return (
              <li className="roster__row" key={def.field}>
                <span className="roster__name">{def.name}</span>
                <StatusDot status={status} label={healthMeta(status).label} />
              </li>
            );
          })}
        </ul>
      )}
    </AsyncBoundary>
  );
}

export function DashboardPage({ live }) {
  const { role } = useAuth();
  const admin = isAdmin(role);
  const [inspected, setInspected] = useState(null);

  const frauds = useApiResource(
    useCallback((token, signal) => endpoints.recentFrauds(token, signal), []),
    { refreshInterval: 30_000 }
  );

  // Sağlık yalnızca Admin tarafından çağrılır — 403 gürültüsü üretmemek için.
  const health = useApiResource(
    useCallback((token, signal) => endpoints.systemHealth(token, signal), []),
    { enabled: admin, refreshInterval: 20_000 }
  );

  const fraudRows = useMemo(
    () => (Array.isArray(frauds.data) ? frauds.data : []),
    [frauds.data]
  );

  /** En kritik kayıt en üstte: önce şiddet, sonra zaman. */
  const triaged = useMemo(() => {
    const rank = { high: 3, medium: 2, low: 1, none: 0 };
    return [...fraudRows].sort((a, b) => {
      const d =
        rank[severityOf(b.triggeredRules, b.status)] -
        rank[severityOf(a.triggeredRules, a.status)];
      return d !== 0 ? d : new Date(b.occurredAt) - new Date(a.occurredAt);
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
    if (!admin || !health.data) return HealthStatus.UNKNOWN;
    return overallHealth(
      SERVICE_DEFS.map((def) => ({ status: normalizeHealth(health.data[def.field]) }))
    );
  }, [admin, health.data]);

  const refreshAll = useCallback(() => {
    frauds.refresh();
    if (admin) health.refresh();
  }, [frauds, admin, health]);

  const connected = live.connection === ConnectionState.CONNECTED;

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

      {frauds.isError && frauds.data !== null && (
        <StaleBanner error={frauds.error} onRetry={frauds.retry} />
      )}

      <div className="grid grid--dashboard">
        <div className="stack">
          <Section>
            <SectionHeader
              title="İnceleme kuyruğu"
              count={triaged.length || undefined}
              actions={
                triaged.length > 8 && (
                  <Link to="/alerts" className="btn btn--ghost btn--sm">
                    Tümü
                  </Link>
                )
              }
            />
            <AsyncBoundary
              resource={frauds}
              isEmpty={triaged.length === 0}
              skeleton={<SkeletonTable rows={6} columns={6} />}
              empty={<EmptyState title="Şüpheli işlem yok" />}
            >
              {() => (
                <FraudTable rows={triaged.slice(0, 8)} onInspect={setInspected} />
              )}
            </AsyncBoundary>
          </Section>

          {fraudRows.length > 0 && (
            <div className="grid grid--halves">
              <Section>
                <SectionHeader title="Saatlik yoğunluk" />
                <div className="section__body">
                  <FraudTrendChart frauds={fraudRows} />
                </div>
              </Section>

              <Section>
                <SectionHeader title="Kural dağılımı" meta={`${fraudRows.length} kayıt`} />
                <div className="section__body">
                  <RuleBreakdown frauds={fraudRows} />
                </div>
              </Section>
            </div>
          )}
        </div>

        <aside className="stack">
          <Section>
            <SectionHeader
              title="Canlı akış"
              count={live.events.length || undefined}
              actions={
                live.events.length > 0 && (
                  <Link to="/stream" className="btn btn--ghost btn--sm">
                    Tümü
                  </Link>
                )
              }
            />
            {live.events.length === 0 ? (
              <EmptyState
                compact
                title={connected ? 'Olay yok' : 'Akış kesildi'}
                action={
                  !connected && (
                    <Button size="sm" onClick={live.reconnect}>
                      Yeniden bağlan
                    </Button>
                  )
                }
              />
            ) : (
              <div className="feed-scroll">
                <LiveFeed events={live.events} onInspect={setInspected} limit={12} />
              </div>
            )}
          </Section>

          <Section>
            <SectionHeader title="Servisler" />
            <HealthRoster resource={health} admin={admin} />
          </Section>
        </aside>
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
