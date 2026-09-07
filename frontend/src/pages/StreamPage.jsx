import { useMemo, useState } from 'react';
import {
  Button,
  InlineMetric,
  Section,
  SectionHeader,
  Segmented,
  StatusDot,
} from '../components/ui/primitives.jsx';
import { EmptyState } from '../components/ui/states.jsx';
import LiveFeed from '../components/data/LiveFeed.jsx';
import InvestigationDrawer from '../components/investigate/InvestigationDrawer.jsx';
import { ConnectionState } from '../hooks/useLiveStream.js';
import { formatRelative } from '../lib/format.js';

/**
 * Canlı akış sayfası — WebSocket olaylarının tam görünümü.
 *
 * Bu veriler geçicidir: sayfa yenilendiğinde kaybolur ve geçmiş toplamı
 * temsil etmez. Bu ayrım arayüzde açıkça belirtilir.
 */
export function StreamPage({ live }) {
  const [filter, setFilter] = useState('all');
  const [inspected, setInspected] = useState(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return live.events;
    return live.events.filter(
      (event) => String(event.status).toLowerCase() === filter
    );
  }, [live.events, filter]);

  const counts = useMemo(() => {
    const result = { all: live.events.length, suspicious: 0, approved: 0, received: 0 };
    live.events.forEach((event) => {
      const status = String(event.status).toLowerCase();
      if (status in result) result[status] += 1;
    });
    return result;
  }, [live.events]);

  const isConnected = live.connection === ConnectionState.CONNECTED;

  return (
    <div className="page">
      <section className="opsbar" data-tone={isConnected ? 'ok' : 'warn'}>
        <div className="opsbar__lead">
          <span className="opsbar__figure">{live.totalReceived}</span>
          <span className="opsbar__figure-label">olay · bu oturum</span>
        </div>

        <div className="opsbar__metrics">
          <InlineMetric value={live.totalApproved} label="onaylı" />
          <InlineMetric
            value={live.totalSuspicious}
            label="şüpheli"
            tone={live.totalSuspicious > 0 ? 'danger' : 'neutral'}
          />
        </div>

        <div className="opsbar__status">
          <StatusDot
            status={isConnected ? 'healthy' : 'unknown'}
            label={
              isConnected && live.connectedSince
                ? `Bağlı · ${formatRelative(live.connectedSince)}`
                : isConnected
                  ? 'Bağlı'
                  : 'Bağlı değil'
            }
            pulse={isConnected}
          />
        </div>

        <div className="opsbar__actions">
          {!isConnected && (
            <Button variant="secondary" size="sm" onClick={live.reconnect}>
              Yeniden bağlan
            </Button>
          )}
        </div>
      </section>

      <Section>
        <SectionHeader
          title="Olaylar"
          count={filtered.length}
          actions={
            <Segmented
              ariaLabel="Durum filtresi"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'Tümü', count: counts.all },
                { value: 'suspicious', label: 'Şüpheli', count: counts.suspicious },
                { value: 'approved', label: 'Onaylı', count: counts.approved },
                { value: 'received', label: 'Alındı', count: counts.received },
              ]}
            />
          }
        />

        {filtered.length === 0 ? (
          <EmptyState
            title={
              live.events.length === 0
                ? isConnected
                  ? 'Olay yok'
                  : 'Bağlı değil'
                : 'Eşleşen olay yok'
            }
            action={
              !isConnected && (
                <Button size="sm" onClick={live.reconnect}>
                  Yeniden bağlan
                </Button>
              )
            }
          />
        ) : (
          <LiveFeed events={filtered} onInspect={setInspected} />
        )}

        <p className="section__note">
          Oturuma özgü, son 60 olay — kalıcı kayıtlar için Dolandırıcılık İzleme
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

export default StreamPage;
