import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Drawer from './Drawer.jsx';
import Icon from '../ui/Icon.jsx';
import {
  CopyableId,
  DescriptionList,
  Section,
  SectionHeader,
  SeverityBadge,
  StatusBadge,
} from '../ui/primitives.jsx';
import { AsyncBoundary, EmptyState, SkeletonList } from '../ui/states.jsx';
import { UserTransactionTable } from '../data/FraudTable.jsx';
import { useApiResource } from '../../hooks/useApiResource.js';
import { endpoints } from '../../lib/api.js';
import { describeRule, RULE_ORDER, severityMeta, severityOf } from '../../lib/domain.js';
import {
  formatCurrency,
  formatDateTime,
  formatLocation,
  formatRelative,
} from '../../lib/format.js';

/**
 * İnceleme çekmecesi.
 *
 * Amaç: "bu neden şüpheli?" sorusuna cevap vermek — ham alan dökümü değil.
 *
 * Veri kaynakları (yalnızca gerçek uçlar):
 *   - seçilen satır (frauds/recent veya WS olayı)
 *   - GET /api/transaction-users/{userId}
 *   - GET /api/transaction-users/{userId}/transactions
 */

/** Tetiklenen kuralları neden-açıklamalı bloklar hâline getirir. */
function TriggerList({ triggeredRules }) {
  const triggered = Array.isArray(triggeredRules) ? triggeredRules : [];

  if (triggered.length === 0) {
    return <p className="section__note">Tetiklenen kural yok</p>;
  }

  return (
    <div className="stack stack--sm">
      {RULE_ORDER.filter((rule) => triggered.includes(rule)).map((rule) => {
        const meta = describeRule(rule);
        return (
          <div className="trigger" key={rule}>
            <span className="trigger__glyph" style={{ color: meta.color }}>
              <Icon name="warning" size={13} />
            </span>
            <span className="trigger__text">
              <span className="trigger__name">{meta.fullLabel}</span>
              <span className="trigger__desc">{meta.description}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Risk özeti — skor, tetiklenen kural sayısıdır; uydurma bir model değildir. */
function RiskSummary({ severity, triggeredRules }) {
  const meta = severityMeta(severity);
  const count = Array.isArray(triggeredRules) ? triggeredRules.length : 0;

  return (
    <div className="risk" data-sev={severity}>
      <span className="risk__score-value">
        {count}
        <span className="risk__score-of">/3</span>
      </span>
      <span className="risk__text">
        <span className="risk__headline">{meta.label}</span>
        <span className="risk__reason">{meta.headline}</span>
      </span>
    </div>
  );
}

export function InvestigationDrawer({ transaction, open, onClose }) {
  const [tab, setTab] = useState('signals');

  const userId = transaction?.userId ?? null;

  const summary = useApiResource(
    useCallback(
      (token, signal) => endpoints.userSummary(userId, token, signal),
      [userId]
    ),
    { enabled: Boolean(open && userId), deps: [userId] }
  );

  const history = useApiResource(
    useCallback(
      (token, signal) => endpoints.userTransactions(userId, token, signal),
      [userId]
    ),
    { enabled: Boolean(open && userId), deps: [userId] }
  );

  const severity = useMemo(
    () => severityOf(transaction?.triggeredRules, transaction?.status),
    [transaction]
  );

  if (!transaction) return null;

  const historyRows = Array.isArray(history.data) ? history.data : [];
  const summaryData = summary.data;

  const suspiciousRate =
    summaryData && summaryData.totalTransactions > 0
      ? (summaryData.suspiciousTransactions / summaryData.totalTransactions) * 100
      : null;

  const header = (
    <div className="drawer__ident">
      <span className="eyebrow">İnceleme</span>
      <h2 className="drawer__title" id="investigation-title">
        <CopyableId value={transaction.transactionId} truncate={false} />
      </h2>
      <div className="row row--wrap" style={{ gap: 'var(--sp-2)' }}>
        <SeverityBadge severity={severity} />
        <StatusBadge status={transaction.status} />
        <span className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {formatRelative(transaction.occurredAt)}
        </span>
      </div>
    </div>
  );

  const footer = (
    <>
      <span className="drawer__note">Geçmiş son 20 kayıtla sınırlı</span>
      <Link
        to={`/users/${encodeURIComponent(transaction.userId)}`}
        className="btn btn--primary btn--sm"
        onClick={onClose}
      >
        Kullanıcı dosyasını aç
        <Icon name="arrowRight" size={13} />
      </Link>
    </>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      labelledBy="investigation-title"
      header={header}
      footer={footer}
    >
      <RiskSummary severity={severity} triggeredRules={transaction.triggeredRules} />

      {/* İşlem gerçekleri — yalnızca API'nin döndürdüğü alanlar */}
      <Section>
        <SectionHeader title="İşlem" level="h3" />
        <div className="section__body">
          <DescriptionList
            items={[
              {
                term: 'Kullanıcı',
                value: (
                  <Link
                    to={`/users/${encodeURIComponent(transaction.userId)}`}
                    className="entity-link"
                    onClick={onClose}
                  >
                    {transaction.userId}
                  </Link>
                ),
              },
              {
                term: 'Tutar',
                value: (
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {formatCurrency(transaction.amount)}
                  </span>
                ),
              },
              {
                term: 'Konum',
                value: formatLocation(transaction.city, transaction.country),
              },
              {
                term: 'Gerçekleşme zamanı',
                value: <span className="mono">{formatDateTime(transaction.occurredAt)}</span>,
              },
            ]}
          />
        </div>
      </Section>

      {/* Sekmeler: sinyaller / kullanıcı bağlamı */}
      <div>
        <div className="tabs" role="tablist" aria-label="İnceleme bölümleri">
          <button
            type="button"
            role="tab"
            id="tab-signals"
            className="tab"
            aria-selected={tab === 'signals'}
            aria-controls="panel-signals"
            onClick={() => setTab('signals')}
          >
            Neden şüpheli?
          </button>
          <button
            type="button"
            role="tab"
            id="tab-context"
            className="tab"
            aria-selected={tab === 'context'}
            aria-controls="panel-context"
            onClick={() => setTab('context')}
          >
            Kullanıcı geçmişi
            {historyRows.length > 0 && (
              <span className="tab__count">{historyRows.length}</span>
            )}
          </button>
        </div>

        {tab === 'signals' && (
          <div
            role="tabpanel"
            id="panel-signals"
            aria-labelledby="tab-signals"
            style={{ paddingTop: 'var(--sp-4)' }}
          >
            <TriggerList triggeredRules={transaction.triggeredRules} />
          </div>
        )}

        {tab === 'context' && (
          <div
            role="tabpanel"
            id="panel-context"
            aria-labelledby="tab-context"
            style={{ paddingTop: 'var(--sp-4)' }}
            className="stack"
          >
            {/* Kullanıcı özeti */}
            <AsyncBoundary
              resource={summary}
              skeleton={<SkeletonList rows={2} />}
              compact
              empty={
                <EmptyState compact title="Özet yok" />
              }
            >
              {(data) => (
                <div className="section__body">
                  <div>
                    <DescriptionList
                      columns={3}
                      items={[
                        {
                          term: 'Toplam işlem',
                          value: <span className="mono">{data.totalTransactions}</span>,
                        },
                        {
                          term: 'Şüpheli işlem',
                          value: (
                            <span
                              className="mono"
                              style={{
                                color:
                                  data.suspiciousTransactions > 0
                                    ? 'var(--danger-text)'
                                    : undefined,
                                fontWeight: 600,
                              }}
                            >
                              {data.suspiciousTransactions}
                            </span>
                          ),
                        },
                        {
                          term: 'Şüpheli oranı',
                          value: (
                            <span className="mono">
                              {suspiciousRate === null
                                ? '—'
                                : `%${suspiciousRate.toFixed(0)}`}
                            </span>
                          ),
                        },
                      ]}
                    />
                  </div>
                </div>
              )}
            </AsyncBoundary>

            {/* İşlem geçmişi */}
            <Section>
              <SectionHeader title="Son işlemler" level="h3" />
              <AsyncBoundary
                resource={history}
                isEmpty={historyRows.length === 0}
                skeleton={<SkeletonList rows={4} />}
                compact
                empty={
                  <EmptyState compact title="Geçmiş yok" />
                }
              >
                {() => <UserTransactionTable rows={historyRows} />}
              </AsyncBoundary>
            </Section>
          </div>
        )}
      </div>
    </Drawer>
  );
}

export default InvestigationDrawer;
