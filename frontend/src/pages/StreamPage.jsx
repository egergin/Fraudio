import { useMemo, useState } from 'react';
import Icon from '../components/ui/Icon.jsx';
import {
  Button,
  Notice,
  Panel,
  PanelFooter,
  PanelHeader,
  Segmented,
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
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">
            <Icon name="activity" size={20} />
            Canlı işlem akışı
          </h1>
          <p className="page-header__desc">
            Backend'in WebSocket kanalından yayınladığı işlem olayları. Alınan, onaylanan
            ve şüpheli bulunan işlemler geldikleri anda burada görünür.
          </p>
        </div>
        <div className="page-header__actions">
          {!isConnected && (
            <Button icon="refresh" onClick={live.reconnect}>
              Yeniden bağlan
            </Button>
          )}
        </div>
      </header>

      {/* Oturum sayaçları — geçmiş toplam olmadıkları açıkça etiketli */}
      <section className="opsbar" data-posture={isConnected ? 'ok' : 'unknown'}>
        <div className="opsbar__cell opsbar__cell--primary">
          <span className="opsbar__label">Akış Durumu</span>
          <div className="posture" data-posture={isConnected ? 'ok' : 'unknown'}>
            <span className="posture__glyph">
              <Icon name={isConnected ? 'pulse' : 'plug'} size={16} />
            </span>
            <span className="posture__text">
              <span className="posture__headline">
                {isConnected ? 'Bağlı ve dinleniyor' : 'Bağlantı yok'}
              </span>
              <span className="posture__detail">
                {live.connectedSince && isConnected
                  ? `${formatRelative(live.connectedSince)} bağlandı`
                  : 'Olaylar gerçek zamanlı alınmıyor'}
              </span>
            </span>
          </div>
        </div>

        <div className="opsbar__cell">
          <span className="opsbar__label">Alınan</span>
          <span className="opsbar__value opsbar__value--accent">{live.totalReceived}</span>
          <span className="opsbar__note">Bu oturumda</span>
        </div>

        <div className="opsbar__cell">
          <span className="opsbar__label">Onaylanan</span>
          <span className="opsbar__value">{live.totalApproved}</span>
          <span className="opsbar__note">Bu oturumda</span>
        </div>

        <div className="opsbar__cell">
          <span className="opsbar__label">Şüpheli</span>
          <span
            className={`opsbar__value ${live.totalSuspicious > 0 ? 'opsbar__value--danger' : ''}`}
          >
            {live.totalSuspicious}
          </span>
          <span className="opsbar__note">Bu oturumda</span>
        </div>
      </section>

      <Panel flush>
        <PanelHeader
          title="Olaylar"
          subtitle={
            live.lastEventAt ? `Son olay ${formatRelative(live.lastEventAt)}` : undefined
          }
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
            icon={isConnected ? 'pulse' : 'plug'}
            title={
              live.events.length === 0
                ? isConnected
                  ? 'Olay bekleniyor'
                  : 'Canlı akış bağlı değil'
                : 'Bu filtreyle eşleşen olay yok'
            }
            message={
              live.events.length === 0
                ? isConnected
                  ? 'Bağlantı kuruldu. Yeni bir işlem işlendiğinde burada anında görünecek.'
                  : 'Bağlantı yeniden kurulduğunda olaylar otomatik olarak akmaya başlar.'
                : 'Seçtiğiniz durumda henüz bir olay alınmadı.'
            }
            action={
              !isConnected && (
                <Button size="sm" icon="refresh" onClick={live.reconnect}>
                  Yeniden bağlan
                </Button>
              )
            }
          />
        ) : (
          <LiveFeed events={filtered} onInspect={setInspected} />
        )}

        <PanelFooter>
          <span>En fazla son 60 olay bellekte tutulur</span>
          <span>{filtered.length} olay</span>
        </PanelFooter>
      </Panel>

      <Notice icon="info">
        Bu sayfadaki sayaçlar ve olaylar yalnızca <strong>mevcut tarayıcı oturumuna</strong>{' '}
        aittir; sayfa yenilendiğinde sıfırlanır ve kalıcı geçmiş verisini temsil etmez.
        Kalıcı kayıtlar için dolandırıcılık izleme sayfasını kullanın.
      </Notice>

      <InvestigationDrawer
        transaction={inspected}
        open={Boolean(inspected)}
        onClose={() => setInspected(null)}
      />
    </div>
  );
}

export default StreamPage;
