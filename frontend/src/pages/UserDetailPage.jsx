import { useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/legacy/Icon.jsx';
import {
  Button,
  InlineMetric,
  CopyableId,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  StatusBadge,
} from '../components/legacy/primitives.jsx';
import {
  AsyncBoundary,
  EmptyState,
  ErrorState,
  SkeletonList,
  SkeletonTable,
} from '../components/legacy/states.jsx';
import { UserTransactionTable } from '../components/legacy/FraudTable.jsx';
import RuleBreakdown from '../components/data/RuleBreakdown.jsx';
import { useApiResource } from '../hooks/useApiResource.js';
import { endpoints, ErrorKind } from '../lib/api.js';
import {
  formatCurrency,
  formatDateTime,
  formatLocation,
  formatRelative,
  initials,
} from '../lib/format.js';

/**
 * Kullanıcı inceleme dosyası.
 *
 * Veri kaynakları:
 *   GET /api/transaction-users/{userId}
 *   GET /api/transaction-users/{userId}/transactions
 *
 * Backend'in döndürmediği hiçbir alan gösterilmez (risk skoru, KYC vb. yoktur).
 */
export function UserDetailPage() {
  const { userId } = useParams();

  const summary = useApiResource(
    useCallback(
      (token, signal) => endpoints.userSummary(userId, token, signal),
      [userId]
    ),
    { deps: [userId] }
  );

  const history = useApiResource(
    useCallback(
      (token, signal) => endpoints.userTransactions(userId, token, signal),
      [userId]
    ),
    { deps: [userId] }
  );

  const rows = useMemo(
    () => (Array.isArray(history.data) ? history.data : []),
    [history.data]
  );

  const suspiciousRows = useMemo(
    () => rows.filter((row) => String(row.status).toLowerCase() === 'suspicious'),
    [rows]
  );

  const data = summary.data;

  const suspiciousRate =
    data && data.totalTransactions > 0
      ? (data.suspiciousTransactions / data.totalTransactions) * 100
      : null;

  // Kullanıcı hiç yoksa (404) tam sayfa boş durum gösterilir.
  const notFound = summary.error?.kind === ErrorKind.NOT_FOUND;

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <nav aria-label="Konum" className="row" style={{ gap: 'var(--sp-2)' }}>
            <Link
              to="/alerts"
              className="btn btn--ghost btn--sm"
              style={{ marginLeft: -8 }}
            >
              <Icon name="chevronRight" size={12} style={{ transform: 'rotate(180deg)' }} />
              Dolandırıcılık izleme
            </Link>
          </nav>
          <h1 className="page-header__title">
            <span className="user-chip__avatar" style={{ width: 28, height: 28 }}>
              {initials(userId)}
            </span>
            <span className="mono truncate">{userId}</span>
          </h1>
        </div>
        <div className="page-header__actions">
          <Button
            icon="refresh"
            onClick={() => {
              summary.refresh();
              history.refresh();
            }}
            loading={summary.isRefreshing || history.isRefreshing}
          >
            Yenile
          </Button>
        </div>
      </header>

      {notFound ? (
        <Panel>
          <EmptyState
            icon="search"
            title="Kullanıcı bulunamadı"
            message={`"${userId}" kimliğine sahip bir işlem kullanıcısı veritabanında kayıtlı değil. Kimliğin doğru yazıldığından emin olun.`}
            action={
              <Link to="/alerts" className="btn btn--secondary btn--sm">
                Dolandırıcılık izlemeye dön
              </Link>
            }
          />
        </Panel>
      ) : (
        <>
          {/* Özet şeridi */}
          <AsyncBoundary
            resource={summary}
            skeleton={
              <Panel>
                <PanelBody>
                  <SkeletonList rows={2} />
                </PanelBody>
              </Panel>
            }
          >
            {(summaryData) => (
              <section
                className="opsbar"
                data-tone={summaryData.suspiciousTransactions > 0 ? 'warn' : 'ok'}
                aria-label="Kullanıcı özeti"
              >
                <div className="opsbar__lead">
                  <span className="opsbar__figure">
                    {summaryData.suspiciousTransactions}
                  </span>
                  <span className="opsbar__figure-label">şüpheli işlem</span>
                </div>

                <div className="opsbar__metrics">
                  <InlineMetric
                    value={summaryData.totalTransactions}
                    label="toplam"
                  />
                  <InlineMetric
                    value={suspiciousRate === null ? '—' : `%${suspiciousRate.toFixed(0)}`}
                    label="oran"
                    tone={suspiciousRate > 0 ? 'warn' : 'neutral'}
                  />
                  {summaryData.lastTransaction && (
                    <InlineMetric
                      value={formatCurrency(summaryData.lastTransaction.amount)}
                      label={formatRelative(summaryData.lastTransaction.occurredAt)}
                    />
                  )}
                </div>
              </section>
            )}
          </AsyncBoundary>

          <div className="grid grid--dashboard">
            <div className="stack">
              {/* İşlem geçmişi */}
              <Panel flush>
                <PanelHeader
                  title="İşlem geçmişi"
                  subtitle="API tarafından son 20 kayıtla sınırlandırılmıştır"
                />
                <AsyncBoundary
                  resource={history}
                  isEmpty={rows.length === 0}
                  skeleton={<SkeletonTable rows={8} columns={6} />}
                  empty={
                    <EmptyState
                      icon="history"
                      title="İşlem geçmişi yok"
                      message="Bu kullanıcı için kayıtlı bir işlem bulunamadı."
                    />
                  }
                >
                  {() => <UserTransactionTable rows={rows} />}
                </AsyncBoundary>
                <PanelFooter>
                  <span>{rows.length} işlem gösteriliyor</span>
                  {suspiciousRows.length > 0 && (
                    <span style={{ color: 'var(--danger-text)' }}>
                      {suspiciousRows.length} şüpheli
                    </span>
                  )}
                </PanelFooter>
              </Panel>
            </div>

            <div className="stack">
              {/* Son işlem ayrıntısı */}
              {data?.lastTransaction && (
                <Panel>
                  <PanelHeader title="Son işlem" />
                  <PanelBody>
                    <dl className="dl" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                      <div className="dl__item">
                        <dt className="dl__term">Durum</dt>
                        <dd className="dl__desc">
                          <StatusBadge status={data.lastTransaction.status} />
                        </dd>
                      </div>
                      <div className="dl__item">
                        <dt className="dl__term">Tutar</dt>
                        <dd className="dl__desc mono" style={{ fontWeight: 600 }}>
                          {formatCurrency(data.lastTransaction.amount)}
                        </dd>
                      </div>
                      <div className="dl__item">
                        <dt className="dl__term">Konum</dt>
                        <dd className="dl__desc">
                          {formatLocation(data.lastTransaction.city)}
                        </dd>
                      </div>
                      <div className="dl__item">
                        <dt className="dl__term">Zaman</dt>
                        <dd className="dl__desc mono" style={{ fontSize: 'var(--text-xs)' }}>
                          {formatDateTime(data.lastTransaction.occurredAt)}
                        </dd>
                      </div>
                      <div className="dl__item">
                        <dt className="dl__term">İşlem kimliği</dt>
                        <dd className="dl__desc">
                          <CopyableId value={data.lastTransaction.id} />
                        </dd>
                      </div>
                    </dl>
                  </PanelBody>
                </Panel>
              )}

              {/* Bu kullanıcının tetiklediği kural dağılımı */}
              {suspiciousRows.length > 0 && (
                <Panel flush>
                  <PanelHeader
                    title="Tetiklenen kurallar"
                    subtitle={`${suspiciousRows.length} şüpheli işlem üzerinden`}
                  />
                  <RuleBreakdown frauds={suspiciousRows} />
                </Panel>
              )}

              {history.isError && history.data === null && (
                <Panel>
                  <ErrorState error={history.error} onRetry={history.retry} compact />
                </Panel>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default UserDetailPage;
