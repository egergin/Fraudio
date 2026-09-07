import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import { ArrowRight } from 'lucide-react';
import Drawer from '@/components/ui/drawer.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge, SectionHeader, StatusDot } from '@/components/ui/primitives.jsx';
import { CopyableId, Field, RuleTags } from '@/components/ui/data-bits.jsx';
import { AsyncBoundary, EmptyState, SkeletonRows } from '@/components/ui/states.jsx';
import { useApiResource } from '@/hooks/useApiResource.js';
import { endpoints } from '@/lib/api.js';
import {
  RULE_ORDER,
  describeRule,
  severityMeta,
  severityOf,
  statusMeta,
} from '@/lib/domain.js';
import {
  formatCurrency,
  formatDateTime,
  formatLocation,
  formatRelative,
} from '@/lib/format.js';
import { cn } from '@/lib/utils.js';

/**
 * İnceleme çekmecesi.
 *
 * "Bu neden şüpheli?" sorusuna cevap verir — ham alan dökümü değildir.
 *
 * Kaynaklar (yalnızca gerçek uçlar):
 *   - seçilen satır (frauds/recent veya WS olayı)
 *   - GET /api/transaction-users/{userId}
 *   - GET /api/transaction-users/{userId}/transactions
 */

const SEV_TONE = { high: 'critical', medium: 'warn', low: 'idle', none: 'ok' };

/** Risk: skor tetiklenen kural sayısıdır, uydurma bir model değil. */
function RiskHeadline({ severity, triggeredRules }) {
  const meta = severityMeta(severity);
  const count = Array.isArray(triggeredRules) ? triggeredRules.length : 0;
  const color = {
    high: 'text-critical-fg',
    medium: 'text-warn-fg',
    low: 'text-fg',
    none: 'text-ok-fg',
  }[severity];

  return (
    <div className="flex items-baseline gap-4 border-b border-line pb-4">
      <span className={cn('font-mono text-2xl font-bold leading-none tnum', color)}>
        {count}
        <span className="text-md font-medium text-fg-subtle">/3</span>
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold text-fg">{meta.label}</span>
        <span className="text-xs text-fg-muted">{meta.headline}</span>
      </div>
    </div>
  );
}

/** Tetiklenen kurallar — burada açıklama gerçekten bilgi taşır. */
function TriggeredRules({ triggeredRules }) {
  const triggered = Array.isArray(triggeredRules) ? triggeredRules : [];

  if (triggered.length === 0) {
    return <p className="py-4 text-xs text-fg-subtle">Tetiklenen kural yok</p>;
  }

  return (
    <div className="flex flex-col">
      {RULE_ORDER.filter((r) => triggered.includes(r)).map((rule) => {
        const meta = describeRule(rule);
        const color = {
          velocity: 'bg-rule-velocity',
          amount: 'bg-rule-amount',
          location: 'bg-rule-location',
        }[meta.key];

        return (
          <div key={rule} className="flex gap-3 border-b border-line py-3 last:border-b-0">
            <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', color)} aria-hidden="true" />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium text-fg">{meta.fullLabel}</span>
              <span className="text-xs text-fg-muted">{meta.description}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Kullanıcının son işlemleri — kompakt liste, tablo değil. */
function RecentActivity({ rows }) {
  return (
    <div className="flex flex-col">
      {rows.map((row) => {
        const severity = severityOf(row.triggeredRules, row.status);
        const suspicious = String(row.status).toLowerCase() === 'suspicious';
        return (
          <div
            key={row.transactionId}
            className="flex items-baseline gap-3 border-b border-line py-2 last:border-b-0"
          >
            <span
              className={cn(
                'shrink-0 font-mono text-xs font-semibold tnum',
                suspicious ? 'text-critical-fg' : 'text-fg'
              )}
            >
              {formatCurrency(row.amount)}
            </span>
            <span className="min-w-0 flex-1 truncate text-2xs text-fg-muted">
              {formatLocation(row.city, row.country)}
            </span>
            <RuleTags rules={row.triggeredRules} />
            <span className="shrink-0 font-mono text-2xs text-fg-subtle">
              {formatRelative(row.occurredAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const TAB_TRIGGER = cn(
  'border-b-2 border-transparent px-0 pb-2 text-xs font-medium text-fg-muted transition-colors',
  'hover:text-fg data-[state=active]:border-live data-[state=active]:text-fg'
);

export function InvestigationDrawer({ transaction, open, onClose }) {
  const [tab, setTab] = useState('signals');
  const userId = transaction?.userId ?? null;

  const summary = useApiResource(
    useCallback((token, signal) => endpoints.userSummary(userId, token, signal), [userId]),
    { enabled: Boolean(open && userId), deps: [userId] }
  );

  const history = useApiResource(
    useCallback((token, signal) => endpoints.userTransactions(userId, token, signal), [userId]),
    { enabled: Boolean(open && userId), deps: [userId] }
  );

  const severity = useMemo(
    () => severityOf(transaction?.triggeredRules, transaction?.status),
    [transaction]
  );

  if (!transaction) return null;

  const historyRows = Array.isArray(history.data) ? history.data : [];
  const status = statusMeta(transaction.status);

  const header = (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <Badge tone={SEV_TONE[severity]}>{severityMeta(severity).label}</Badge>
        <StatusDot
          tone={
            String(transaction.status).toLowerCase() === 'suspicious'
              ? 'critical'
              : String(transaction.status).toLowerCase() === 'approved'
                ? 'ok'
                : 'info'
          }
          label={status.label}
        />
        <span className="ml-auto shrink-0 font-mono text-2xs text-fg-subtle">
          {formatRelative(transaction.occurredAt)}
        </span>
      </div>
      <CopyableId value={transaction.transactionId} truncate={false} className="text-xs" />
    </div>
  );

  const footer = (
    <>
      <span className="text-2xs text-fg-subtle">Geçmiş son 20 kayıtla sınırlı</span>
      <Button size="sm" variant="secondary" asChild>
        <Link to={`/users/${encodeURIComponent(transaction.userId)}`} onClick={onClose}>
          Kullanıcı dosyası
          <ArrowRight />
        </Link>
      </Button>
    </>
  );

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={`İşlem ${transaction.transactionId}`}
      header={header}
      footer={footer}
    >
      <div className="flex flex-col gap-5">
        <RiskHeadline severity={severity} triggeredRules={transaction.triggeredRules} />

        {/* İşlem gerçekleri — yalnızca API'nin döndürdüğü alanlar */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Kullanıcı">
            <Link
              to={`/users/${encodeURIComponent(transaction.userId)}`}
              onClick={onClose}
              className="font-mono text-xs text-fg underline-offset-2 hover:text-live-fg hover:underline"
            >
              {transaction.userId}
            </Link>
          </Field>
          <Field label="Tutar" mono>
            <span className="font-semibold">{formatCurrency(transaction.amount)}</span>
          </Field>
          <Field label="Konum">{formatLocation(transaction.city, transaction.country)}</Field>
          <Field label="Zaman" mono>
            {formatDateTime(transaction.occurredAt)}
          </Field>
        </dl>

        <Tabs.Root value={tab} onValueChange={setTab}>
          <Tabs.List
            aria-label="İnceleme bölümleri"
            className="flex gap-5 border-b border-line"
          >
            <Tabs.Trigger value="signals" className={TAB_TRIGGER}>
              Neden şüpheli?
            </Tabs.Trigger>
            <Tabs.Trigger value="context" className={TAB_TRIGGER}>
              Kullanıcı geçmişi
              {historyRows.length > 0 && (
                <span className="ml-1.5 font-mono text-2xs text-fg-subtle">
                  {historyRows.length}
                </span>
              )}
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="signals" className="pt-2 outline-none">
            <TriggeredRules triggeredRules={transaction.triggeredRules} />
          </Tabs.Content>

          <Tabs.Content value="context" className="flex flex-col gap-5 pt-4 outline-none">
            <AsyncBoundary
              resource={summary}
              skeleton={<SkeletonRows rows={1} />}
              empty={<EmptyState title="Özet yok" />}
            >
              {(data) => {
                const rate =
                  data.totalTransactions > 0
                    ? (data.suspiciousTransactions / data.totalTransactions) * 100
                    : null;
                return (
                  <dl className="grid grid-cols-3 gap-4">
                    <Field label="Toplam işlem" mono>
                      {data.totalTransactions}
                    </Field>
                    <Field label="Şüpheli" mono>
                      <span
                        className={
                          data.suspiciousTransactions > 0
                            ? 'font-semibold text-critical-fg'
                            : undefined
                        }
                      >
                        {data.suspiciousTransactions}
                      </span>
                    </Field>
                    <Field label="Oran" mono>
                      {rate === null ? '—' : `%${rate.toFixed(0)}`}
                    </Field>
                  </dl>
                );
              }}
            </AsyncBoundary>

            <div className="flex flex-col">
              <SectionHeader title="Son işlemler" as="h3" />
              <AsyncBoundary
                resource={history}
                isEmpty={historyRows.length === 0}
                skeleton={<SkeletonRows rows={4} />}
                empty={<EmptyState title="Geçmiş yok" />}
              >
                {() => <RecentActivity rows={historyRows} />}
              </AsyncBoundary>
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </Drawer>
  );
}

export default InvestigationDrawer;
