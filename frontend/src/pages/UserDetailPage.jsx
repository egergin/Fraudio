import { useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import {
  InlineMetric,
  Section,
  SectionHeader,
  SectionNote,
  StatusDot,
} from '@/components/ui/primitives.jsx';
import { CopyableId, Field } from '@/components/ui/data-bits.jsx';
import {
  AsyncBoundary,
  EmptyState,
  ErrorState,
  SkeletonRows,
  SkeletonTable,
} from '@/components/ui/states.jsx';
import UserTransactionTable from '@/components/data/UserTransactionTable.jsx';
import RuleBreakdown from '@/components/data/RuleBreakdown.jsx';
import { useApiResource } from '@/hooks/useApiResource.js';
import { endpoints, ErrorKind } from '@/lib/api.js';
import { statusMeta } from '@/lib/domain.js';
import {
  formatCurrency,
  formatDateTime,
  formatLocation,
  formatRelative,
} from '@/lib/format.js';
import { cn } from '@/lib/utils.js';

/**
 * Kullanıcı inceleme dosyası.
 *
 * Kaynaklar:
 *   GET /api/transaction-users/{userId}
 *   GET /api/transaction-users/{userId}/transactions
 *
 * Backend'in döndürmediği hiçbir alan gösterilmez — risk skoru, KYC,
 * cihaz parmak izi gibi şeyler yoktur.
 */
export function UserDetailPage() {
  const { userId } = useParams();

  const summary = useApiResource(
    useCallback((token, signal) => endpoints.userSummary(userId, token, signal), [userId]),
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
  const rate =
    data && data.totalTransactions > 0
      ? (data.suspiciousTransactions / data.totalTransactions) * 100
      : null;

  const notFound = summary.error?.kind === ErrorKind.NOT_FOUND;

  return (
    <div className="flex flex-col gap-6">
      {/* Bağlam çubuğu: geri dönüş + kimlik */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link to="/alerts">
            <ArrowLeft />
            Dolandırıcılık
          </Link>
        </Button>
        <h1 className="truncate font-mono text-lg font-semibold text-fg">{userId}</h1>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          aria-label="Yenile"
          loading={summary.isRefreshing || history.isRefreshing}
          onClick={() => {
            summary.refresh();
            history.refresh();
          }}
        >
          {!(summary.isRefreshing || history.isRefreshing) && <RefreshCw />}
        </Button>
      </div>

      {notFound ? (
        <EmptyState
          title="Kullanıcı bulunamadı"
          action={
            <Button size="sm" variant="secondary" asChild>
              <Link to="/alerts">Dolandırıcılığa dön</Link>
            </Button>
          }
        />
      ) : (
        <>
          <AsyncBoundary resource={summary} skeleton={<SkeletonRows rows={2} />}>
            {(s) => (
              <section
                aria-label="Kullanıcı özeti"
                className={cn(
                  'flex flex-wrap items-center gap-x-6 gap-y-4 rounded-md border border-line border-l-2 bg-surface px-5 py-3',
                  s.suspiciousTransactions > 0 ? 'border-l-warn' : 'border-l-ok'
                )}
              >
                <div className="flex items-baseline gap-3">
                  <span
                    className={cn(
                      'text-3xl font-semibold leading-none tnum',
                      s.suspiciousTransactions > 0 ? 'text-warn-fg' : 'text-fg'
                    )}
                  >
                    {s.suspiciousTransactions}
                  </span>
                  <span className="text-sm text-fg-secondary">şüpheli işlem</span>
                </div>

                <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 border-line-strong pl-6 md:border-l">
                  <InlineMetric value={s.totalTransactions} label="toplam" />
                  <InlineMetric
                    value={rate === null ? '—' : `%${rate.toFixed(0)}`}
                    label="oran"
                    tone={rate > 0 ? 'warn' : 'muted'}
                  />
                  {s.lastTransaction && (
                    <InlineMetric
                      value={formatCurrency(s.lastTransaction.amount)}
                      label={formatRelative(s.lastTransaction.occurredAt)}
                    />
                  )}
                </div>
              </section>
            )}
          </AsyncBoundary>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
            <Section>
              <SectionHeader
                title="İşlem geçmişi"
                count={rows.length || undefined}
                meta={
                  suspiciousRows.length > 0 ? `${suspiciousRows.length} şüpheli` : undefined
                }
              />
              <AsyncBoundary
                resource={history}
                isEmpty={rows.length === 0}
                skeleton={<SkeletonTable rows={8} columns={5} />}
                empty={<EmptyState title="İşlem yok" />}
              >
                {() => <UserTransactionTable rows={rows} />}
              </AsyncBoundary>
              <SectionNote>API son 20 kaydı döndürür</SectionNote>
            </Section>

            <aside className="flex min-w-0 flex-col gap-8 border-line xl:border-l xl:pl-8">
              {data?.lastTransaction && (
                <Section>
                  <SectionHeader title="Son işlem" />
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-4 pt-3">
                    <Field label="Durum">
                      <StatusDot
                        tone={
                          String(data.lastTransaction.status).toLowerCase() === 'suspicious'
                            ? 'critical'
                            : String(data.lastTransaction.status).toLowerCase() === 'approved'
                              ? 'ok'
                              : 'info'
                        }
                        label={statusMeta(data.lastTransaction.status).label}
                      />
                    </Field>
                    <Field label="Tutar" mono>
                      <span className="font-semibold">
                        {formatCurrency(data.lastTransaction.amount)}
                      </span>
                    </Field>
                    <Field label="Konum">{formatLocation(data.lastTransaction.city)}</Field>
                    <Field label="Zaman" mono>
                      {formatDateTime(data.lastTransaction.occurredAt)}
                    </Field>
                    <Field label="İşlem kimliği" className="col-span-2">
                      <CopyableId value={data.lastTransaction.id} />
                    </Field>
                  </dl>
                </Section>
              )}

              {suspiciousRows.length > 0 && (
                <Section>
                  <SectionHeader
                    title="Tetiklenen kurallar"
                    meta={`${suspiciousRows.length} şüpheli`}
                  />
                  <RuleBreakdown frauds={suspiciousRows} />
                </Section>
              )}

              {history.isError && history.data === null && (
                <ErrorState error={history.error} onRetry={history.retry} />
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

export default UserDetailPage;
