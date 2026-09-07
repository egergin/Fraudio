import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils.js';

/**
 * Araç çubuğu ilkelleri.
 *
 * Filtreler kutulanmış bir "filtre kartı" içinde değil, içeriğin hemen
 * üstünde ince bir şeritte durur.
 */

export function Toolbar({ className, children }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5', className)}>
      {children}
    </div>
  );
}

/**
 * Bölümlü seçici. Sekme değil — bir listeyi daraltan filtre.
 * Sayaçlar etiketin parçasıdır; ayrı rozet kullanılmaz.
 */
export function Segmented({ label, options, value, onChange, className }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex items-center gap-px rounded-sm bg-elevated p-0.5', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              'flex items-center gap-1.5 rounded-xs px-2 py-1 text-2xs font-medium transition-colors',
              active
                ? 'bg-active text-fg'
                : 'text-fg-muted hover:text-fg-secondary'
            )}
          >
            {opt.label}
            {typeof opt.count === 'number' && (
              <span
                className={cn(
                  'tnum text-3xs',
                  active ? 'text-fg-secondary' : 'text-fg-subtle'
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Ara', label = 'Ara', className }) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <Search
        className="pointer-events-none absolute left-2 size-3.5 text-fg-subtle"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={cn(
          'h-7 w-full rounded-sm border border-line-strong bg-bg pl-7 pr-7 text-xs text-fg',
          'placeholder:text-fg-subtle transition-colors outline-none',
          'hover:border-line-interactive',
          '[&::-webkit-search-cancel-button]:appearance-none'
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Aramayı temizle"
          className="absolute right-1.5 text-fg-subtle transition-colors hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
