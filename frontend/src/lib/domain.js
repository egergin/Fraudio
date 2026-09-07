/**
 * Alan yardımcıları — dolandırıcılık kuralları, şiddet ve durum eşlemeleri.
 *
 * Buradaki her şey backend'in gerçekten döndürdüğü alanlardan türetilir:
 *   triggeredRules: ('Velocity' | 'Amount' | 'Location')[]
 *   status:         'Approved' | 'Suspicious' | 'Received'
 * Uydurma alan veya skor yoktur.
 */

/* --------------------------------------------------------------------------
   Dolandırıcılık kuralları — backend/docs/fraud-rules.md ile hizalı
   -------------------------------------------------------------------------- */

export const RULES = Object.freeze({
  Velocity: {
    key: 'velocity',
    label: 'Hız',
    fullLabel: 'Hız Kuralı',
    description: 'Kullanıcı 1 dakika içinde 5\'ten fazla işlem başlattı.',
    chipClass: 'chip--velocity',
    color: '#a855f7',
  },
  Amount: {
    key: 'amount',
    label: 'Tutar',
    fullLabel: 'Tutar Kuralı',
    description: 'Tutar, kullanıcının son 24 saatlik ortalamasının 3 katını aştı.',
    chipClass: 'chip--amount',
    color: '#f59e0b',
  },
  Location: {
    key: 'location',
    label: 'Konum',
    fullLabel: 'İmkansız Seyahat',
    description: 'Önceki konuma göre gereken hız 800 km/sa sınırını aştı.',
    chipClass: 'chip--location',
    color: '#38bdf8',
  },
});

export const RULE_ORDER = ['Velocity', 'Amount', 'Location'];

/** Bilinmeyen kural adları için güvenli geri dönüş. */
export function describeRule(rule) {
  if (!rule) return null;
  const direct = RULES[rule];
  if (direct) return direct;
  const match = Object.values(RULES).find(
    (r) => r.key === String(rule).toLowerCase()
  );
  return (
    match ?? {
      key: String(rule).toLowerCase(),
      label: String(rule),
      fullLabel: String(rule),
      description: 'Bu kural için açıklama mevcut değil.',
      chipClass: '',
      color: '#64748b',
    }
  );
}

/* --------------------------------------------------------------------------
   Şiddet — yalnızca tetiklenen kural sayısından türetilir.
   Karar matrisi: 0–1 ihlal → Onaylandı, 2–3 ihlal → Şüpheli.
   -------------------------------------------------------------------------- */

export const Severity = Object.freeze({
  NONE: 'none',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

/**
 * @param {string[]} triggeredRules
 * @param {string} status
 */
export function severityOf(triggeredRules = [], status = '') {
  const count = Array.isArray(triggeredRules) ? triggeredRules.length : 0;
  if (count >= 3) return Severity.HIGH;
  if (count === 2) return Severity.MEDIUM;
  if (count === 1) return Severity.LOW;
  return String(status).toLowerCase() === 'suspicious' ? Severity.MEDIUM : Severity.NONE;
}

export const SEVERITY_META = Object.freeze({
  [Severity.HIGH]: {
    label: 'Kritik',
    badgeClass: 'badge--danger',
    rank: 3,
    headline: 'Üç kural birden ihlal edildi',
  },
  [Severity.MEDIUM]: {
    label: 'Yüksek',
    badgeClass: 'badge--danger',
    rank: 2,
    headline: 'İki kural ihlal edildi',
  },
  [Severity.LOW]: {
    label: 'Düşük',
    badgeClass: 'badge--warn',
    rank: 1,
    headline: 'Tek kural ihlali — işlem onaylandı',
  },
  [Severity.NONE]: {
    label: 'Normal',
    badgeClass: 'badge--ok',
    rank: 0,
    headline: 'Kural ihlali yok',
  },
});

export function severityMeta(severity) {
  return SEVERITY_META[severity] ?? SEVERITY_META[Severity.NONE];
}

/* --------------------------------------------------------------------------
   İşlem durumu
   -------------------------------------------------------------------------- */

export const STATUS_META = Object.freeze({
  suspicious: { label: 'Şüpheli', badgeClass: 'badge--danger' },
  approved: { label: 'Onaylandı', badgeClass: 'badge--ok' },
  received: { label: 'Alındı', badgeClass: 'badge--accent' },
});

export function statusMeta(status) {
  return (
    STATUS_META[String(status).toLowerCase()] ?? {
      label: status || 'Bilinmiyor',
      badgeClass: 'badge--neutral',
    }
  );
}

/* --------------------------------------------------------------------------
   Sistem sağlığı
   -------------------------------------------------------------------------- */

export const HealthStatus = Object.freeze({
  HEALTHY: 'healthy',
  UNHEALTHY: 'unhealthy',
  DEGRADED: 'degraded',
  UNKNOWN: 'unknown',
});

/** Backend 'Healthy' | 'Unhealthy' döndürür; başka bir şey gelirse bilinmiyor. */
export function normalizeHealth(value) {
  const v = String(value ?? '').toLowerCase();
  if (v === 'healthy') return HealthStatus.HEALTHY;
  if (v === 'unhealthy') return HealthStatus.UNHEALTHY;
  if (v === 'degraded') return HealthStatus.DEGRADED;
  return HealthStatus.UNKNOWN;
}

export const HEALTH_META = Object.freeze({
  [HealthStatus.HEALTHY]: { label: 'Sağlıklı', badgeClass: 'badge--ok' },
  [HealthStatus.UNHEALTHY]: { label: 'Hatalı', badgeClass: 'badge--danger' },
  [HealthStatus.DEGRADED]: { label: 'Bozulmuş', badgeClass: 'badge--warn' },
  [HealthStatus.UNKNOWN]: { label: 'Bilinmiyor', badgeClass: 'badge--neutral' },
});

export function healthMeta(status) {
  return HEALTH_META[status] ?? HEALTH_META[HealthStatus.UNKNOWN];
}

/**
 * /api/system/health yanıtını (postgreSql, redis, rabbitMq) hizmet
 * tanımlarıyla birleştirir. Yalnızca backend'in döndürdüğü üç anahtar.
 */
export const SERVICE_DEFS = Object.freeze([
  {
    field: 'postgreSql',
    name: 'PostgreSQL',
    role: 'Birincil doğruluk kaynağı — işlemler ve denetim kayıtları',
  },
  {
    field: 'redis',
    name: 'Redis',
    role: 'Gerçek zamanlı durum — kayar pencere sayaçları ve konum önbelleği',
  },
  {
    field: 'rabbitMq',
    name: 'RabbitMQ',
    role: 'Mesaj aracısı — asenkron işlem alımı ve yeniden deneme',
  },
]);

/** Genel duruş: hepsi sağlıklı → ok, bazıları hatalı → degraded, hepsi → danger. */
export function overallHealth(services) {
  if (!services || services.length === 0) return HealthStatus.UNKNOWN;
  const bad = services.filter((s) => s.status === HealthStatus.UNHEALTHY).length;
  const unknown = services.filter((s) => s.status === HealthStatus.UNKNOWN).length;
  if (bad === 0 && unknown === 0) return HealthStatus.HEALTHY;
  if (bad === services.length) return HealthStatus.UNHEALTHY;
  if (bad > 0) return HealthStatus.DEGRADED;
  return HealthStatus.UNKNOWN;
}

/* --------------------------------------------------------------------------
   Roller — backend RBAC'ı birebir yansıtır (değiştirilmez)
   -------------------------------------------------------------------------- */

export const Role = Object.freeze({ ADMIN: 'Admin', ANALYST: 'Analyst' });

export function isAdmin(role) {
  return String(role ?? '').toLowerCase() === 'admin';
}

export function roleLabel(role) {
  if (isAdmin(role)) return 'Yönetici';
  if (String(role ?? '').toLowerCase() === 'analyst') return 'Analist';
  return role || 'Bilinmiyor';
}
