import { Button } from './button.jsx';
import { cn } from '@/lib/utils.js';
import { ErrorKind } from '@/lib/api.js';

/* ==========================================================================
   Durum bloğu

   Kural: boş/hata/yetkisiz durumlar tek satırdır. Kullanıcının zaten
   anladığı şeyi paragrafla açıklamayız.
   ========================================================================== */

export function StateBlock({ tone = 'default', title, message, action, className }) {
  const toneClass = {
    default: 'text-fg-muted',
    danger: 'text-critical-fg',
    warn: 'text-warn-fg',
  }[tone];

  return (
    <div
      role="status"
      className={cn('flex flex-col items-start gap-2.5 py-6', className)}
    >
      <p className={cn('text-sm', toneClass)}>{title}</p>
      {message && <p className="max-w-[52ch] text-xs text-fg-subtle">{message}</p>}
      {action}
    </div>
  );
}

export function EmptyState({ title = 'Kayıt yok', message, action, className }) {
  return <StateBlock title={title} message={message} action={action} className={className} />;
}

/** Hata başlıkları kısa ve eyleme dönük. İkinci cümle yok. */
const ERROR_TITLES = {
  [ErrorKind.NETWORK]: 'Sunucuya ulaşılamıyor',
  [ErrorKind.SERVER]: 'Sunucu hatası',
  [ErrorKind.UNAVAILABLE]: 'Servis kullanılamıyor',
  [ErrorKind.NOT_FOUND]: 'Kayıt bulunamadı',
  [ErrorKind.VALIDATION]: 'Geçersiz istek',
  [ErrorKind.UNAUTHORIZED]: 'Oturum geçersiz',
  [ErrorKind.FORBIDDEN]: 'Yetkiniz yok',
};

export function ErrorState({ error, onRetry, className }) {
  return (
    <StateBlock
      tone="danger"
      title={ERROR_TITLES[error?.kind] ?? 'Yüklenemedi'}
      className={className}
      action={
        onRetry && (
          <Button size="sm" onClick={onRetry}>
            Yeniden dene
          </Button>
        )
      }
    />
  );
}

/** RBAC engeli — hata değil, bir yetki durumu. */
export function ForbiddenState({ message, className }) {
  return (
    <StateBlock tone="warn" title="Yetkiniz yok" message={message} className={className} />
  );
}

/* ==========================================================================
   İskeletler — gerçek yerleşimi taklit eder, içerik gelince zıplama olmaz
   ========================================================================== */

function Bar({ className }) {
  return <span className={cn('shimmer block h-2.5 rounded-xs', className)} />;
}

export function SkeletonRows({ rows = 5, className }) {
  return (
    <div aria-busy="true" aria-label="Yükleniyor" className={className}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-line py-2.5">
          <Bar className="w-12" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Bar className="w-2/5" />
            <Bar className="h-2 w-1/4" />
          </div>
          <Bar className="w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, columns = 5 }) {
  return (
    <div aria-busy="true" aria-label="Yükleniyor">
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="grid gap-3 border-b border-line py-2.5"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, c) => (
            <Bar key={c} className={c === 0 ? 'w-3/5' : c === columns - 1 ? 'w-2/5' : 'w-4/5'} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ==========================================================================
   AsyncBoundary — tüm veri durumlarını tek yerde çözer
   ========================================================================== */

/**
 * @param {object}   resource  useApiResource dönüşü
 * @param {boolean}  isEmpty   veri var ama boş mu
 * @param {node}     skeleton  ilk yükleme görseli
 * @param {node}     empty     boş durum
 * @param {function} children  (data) => node
 */
export function AsyncBoundary({
  resource,
  isEmpty = false,
  skeleton = <SkeletonRows />,
  empty = <EmptyState />,
  forbidden,
  children,
}) {
  const { status, data, error, retry, isRefreshing } = resource;

  if (status === 'loading' || (status === 'idle' && data === null)) return skeleton;
  if (status === 'forbidden') return forbidden ?? <ForbiddenState />;

  // Hata olsa bile elimizde eski veri varsa onu göstermeye devam ederiz.
  if (status === 'error' && data === null) {
    return <ErrorState error={error} onRetry={retry} />;
  }

  if (isEmpty) return empty;

  return (
    <div className={isRefreshing ? 'opacity-60 transition-opacity' : undefined}>
      {children(data)}
    </div>
  );
}

/** Yenileme başarısız oldu ama ekranda eski veri duruyor. */
export function StaleBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-sm border border-warn-line bg-warn-bg px-3 py-2 text-xs text-warn-fg"
    >
      <span className="flex-1">Güncellenemedi — son alınan sonuç gösteriliyor</span>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Yenile
        </Button>
      )}
    </div>
  );
}
