import { useCallback, useMemo, useState } from 'react';
import {
  Button,
  Section,
  SectionHeader,
  Segmented,
} from '../components/legacy/primitives.jsx';
import {
  AsyncBoundary,
  EmptyState,
  SkeletonTable,
  StaleBanner,
} from '../components/legacy/states.jsx';
import FraudTable from '../components/legacy/FraudTable.jsx';
import InvestigationDrawer from '../components/investigate/InvestigationDrawer.jsx';
import { useApiResource } from '../hooks/useApiResource.js';
import { endpoints } from '../lib/api.js';
import { RULE_ORDER, RULES, Severity, severityOf } from '../lib/domain.js';

const SEVERITY_RANK = { high: 3, medium: 2, low: 1, none: 0 };

/**
 * Dolandırıcılık izleme sayfası.
 *
 * Veri: GET /api/frauds/recent — son 20 şüpheli işlem.
 * Backend sayfalama/filtreleme parametresi sunmadığı için arama ve
 * filtreleme bu 20 kayıt üzerinde istemci tarafında yapılır; bu sınır
 * kullanıcıya açıkça bildirilir.
 */
export function AlertsPage() {
  const [inspected, setInspected] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [ruleFilter, setRuleFilter] = useState('all');
  const [query, setQuery] = useState('');

  const frauds = useApiResource(
    useCallback((token, signal) => endpoints.recentFrauds(token, signal), []),
    { refreshInterval: 30_000 }
  );

  const rows = useMemo(
    () => (Array.isArray(frauds.data) ? frauds.data : []),
    [frauds.data]
  );

  const counts = useMemo(() => {
    const result = { all: rows.length, high: 0, medium: 0 };
    rows.forEach((row) => {
      const severity = severityOf(row.triggeredRules, row.status);
      if (severity === Severity.HIGH) result.high += 1;
      if (severity === Severity.MEDIUM) result.medium += 1;
    });
    return result;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return rows
      .filter((row) => {
        const severity = severityOf(row.triggeredRules, row.status);
        if (severityFilter !== 'all' && severity !== severityFilter) return false;

        if (
          ruleFilter !== 'all' &&
          !(Array.isArray(row.triggeredRules) && row.triggeredRules.includes(ruleFilter))
        ) {
          return false;
        }

        if (needle) {
          const haystack = [row.userId, row.city, row.transactionId]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(needle)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const sevA = severityOf(a.triggeredRules, a.status);
        const sevB = severityOf(b.triggeredRules, b.status);
        if (SEVERITY_RANK[sevB] !== SEVERITY_RANK[sevA]) {
          return SEVERITY_RANK[sevB] - SEVERITY_RANK[sevA];
        }
        return new Date(b.occurredAt) - new Date(a.occurredAt);
      });
  }, [rows, severityFilter, ruleFilter, query]);

  const hasActiveFilter =
    severityFilter !== 'all' || ruleFilter !== 'all' || query.trim().length > 0;

  const clearFilters = () => {
    setSeverityFilter('all');
    setRuleFilter('all');
    setQuery('');
  };

  return (
    <div className="page">
      <div className="toolbar">
        <Segmented
          ariaLabel="Şiddet filtresi"
          value={severityFilter}
          onChange={setSeverityFilter}
          options={[
            { value: 'all', label: 'Tümü', count: counts.all },
            { value: Severity.HIGH, label: 'Kritik', count: counts.high },
            { value: Severity.MEDIUM, label: 'Yüksek', count: counts.medium },
          ]}
        />
        <Segmented
          ariaLabel="Kural filtresi"
          value={ruleFilter}
          onChange={setRuleFilter}
          options={[
            { value: 'all', label: 'Tüm kurallar' },
            ...RULE_ORDER.map((rule) => ({ value: rule, label: RULES[rule].label })),
          ]}
        />

        <div className="toolbar__end">
          <label className="visually-hidden" htmlFor="alert-search">
            Kullanıcı, şehir veya işlem kimliği ara
          </label>
          <input
            id="alert-search"
            className="input input--search"
            type="search"
            placeholder="Kullanıcı, şehir, kimlik"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {hasActiveFilter && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Temizle
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon="refresh"
            onClick={frauds.refresh}
            loading={frauds.isRefreshing}
            aria-label="Yenile"
          />
        </div>
      </div>

      {frauds.isError && frauds.data !== null && (
        <StaleBanner error={frauds.error} onRetry={frauds.retry} />
      )}

      <Section>
        <SectionHeader
          title="Şüpheli işlemler"
          count={filtered.length}
          meta={
            hasActiveFilter && filtered.length !== rows.length
              ? `${rows.length} kayıttan`
              : undefined
          }
        />

        <AsyncBoundary
          resource={frauds}
          isEmpty={filtered.length === 0}
          skeleton={<SkeletonTable rows={10} columns={7} />}
          empty={
            hasActiveFilter ? (
              <EmptyState
                title="Eşleşen kayıt yok"
                action={
                  <Button size="sm" onClick={clearFilters}>
                    Filtreleri temizle
                  </Button>
                }
              />
            ) : (
              <EmptyState title="Şüpheli işlem yok" />
            )
          }
        >
          {() => <FraudTable rows={filtered} onInspect={setInspected} />}
        </AsyncBoundary>

        <p className="section__note">
          <code>GET /api/frauds/recent</code> son 20 kaydı döndürür; filtreler bu
          örneklem üzerinde çalışır
        </p>
      </Section>

      <InvestigationDrawer
        transaction={inspected}
        open={Boolean(inspected)}
        onClose={() => setInspected(null)}
      />
    </div>
  );
}

export default AlertsPage;
