import Icon from '../ui/Icon.jsx';
import { Button } from '../ui/primitives.jsx';
import { ConnectionState } from '../../hooks/useLiveStream.js';
import { HealthStatus } from '../../lib/domain.js';
import { formatRelative } from '../../lib/format.js';

/**
 * Operasyon şeridi — sayfanın en üstünde, tek bakışta durum.
 *
 * Dört ayrı kart yerine tek, bölümlenmiş bir yüzey kullanılır.
 * Soldaki birincil hücre "genel duruş" sorusuna cevap verir; kalan hücreler
 * onu destekleyen sayısal bağlamı verir.
 *
 * Kritik kural: WebSocket'ten türeyen sayaçlar "oturum" olarak etiketlenir,
 * asla geçmiş toplam gibi sunulmaz.
 */

/** Duruş, sağlık ve kritik uyarı sayısından türetilir. */
function derivePosture({ health, criticalCount, suspiciousCount, connection }) {
  if (health === HealthStatus.UNHEALTHY) {
    return {
      tone: 'danger',
      glyph: 'xCircle',
      headline: 'Sistem hizmet dışı',
      detail: 'Bağımlı servislerin tümü yanıt vermiyor.',
    };
  }

  if (criticalCount > 0) {
    return {
      tone: 'danger',
      glyph: 'shieldAlert',
      headline: `${criticalCount} kritik uyarı`,
      detail: 'Üç kuralı birden ihlal eden işlemler inceleme bekliyor.',
    };
  }

  if (health === HealthStatus.DEGRADED) {
    return {
      tone: 'warn',
      glyph: 'warning',
      headline: 'Sistem bozulmuş durumda',
      detail: 'Bağımlı servislerden biri yanıt vermiyor.',
    };
  }

  if (suspiciousCount > 0) {
    return {
      tone: 'warn',
      glyph: 'shieldAlert',
      headline: `${suspiciousCount} şüpheli işlem`,
      detail: 'İki veya daha fazla kural ihlali tespit edildi.',
    };
  }

  if (connection === ConnectionState.DISCONNECTED) {
    return {
      tone: 'unknown',
      glyph: 'plug',
      headline: 'Canlı akış kesik',
      detail: 'Yeni olaylar gerçek zamanlı olarak alınmıyor.',
    };
  }

  if (health === HealthStatus.UNKNOWN) {
    return {
      tone: 'unknown',
      glyph: 'shield',
      headline: 'Şüpheli aktivite yok',
      detail: 'Sistem sağlığı bu rol için görüntülenemiyor.',
    };
  }

  return {
    tone: 'ok',
    glyph: 'checkCircle',
    headline: 'Normal seyir',
    detail: 'Bilinen kural ihlali yok, servisler sağlıklı.',
  };
}

export function OperationsBar({
  health,
  criticalCount,
  suspiciousCount,
  sessionEvents,
  sessionSuspicious,
  connection,
  lastUpdatedAt,
  onRefresh,
  isRefreshing,
}) {
  const posture = derivePosture({ health, criticalCount, suspiciousCount, connection });

  return (
    <section className="opsbar" data-posture={posture.tone} aria-label="Operasyon durumu">
      <div className="opsbar__cell opsbar__cell--primary">
        <span className="opsbar__label">Genel Durum</span>
        <div className="posture" data-posture={posture.tone}>
          <span className="posture__glyph">
            <Icon name={posture.glyph} size={16} />
          </span>
          <span className="posture__text">
            <span className="posture__headline">{posture.headline}</span>
            <span className="posture__detail">{posture.detail}</span>
          </span>
        </div>
      </div>

      <div className="opsbar__cell">
        <span className="opsbar__label">Açık Şüpheli İşlem</span>
        <span
          className={`opsbar__value ${suspiciousCount > 0 ? 'opsbar__value--danger' : ''}`}
        >
          {suspiciousCount}
          <span className="opsbar__unit">
            {criticalCount > 0 ? `${criticalCount} kritik` : 'kritik yok'}
          </span>
        </span>
        <span className="opsbar__note">API'nin döndürdüğü son 20 kayıt</span>
      </div>

      <div className="opsbar__cell">
        <span className="opsbar__label">Bu Oturumdaki Olay</span>
        <span className="opsbar__value opsbar__value--accent">
          {sessionEvents}
          <span className="opsbar__unit">
            {sessionSuspicious > 0 ? `${sessionSuspicious} şüpheli` : 'şüpheli yok'}
          </span>
        </span>
        <span className="opsbar__note">Canlı akıştan sayıldı, geçmiş toplam değildir</span>
      </div>

      <div className="opsbar__cell">
        <span className="opsbar__label">Aktif Kural Seti</span>
        <span className="opsbar__value">
          3<span className="opsbar__unit">kural</span>
        </span>
        <span className="opsbar__note">Hız · Tutar · İmkansız seyahat</span>
      </div>

      <div className="opsbar__cell opsbar__cell--actions">
        <span className="opsbar__note" style={{ textAlign: 'right' }}>
          {lastUpdatedAt ? `Güncellendi ${formatRelative(lastUpdatedAt)}` : 'Henüz güncellenmedi'}
        </span>
        <Button
          variant="secondary"
          size="sm"
          icon="refresh"
          onClick={onRefresh}
          loading={isRefreshing}
          aria-label="Verileri yenile"
        />
      </div>
    </section>
  );
}

export default OperationsBar;
