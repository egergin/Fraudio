import { useCallback, useMemo, useState } from 'react';
import Icon from '../components/ui/Icon.jsx';
import {
  Button,
  Notice,
  Panel,
  PanelFooter,
  PanelHeader,
  Segmented,
} from '../components/ui/primitives.jsx';
import {
  AsyncBoundary,
  EmptyState,
  SkeletonTable,
  StaleBanner,
} from '../components/ui/states.jsx';
import FraudTable from '../components/data/FraudTable.jsx';
import InvestigationDrawer from '../components/investigate/InvestigationDrawer.jsx';
import { useApiResource } from '../hooks/useApiResource.js';
import { endpoints } from '../lib/api.js';
import { RULE_ORDER, RULES, Severity, severityOf } from '../lib/domain.js';
import { formatRelative } from '../lib/format.js';

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
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">
            <Icon name="shieldAlert" size={20} />
            Dolandırıcılık izleme
          </h1>
          <p className="page-header__desc">
            Kural motorunun şüpheli olarak işaretlediği işlemler. Bir satırı seçerek
            ihlal gerekçelerini ve kullanıcı geçmişini inceleyebilirsiniz.
          </p>
        </div>
        <div className="page-header__actions">
          <Button
            icon="refresh"
            onClick={frauds.refresh}
            loading={frauds.isRefreshing}
          >
            Yenile
          </Button>
        </div>
      </header>

      {frauds.isError && frauds.data !== null && (
        <StaleBanner error={frauds.error} onRetry={frauds.retry} />
      )}

      <Panel flush>
        <PanelHeader
          title="Şüpheli işlemler"
          subtitle={
            frauds.lastUpdatedAt
              ? `Güncellendi ${formatRelative(frauds.lastUpdatedAt)}`
              : undefined
          }
          actions={
            <span className="row" style={{ gap: 'var(--sp-2)' }}>
              <label className="visually-hidden" htmlFor="alert-search">
                Kullanıcı, şehir veya işlem kimliği ara
              </label>
              <input
                id="alert-search"
                className="input input--search"
                type="search"
                placeholder="Kullanıcı, şehir veya kimlik…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                style={{ width: 220 }}
              />
            </span>
          }
        />

        {/* Filtre çubuğu */}
        <div
          className="row row--wrap row--between"
          style={{
            padding: 'var(--sp-2) var(--sp-4)',
            borderBottom: '1px solid var(--border-subtle)',
            gap: 'var(--sp-3)',
          }}
        >
          <div className="row row--wrap" style={{ gap: 'var(--sp-3)' }}>
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
                ...RULE_ORDER.map((rule) => ({
                  value: rule,
                  label: RULES[rule].label,
                })),
              ]}
            />
          </div>

          {hasActiveFilter && (
            <Button variant="ghost" size="sm" icon="close" onClick={clearFilters}>
              Filtreleri temizle
            </Button>
          )}
        </div>

        <AsyncBoundary
          resource={frauds}
          isEmpty={filtered.length === 0}
          skeleton={<SkeletonTable rows={10} columns={7} />}
          empty={
            hasActiveFilter ? (
              <EmptyState
                icon="filter"
                title="Filtrelerle eşleşen kayıt yok"
                message="Seçtiğiniz ölçütlere uyan şüpheli işlem bulunamadı. Filtreleri temizleyerek tüm kayıtları görebilirsiniz."
                action={
                  <Button size="sm" onClick={clearFilters}>
                    Filtreleri temizle
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon="shield"
                title="Şüpheli işlem yok"
                message="Kural motoru henüz iki veya daha fazla ihlal içeren bir işlem işaretlemedi."
              />
            )
          }
        >
          {() => <FraudTable rows={filtered} onInspect={setInspected} />}
        </AsyncBoundary>

        <PanelFooter>
          <span>
            {hasActiveFilter
              ? `${rows.length} kaydın ${filtered.length} tanesi gösteriliyor`
              : `${filtered.length} kayıt`}
          </span>
        </PanelFooter>
      </Panel>

      <Notice icon="info">
        <strong style={{ color: 'var(--text-secondary)' }}>API sınırı:</strong>{' '}
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)' }}>
          GET /api/frauds/recent
        </code>{' '}
        yalnızca en son 20 şüpheli işlemi döndürür ve sayfalama, tarih aralığı veya
        sunucu tarafı filtreleme parametresi desteklemez. Yukarıdaki arama ve filtreler
        bu 20 kayıt üzerinde çalışır; tüm geçmişi temsil etmez.
      </Notice>

      <InvestigationDrawer
        transaction={inspected}
        open={Boolean(inspected)}
        onClose={() => setInspected(null)}
      />
    </div>
  );
}

export default AlertsPage;
