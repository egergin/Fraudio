import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils.js';

/* ==========================================================================
   Yapısal ilkeller

   Section bir kart DEĞİLDİR: kutu yok, yalnızca bir başlık kuralı ve içerik.
   Gruplama tipografi, boşluk ve tek bir ince çizgiyle yapılır.
   Kart (Panel) yalnızca gerçekten yükseltilmesi gereken yüzeyler içindir.
   ========================================================================== */

export function Section({ className, children, ...props }) {
  return (
    <section className={cn('flex min-w-0 flex-col', className)} {...props}>
      {children}
    </section>
  );
}

/**
 * Bölüm başlığı. Bilerek `subtitle` almaz — açıklama cümlesi bu arayüzde
 * yer tutmaz. Sayaç başlığın parçasıdır, ayrı bir rozet değil.
 */
export function SectionHeader({
  title,
  count,
  meta,
  actions,
  as: Heading = 'h2',
  className,
  id,
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b border-line-strong pb-2',
        className
      )}
    >
      <Heading
        id={id}
        className="text-2xs font-semibold uppercase tracking-[0.09em] text-fg-secondary whitespace-nowrap"
      >
        {title}
      </Heading>
      {typeof count === 'number' && (
        <span className="text-2xs font-semibold tnum text-fg-muted">{count}</span>
      )}
      {meta && (
        <span className="truncate text-2xs text-fg-subtle">{meta}</span>
      )}
      {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
    </div>
  );
}

/** Bölüm içi tek satırlık operasyonel not. Paragraf değil. */
export function SectionNote({ className, children }) {
  return (
    <p className={cn('pt-2.5 text-2xs text-fg-subtle', className)}>{children}</p>
  );
}

/**
 * Panel — gerçekten yükseltilmiş yüzey. Seçici kullanılır: form,
 * çekmece içeriği, açılır menü. Bölümler için Section tercih edilir.
 */
export function Panel({ className, children, ...props }) {
  return (
    <div
      className={cn(
        'rounded-md border border-line bg-surface shadow-panel',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ==========================================================================
   Durum göstergeleri
   ========================================================================== */

const dotVariants = cva('relative inline-block size-1.5 shrink-0 rounded-full', {
  variants: {
    tone: {
      live: 'bg-live text-live',
      ok: 'bg-ok text-ok',
      warn: 'bg-warn text-warn',
      critical: 'bg-critical text-critical',
      info: 'bg-info text-info',
      idle: 'bg-idle text-idle',
    },
  },
  defaultVariants: { tone: 'idle' },
});

/** Durum noktası + etiket. Rozet değil — hizalanmış listelerde okunur. */
export function StatusDot({ tone, label, pulse = false, className }) {
  const toneText = {
    live: 'text-live-fg',
    ok: 'text-ok-fg',
    warn: 'text-warn-fg',
    critical: 'text-critical-fg',
    info: 'text-info-fg',
    idle: 'text-fg-muted',
  }[tone ?? 'idle'];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs whitespace-nowrap',
        toneText,
        className
      )}
    >
      <span className={cn(dotVariants({ tone }), pulse && 'pulse-dot')} aria-hidden="true" />
      {label}
    </span>
  );
}

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-3xs font-semibold uppercase tracking-[0.04em] whitespace-nowrap',
  {
    variants: {
      tone: {
        ok: 'border-ok-line bg-ok-bg text-ok-fg',
        warn: 'border-warn-line bg-warn-bg text-warn-fg',
        critical: 'border-critical-line bg-critical-bg text-critical-fg',
        live: 'border-live-line bg-live-bg text-live-fg',
        info: 'border-info-line bg-info-bg text-info-fg',
        idle: 'border-idle-line bg-idle-bg text-idle-fg',
      },
    },
    defaultVariants: { tone: 'idle' },
  }
);

export function Badge({ tone, className, children, ...props }) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {children}
    </span>
  );
}

/**
 * Satır içi metrik: değer önde, etiket arkada. Kart değildir.
 * Yoğun özet şeritlerinde yan yana dizilir.
 */
export function InlineMetric({ value, label, tone = 'default', className }) {
  const toneClass = {
    default: 'text-fg',
    live: 'text-live-fg',
    warn: 'text-warn-fg',
    critical: 'text-critical-fg',
    muted: 'text-fg-muted',
  }[tone];

  return (
    <span className={cn('inline-flex items-baseline gap-1.5 whitespace-nowrap', className)}>
      <span className={cn('text-md font-semibold tnum', toneClass)}>{value}</span>
      <span className="text-2xs text-fg-muted">{label}</span>
    </span>
  );
}

/** Şiddeti taşıyan dikey kenar çubuğu — tablo satırının başında. */
export function SeverityBar({ severity, className }) {
  const bg = {
    high: 'bg-critical',
    medium: 'bg-warn',
    low: 'bg-idle',
    none: 'bg-ok',
  }[severity ?? 'none'];

  return <span className={cn('block w-0.5 self-stretch', bg, className)} aria-hidden="true" />;
}
