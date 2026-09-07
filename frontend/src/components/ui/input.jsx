import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils.js';

/**
 * Form ilkelleri.
 *
 * Girdi yüksekliği ve yarıçapı kabuğun yoğunluğuyla hizalı. Hata durumu
 * yalnızca kenarlık rengiyle değil, kısa bir metinle de bildirilir —
 * renk tek başına erişilebilir bir sinyal değildir.
 */

export const Input = forwardRef(function Input(
  { className, invalid = false, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-9 w-full rounded-sm border bg-bg px-2.5 text-sm text-fg',
        'placeholder:text-fg-subtle',
        'transition-colors outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid
          ? 'border-critical-line focus-visible:outline-critical'
          : 'border-line-strong hover:border-line-interactive',
        className
      )}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select(
  { className, invalid = false, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-9 w-full rounded-sm border bg-bg px-2 text-sm text-fg',
        'transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50',
        invalid ? 'border-critical-line' : 'border-line-strong hover:border-line-interactive',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

/**
 * Etiket + girdi + hata. Yardımcı açıklama metni bilerek desteklenmez;
 * etiket yeterince açık değilse çözüm etiketi düzeltmektir.
 */
export function FormField({ label, error, required = false, children, className }) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={id}
        className="text-2xs font-medium uppercase tracking-[0.07em] text-fg-secondary"
      >
        {label}
        {required && (
          <span className="ml-1 text-critical-fg" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children({ id, invalid: Boolean(error), describedBy: error ? errorId : undefined })}

      {error && (
        <span id={errorId} className="text-2xs text-critical-fg">
          {error}
        </span>
      )}
    </div>
  );
}

/** Tek satırlık uyarı/hata bildirimi. */
export function Notice({ tone = 'info', children, className }) {
  const tones = {
    info: 'border-info-line bg-info-bg text-info-fg',
    warn: 'border-warn-line bg-warn-bg text-warn-fg',
    danger: 'border-critical-line bg-critical-bg text-critical-fg',
    ok: 'border-ok-line bg-ok-bg text-ok-fg',
  };

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-center gap-2 rounded-sm border px-3 py-2 text-xs',
        tones[tone],
        className
      )}
    >
      {children}
    </div>
  );
}
