/**
 * Biçimlendirme yardımcıları — tek kaynak, tutarlı sayı/tarih gösterimi.
 */

const LOCALE = 'tr-TR';

const currencyFmt = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactCurrencyFmt = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'TRY',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const numberFmt = new Intl.NumberFormat(LOCALE);

const timeFmt = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const shortTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
});

const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const relativeFmt = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

/** Güvenli Date dönüşümü — geçersiz girdide null. */
export function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatCurrency(value) {
  const n = Number(value);
  return Number.isFinite(n) ? currencyFmt.format(n) : '—';
}

export function formatCompactCurrency(value) {
  const n = Number(value);
  return Number.isFinite(n) ? compactCurrencyFmt.format(n) : '—';
}

export function formatNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? numberFmt.format(n) : '—';
}

export function formatPercent(value, digits = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? `%${n.toFixed(digits)}` : '—';
}

export function formatTime(value) {
  const date = toDate(value);
  return date ? timeFmt.format(date) : '—';
}

export function formatShortTime(value) {
  const date = toDate(value);
  return date ? shortTimeFmt.format(date) : '—';
}

export function formatDateTime(value) {
  const date = toDate(value);
  return date ? dateTimeFmt.format(date) : '—';
}

/** "3 dakika önce" biçiminde göreli zaman. */
export function formatRelative(value, now = Date.now()) {
  const date = toDate(value);
  if (!date) return '—';

  const diffSec = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(diffSec);

  if (abs < 10) return 'az önce';
  if (abs < 60) return relativeFmt.format(Math.round(diffSec), 'second');
  if (abs < 3600) return relativeFmt.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return relativeFmt.format(Math.round(diffSec / 3600), 'hour');
  return relativeFmt.format(Math.round(diffSec / 86400), 'day');
}

/** Uzun tanımlayıcıları kısaltır: 550e8400…40000 */
export function truncateId(value, head = 8, tail = 4) {
  const s = String(value ?? '');
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

/** Şehir + ülke birleşimi; 'Unknown' backend değeri gizlenir. */
export function formatLocation(city, country) {
  const c = city && city !== 'Unknown' ? city : null;
  const k = country && country !== 'Unknown' ? country : null;
  if (c && k) return `${c}, ${k}`;
  return c || k || 'Bilinmiyor';
}

/** Kullanıcı kimliğinden baş harf üretir (avatar için). */
export function initials(value) {
  const s = String(value ?? '').trim();
  if (!s) return '?';
  const parts = s.split(/[\s\-_.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}
