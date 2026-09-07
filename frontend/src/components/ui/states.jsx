import Icon from './Icon.jsx';
import { Button } from './primitives.jsx';
import { ErrorKind } from '../../lib/api.js';

/* --------------------------------------------------------------------------
   Genel durum bloğu
   -------------------------------------------------------------------------- */

export function StateBlock({
  icon = 'info',
  tone = 'default',
  title,
  message,
  action,
  compact = false,
}) {
  return (
    <div className={`state ${compact ? 'state--compact' : ''}`} role="status">
      <span className={`state__icon ${tone !== 'default' ? `state__icon--${tone}` : ''}`}>
        <Icon name={icon} size={18} />
      </span>
      {title && <p className="state__title">{title}</p>}
      {message && <p className="state__message">{message}</p>}
      {action}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Boş durum
   -------------------------------------------------------------------------- */

export function EmptyState({
  icon = 'inbox',
  title = 'Görüntülenecek kayıt yok',
  message,
  action,
  compact = false,
}) {
  return (
    <StateBlock
      icon={icon}
      title={title}
      message={message}
      action={action}
      compact={compact}
    />
  );
}

/* --------------------------------------------------------------------------
   Hata durumu — ham mesaj yerine anlamlı geri bildirim + yeniden dene
   -------------------------------------------------------------------------- */

const ERROR_COPY = {
  [ErrorKind.NETWORK]: {
    icon: 'plug',
    title: 'Sunucuya ulaşılamıyor',
    message:
      'Fraudio API yanıt vermiyor. Ağ bağlantınızı kontrol edin veya birkaç saniye sonra yeniden deneyin.',
  },
  [ErrorKind.SERVER]: {
    icon: 'warning',
    title: 'Sunucu hatası',
    message: 'İstek işlenirken beklenmeyen bir hata oluştu. Sorun sürerse sistem yöneticisine bildirin.',
  },
  [ErrorKind.UNAVAILABLE]: {
    icon: 'warning',
    title: 'Servis geçici olarak kullanılamıyor',
    message: 'Bağımlı servislerden biri yanıt vermiyor. Sistem sağlığı sayfasından ayrıntıları görebilirsiniz.',
  },
  [ErrorKind.NOT_FOUND]: {
    icon: 'search',
    title: 'Kayıt bulunamadı',
    message: 'Aradığınız kayıt veritabanında mevcut değil.',
  },
  [ErrorKind.VALIDATION]: {
    icon: 'warning',
    title: 'Geçersiz istek',
    message: 'Gönderilen bilgiler doğrulanamadı.',
  },
};

export function ErrorState({ error, onRetry, compact = false }) {
  const copy = ERROR_COPY[error?.kind] ?? {
    icon: 'warning',
    title: 'Veri yüklenemedi',
    message: 'İstek tamamlanamadı. Lütfen yeniden deneyin.',
  };

  // Backend anlamlı bir mesaj döndürdüyse (ör. 404 gövdesi) onu tercih ederiz.
  const message =
    error?.code && error?.message ? error.message : copy.message;

  return (
    <StateBlock
      icon={copy.icon}
      tone="danger"
      title={copy.title}
      message={message}
      compact={compact}
      action={
        onRetry && (
          <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
            Yeniden dene
          </Button>
        )
      }
    />
  );
}

/* --------------------------------------------------------------------------
   Yetkisiz durum — RBAC engeli, hata değil
   -------------------------------------------------------------------------- */

export function ForbiddenState({
  message = 'Bu bölüm yalnızca Yönetici rolüne sahip kullanıcılar tarafından görüntülenebilir.',
  compact = false,
}) {
  return (
    <StateBlock
      icon="lock"
      tone="warn"
      title="Erişim yetkiniz yok"
      message={message}
      compact={compact}
    />
  );
}

/* --------------------------------------------------------------------------
   İskelet yükleyiciler
   -------------------------------------------------------------------------- */

export function SkeletonText({ width = '100%', height = 10 }) {
  return <span className="skeleton skeleton--text" style={{ width, height, display: 'block' }} />;
}

/** Tablo biçiminde iskelet — gerçek yerleşimi taklit eder, zıplama olmaz. */
export function SkeletonTable({ rows = 6, columns = 5 }) {
  return (
    <div aria-busy="true" aria-label="Yükleniyor">
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: 'var(--sp-3)',
            padding: 'var(--sp-3) var(--sp-4)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {Array.from({ length: columns }, (_, c) => (
            <SkeletonText
              key={c}
              width={c === 0 ? '70%' : c === columns - 1 ? '45%' : '85%'}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Liste biçiminde iskelet. */
export function SkeletonList({ rows = 5 }) {
  return (
    <div aria-busy="true" aria-label="Yükleniyor">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-3)',
            padding: 'var(--sp-3) var(--sp-4)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <SkeletonText width="52px" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SkeletonText width="45%" />
            <SkeletonText width="28%" height={8} />
          </div>
          <SkeletonText width="72px" />
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------------
   AsyncBoundary — tüm veri durumlarını tek yerde çözer
   -------------------------------------------------------------------------- */

/**
 * Veri kaynağının durumuna göre doğru UI'ı seçer.
 *
 * @param {object} resource   useApiResource dönüşü
 * @param {boolean} isEmpty   veri var ama boş mu
 * @param {node} skeleton     ilk yükleme görseli
 * @param {node} empty        boş durum görseli
 * @param {function} children (data) => node
 */
export function AsyncBoundary({
  resource,
  isEmpty = false,
  skeleton = <SkeletonList />,
  empty = <EmptyState />,
  forbidden,
  compact = false,
  children,
}) {
  const { status, data, error, retry, isRefreshing } = resource;

  if (status === 'loading' || (status === 'idle' && data === null)) {
    return skeleton;
  }

  if (status === 'forbidden') {
    return forbidden ?? <ForbiddenState compact={compact} />;
  }

  // Hata olsa bile elimizde eski veri varsa onu göstermeye devam ederiz;
  // kullanıcı boş ekranla karşılaşmaz (kısmi durum).
  if (status === 'error' && data === null) {
    return <ErrorState error={error} onRetry={retry} compact={compact} />;
  }

  if (isEmpty) {
    return empty;
  }

  return (
    <div className={isRefreshing ? 'is-refreshing' : undefined}>
      {children(data)}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Bayat veri uyarısı — yenileme başarısız olduğunda
   -------------------------------------------------------------------------- */

export function StaleBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="notice notice--warn" role="status">
      <Icon name="warning" size={13} className="notice__icon" />
      <span style={{ flex: 1 }}>
        Veriler güncellenemedi; ekranda son başarılı sonuç gösteriliyor.
      </span>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Yenile
        </Button>
      )}
    </div>
  );
}
