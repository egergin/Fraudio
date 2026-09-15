// Uygulama görüntüleme standardı: Europe/Istanbul.
// Depolama UTC kalır; TÜM gün/saat yorumları (bucket, sınır, etiket, format)
// bu bölgede yapılır. Türkiye'de yaz/kış saati yok (sabit UTC+3), bu yüzden
// sabit ofset deterministiktir.
export const APP_TIME_ZONE = 'Europe/Istanbul';
export const APP_TZ_OFFSET_MS = 3 * 3600_000;

export const HOUR_MS = 3600_000;
export const DAY_MS = 24 * HOUR_MS;

export function toMs(iso) {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Bölge duvar saatinin parçaları (Pazartesi-ilk gün indeksi dahil). */
export function zonedParts(ms) {
  const d = new Date(ms + APP_TZ_OFFSET_MS);
  return {
    dayIdx: (d.getUTCDay() + 6) % 7,
    date: d.getUTCDate(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
  };
}

export function dayStartMs(nowMs) {
  const d = new Date(nowMs + APP_TZ_OFFSET_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - APP_TZ_OFFSET_MS;
}

export function mondayStartMs(nowMs) {
  const d = new Date(nowMs + APP_TZ_OFFSET_MS);
  const dowMon = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dowMon) - APP_TZ_OFFSET_MS;
}

export function periodRange(id, nowMs = Date.now()) {
  switch (id) {
    case 'hour':
      return { from: new Date(nowMs - HOUR_MS).toISOString() };
    case 'three':
      return { from: new Date(nowMs - 3 * HOUR_MS).toISOString() };
    case 'day':
      return { from: new Date(nowMs - DAY_MS).toISOString() };
    case 'week':
      return { from: new Date(nowMs - 7 * DAY_MS).toISOString() };
    case 'month':
      return { from: new Date(nowMs - 30 * DAY_MS).toISOString() };
    default:
      return {};
  }
}

export function periodSpanMs(id) {
  switch (id) {
    case 'hour':
      return HOUR_MS;
    case 'three':
      return 3 * HOUR_MS;
    case 'day':
      return DAY_MS;
    case 'week':
      return 7 * DAY_MS;
    case 'month':
      return 30 * DAY_MS;
    default:
      return null;
  }
}
