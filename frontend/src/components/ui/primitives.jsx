import { forwardRef, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import {
  describeRule,
  severityMeta,
  statusMeta,
  healthMeta,
} from '../../lib/domain.js';
import { truncateId } from '../../lib/format.js';

/* --------------------------------------------------------------------------
   Buton
   -------------------------------------------------------------------------- */

export const Button = forwardRef(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon,
    iconRight,
    loading = false,
    block = false,
    children,
    className = '',
    type = 'button',
    ...rest
  },
  ref
) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size !== 'md' ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    !children ? 'btn--icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button ref={ref} type={type} className={classes} data-loading={loading} {...rest}>
      {loading ? (
        <span className="btn__spinner" aria-hidden="true" />
      ) : (
        icon && <Icon name={icon} size={size === 'sm' ? 13 : 15} />
      )}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={size === 'sm' ? 13 : 15} />}
    </button>
  );
});

/* --------------------------------------------------------------------------
   Panel
   -------------------------------------------------------------------------- */

export function Panel({ children, flush = false, className = '', ...rest }) {
  return (
    <section
      className={`panel ${flush ? 'panel--flush' : ''} ${className}`}
      {...rest}
    >
      {children}
    </section>
  );
}

export function PanelHeader({ title, subtitle, actions, id }) {
  return (
    <header className="panel__header">
      <div className="panel__titles">
        <h2 className="panel__title" id={id}>
          {title}
        </h2>
        {subtitle && <span className="panel__subtitle truncate">{subtitle}</span>}
      </div>
      {actions && <div className="panel__actions">{actions}</div>}
    </header>
  );
}

export function PanelBody({ children, flush = false, className = '', ...rest }) {
  return (
    <div className={`panel__body ${flush ? 'panel__body--flush' : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function PanelFooter({ children }) {
  return <footer className="panel__footer">{children}</footer>;
}

/* --------------------------------------------------------------------------
   Rozetler
   -------------------------------------------------------------------------- */

export function Badge({ tone = 'neutral', icon, children, className = '', ...rest }) {
  return (
    <span className={`badge badge--${tone} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={11} />}
      {children}
    </span>
  );
}

/** İşlem durumu rozeti — Approved / Suspicious / Received. */
export function StatusBadge({ status }) {
  const meta = statusMeta(status);
  return <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>;
}

/** Şiddet rozeti — tetiklenen kural sayısından türetilir. */
export function SeverityBadge({ severity }) {
  const meta = severityMeta(severity);
  return <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>;
}

/** Tetiklenen tek bir kural çipi. */
export function RuleChip({ rule, full = false }) {
  const meta = describeRule(rule);
  if (!meta) return null;
  return (
    <span className={`chip ${meta.chipClass}`} title={meta.description}>
      {full ? meta.fullLabel : meta.label}
    </span>
  );
}

/** Kural çipi listesi; boşsa görsel olarak sessiz kalır. */
export function RuleChips({ rules, full = false, emptyLabel = '—' }) {
  if (!Array.isArray(rules) || rules.length === 0) {
    return <span className="table__cell-muted">{emptyLabel}</span>;
  }
  return (
    <span className="row row--wrap" style={{ gap: 'var(--sp-1)' }}>
      {rules.map((rule) => (
        <RuleChip key={rule} rule={rule} full={full} />
      ))}
    </span>
  );
}

/** Şiddet düzeyini gösteren dikey renk çubuğu (tablo satırı başında). */
export function SeverityBar({ severity }) {
  const meta = severityMeta(severity);
  return (
    <span
      className="sev-bar"
      data-sev={severity}
      role="img"
      aria-label={`Şiddet: ${meta.label}`}
    />
  );
}

/** Sağlık durumu rozeti. */
export function HealthBadge({ status }) {
  const meta = healthMeta(status);
  return <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>;
}

/* --------------------------------------------------------------------------
   Kopyalanabilir tanımlayıcı
   -------------------------------------------------------------------------- */

export function CopyableId({ value, truncate = true, label = 'Kimliği kopyala' }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!value) return <span className="table__cell-muted">—</span>;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* pano kullanılamıyorsa sessizce geç */
    }
  };

  return (
    <button
      type="button"
      className="copyable"
      onClick={handleCopy}
      title={String(value)}
      aria-label={`${label}: ${value}`}
    >
      <span className="truncate">{truncate ? truncateId(value) : value}</span>
      <Icon
        name={copied ? 'check' : 'copy'}
        size={11}
        className="copyable__icon"
        style={copied ? { opacity: 1, color: 'var(--ok-text)' } : undefined}
      />
    </button>
  );
}

/* --------------------------------------------------------------------------
   Bilgi notu
   -------------------------------------------------------------------------- */

export function Notice({ tone = 'default', icon = 'info', children }) {
  return (
    <p className={`notice ${tone !== 'default' ? `notice--${tone}` : ''}`}>
      <Icon name={icon} size={13} className="notice__icon" />
      <span>{children}</span>
    </p>
  );
}

/* --------------------------------------------------------------------------
   Tanım listesi
   -------------------------------------------------------------------------- */

export function DescriptionList({ items, columns = 2 }) {
  return (
    <dl
      className="dl"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map(({ term, value, key }) => (
        <div className="dl__item" key={key ?? term}>
          <dt className="dl__term">{term}</dt>
          <dd className="dl__desc">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* --------------------------------------------------------------------------
   Segmentli filtre denetimi
   -------------------------------------------------------------------------- */

export function Segmented({ options, value, onChange, ariaLabel }) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__item"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {typeof option.count === 'number' && (
            <span className="segmented__count">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
