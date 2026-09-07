import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { describeRule } from '@/lib/domain.js';
import { truncateId } from '@/lib/format.js';

/**
 * Tetiklenen kural etiketi.
 *
 * Kutu değil: renkli nokta + kelime. Üç kural yan yana geldiğinde satırı
 * rozet duvarına çevirmemesi için bilerek kenarlıksız.
 */
export function RuleTag({ rule }) {
  const meta = describeRule(rule);
  if (!meta) return null;

  const color = {
    velocity: 'text-rule-velocity',
    amount: 'text-rule-amount',
    location: 'text-rule-location',
  }[meta.key] ?? 'text-fg-muted';

  return (
    <span
      className={cn('inline-flex items-center gap-1 text-2xs whitespace-nowrap', color)}
      title={meta.description}
    >
      <span className="size-1 shrink-0 rounded-full bg-current" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/** Kural listesi; boşsa görsel olarak sessiz kalır. */
export function RuleTags({ rules, className }) {
  if (!Array.isArray(rules) || rules.length === 0) {
    return <span className="text-2xs text-fg-subtle">—</span>;
  }
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      {rules.map((rule) => (
        <RuleTag key={rule} rule={rule} />
      ))}
    </span>
  );
}

/** Kopyalanabilir teknik tanımlayıcı. Monospace burada gerçekten yardımcı. */
export function CopyableId({ value, truncate = true, className }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!value) return <span className="text-fg-subtle">—</span>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* pano yoksa sessizce geç */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={String(value)}
      aria-label={`Kimliği kopyala: ${value}`}
      className={cn(
        'group inline-flex max-w-full items-center gap-1.5 rounded-xs font-mono text-2xs',
        'text-fg-muted transition-colors hover:text-fg',
        className
      )}
    >
      <span className="truncate">{truncate ? truncateId(value) : value}</span>
      {copied ? (
        <Check className="size-3 shrink-0 text-ok-fg" aria-hidden="true" />
      ) : (
        <Copy
          className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

/** Etiket → değer satırı. Tanım listesi, kart değil. */
export function Field({ label, children, mono = false, className }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <dt className="text-3xs font-medium uppercase tracking-[0.08em] text-fg-subtle">
        {label}
      </dt>
      <dd className={cn('min-w-0 truncate text-sm text-fg', mono && 'font-mono tnum')}>
        {children}
      </dd>
    </div>
  );
}
