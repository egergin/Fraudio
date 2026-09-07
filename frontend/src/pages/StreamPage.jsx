import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import {
  InlineMetric,
  Section,
  SectionHeader,
  SectionNote,
  StatusDot,
} from '@/components/ui/primitives.jsx';
import { Segmented } from '@/components/ui/toolbar.jsx';
import { EmptyState } from '@/components/ui/states.jsx';
import LiveFeed from '@/components/data/LiveFeed.jsx';
import InvestigationDrawer from '@/components/investigate/InvestigationDrawer.jsx';
import { ConnectionState } from '@/hooks/useLiveStream.js';
import { formatRelative } from '@/lib/format.js';
import { cn } from '@/lib/utils.js';

/**
 * Canlı akış — WebSocket olaylarının tam görünümü.
 *
 * Bu veriler oturuma özgüdür: sayfa yenilendiğinde kaybolur ve geçmiş
 * toplamı temsil etmez. Sayı yanlış yorumlanabileceği için bu sınır
 * arayüzde belirtilir.
 */
export function StreamPage({ live }) {
  const [filter, setFilter] = useState('all');
  const [inspected, setInspected] = useState(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return live.events;
    return live.events.filter((event) => String(event.status).toLowerCase() === filter);
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
    <div className="flex flex-col gap-6">
      {/* Özet şeridi — panodakiyle aynı dil */}
      <section
        aria-label="Akış durumu"
        className={cn(
          'flex flex-wrap items-center gap-x-6 gap-y-4 rounded-md border border-line border-l-2 bg-surface px-5 py-3',
          isConnected ? 'border-l-live' : 'border-l-idle'
        )}
      >
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-semibold leading-none tnum text-fg">
            {live.totalReceived}
          </span>
          <span className="text-sm text-fg-secondary">olay · bu oturum</span>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 border-line-strong pl-6 md:border-l">
          <InlineMetric value={live.totalApproved} label="onaylı" />
          <InlineMetric
            value={live.totalSuspicious}
            label="şüpheli"
            tone={live.totalSuspicious > 0 ? 'critical' : 'muted'}
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <StatusDot
            tone={isConnected ? 'live' : 'idle'}
            pulse={isConnected}
            label={
              isConnected && live.connectedSince
                ? `Bağlı · ${formatRelative(live.connectedSince)}`
                : isConnected
                  ? 'Bağlı'
                  : 'Bağlı değil'
            }
          />
          {!isConnected && (
            <Button size="sm" onClick={live.reconnect}>
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
              label="Durum filtresi"
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
                  : 'Akış kesildi'
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

        <SectionNote>
          Oturuma özgü, son 60 olay — kalıcı kayıtlar için Dolandırıcılık
        </SectionNote>
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
