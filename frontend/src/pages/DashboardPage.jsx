import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import {
  Section,
  SectionHeader,
  SectionNote,
  StatusDot,
} from '@/components/ui/primitives.jsx';
import {
  AsyncBoundary,
  EmptyState,
  SkeletonRows,
  SkeletonTable,
  StaleBanner,
} from '@/components/ui/states.jsx';
import OperationsSummary from '@/components/data/OperationsSummary.jsx';
import FraudQueue from '@/components/data/FraudQueue.jsx';
import LiveFeed from '@/components/data/LiveFeed.jsx';
import FraudTrendChart from '@/components/data/FraudTrendChart.jsx';
import RuleBreakdown from '@/components/data/RuleBreakdown.jsx';
import InvestigationDrawer from '@/components/investigate/InvestigationDrawer.jsx';
import { useApiResource } from '@/hooks/useApiResource.js';
import { endpoints } from '@/lib/api.js';
import { useAuth } from '@/auth/AuthContext.jsx';
import {
  HealthStatus,
  SERVICE_DEFS,
  Severity,
  healthMeta,
  isAdmin,
  normalizeHealth,
  overallHealth,
  severityOf,
} from '@/lib/domain.js';
import { ConnectionState } from '@/hooks/useLiveStream.js';

/**
 * Genel Bakış.
 *
 * Hiyerarşi bilinçli olarak asimetriktir:
 *   1. Sistem durumu    → üstteki özet şeridi
 *   2. Kritik aktivite  → şeritteki baskın sayı
 *   3. İnceleme kuyruğu → sayfanın ağırlığını taşıyan geniş sütun
 *   4. Canlı aktivite   → dar yan sütun
 *   5. Geçmiş eğilim    → kuyruğun altında kompakt
 *   6. Altyapı sağlığı  → yan sütunun en altı
 *
 * Hiçbir bölüm kart içinde değildir; ayrım başlık kuralı, boşluk ve tek bir
 * dikey çizgiyle kurulur.
 */

const SEVERITY_RANK = { high: 3, medium: 2, low: 1, none: 0 };

/** Altyapı: hizalanmış ad → durum. Kart yok, ikon yok. */
function ServiceRoster({ resource, admin }) {
  if (!admin) {
    return <p className="py-4 text-xs text-fg-subtle">Yönetici rolü gerekir</p>;
  }

  return (
    <AsyncBoundary resource={resource} skeleton={<SkeletonRows rows={3} />}>
      {(data) => (
        <ul className="flex flex-col">
          {SERVICE_DEFS.map((def) => {
            const status = normalizeHealth(data[def.field]);
            return (
              <li
                key={def.field}
                className="flex items-center justify-between gap-4 border-b border-line py-2 last:border-b-0"
              >
                <span className="text-sm text-fg-secondary">{def.name}</span>
                <StatusDot
                  tone={
                    status === HealthStatus.HEALTHY
                      ? 'ok'
                      : status === HealthStatus.UNHEALTHY
                        ? 'critical'
                        : status === HealthStatus.DEGRADED
                          ? 'warn'
                          : 'idle'
                  }
                  label={healthMeta(status).label}
                />
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
  const triaged = useMemo(
    () =>
      [...fraudRows].sort((a, b) => {
        const d =
          SEVERITY_RANK[severityOf(b.triggeredRules, b.status)] -
          SEVERITY_RANK[severityOf(a.triggeredRules, a.status)];
        return d !== 0 ? d : new Date(b.occurredAt) - new Date(a.occurredAt);
      }),
    [fraudRows]
  );

  const criticalCount = useMemo(
    () =>
      fraudRows.filter((r) => severityOf(r.triggeredRules, r.status) === Severity.HIGH).length,
    [fraudRows]
  );

  const healthStatus = useMemo(() => {
    if (!admin || !health.data) return HealthStatus.UNKNOWN;
    return overallHealth(
      SERVICE_DEFS.map((d) => ({ status: normalizeHealth(health.data[d.field]) }))
    );
  }, [admin, health.data]);

  const refreshAll = useCallback(() => {
    frauds.refresh();
    if (admin) health.refresh();
  }, [frauds, admin, health]);

  const connected = live.connection === ConnectionState.CONNECTED;

  return (
    <div className="flex flex-col gap-6">
      <OperationsSummary
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

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* Birincil sütun: inceleme kuyruğu + eğilim */}
        <div className="flex min-w-0 flex-col gap-8">
          <Section>
            <SectionHeader
              title="İnceleme kuyruğu"
              count={triaged.length || undefined}
              actions={
                triaged.length > 8 && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/alerts">Tümü</Link>
                  </Button>
                )
              }
            />
            <AsyncBoundary
              resource={frauds}
              isEmpty={triaged.length === 0}
              skeleton={<SkeletonTable rows={6} columns={5} />}
              empty={<EmptyState title="Şüpheli işlem yok" />}
            >
              {() => <FraudQueue rows={triaged.slice(0, 8)} onInspect={setInspected} />}
            </AsyncBoundary>
          </Section>

          {fraudRows.length > 0 && (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <Section>
                <SectionHeader title="Saatlik yoğunluk" />
                <FraudTrendChart frauds={fraudRows} />
              </Section>

              <Section>
                <SectionHeader title="Kural dağılımı" meta={`${fraudRows.length} kayıt`} />
                <RuleBreakdown frauds={fraudRows} />
              </Section>
            </div>
          )}
        </div>

        {/* İkincil sütun: canlı akış + altyapı */}
        <aside className="flex min-w-0 flex-col gap-8 border-line xl:border-l xl:pl-8">
          <Section>
            <SectionHeader
              title="Canlı akış"
              count={live.events.length || undefined}
              actions={
                live.events.length > 0 && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/stream">Tümü</Link>
                  </Button>
                )
              }
            />
            {live.events.length === 0 ? (
              <EmptyState
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
              <div className="max-h-[360px] overflow-y-auto">
                <LiveFeed events={live.events} onInspect={setInspected} limit={12} />
              </div>
            )}
          </Section>

          <Section>
            <SectionHeader title="Altyapı" />
            <ServiceRoster resource={health} admin={admin} />
            {admin && <SectionNote>20 sn'de bir yenilenir</SectionNote>}
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
