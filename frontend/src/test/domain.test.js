import { describe, expect, it } from 'vitest';
import {
  HealthStatus,
  Severity,
  SERVICE_DEFS,
  describeRule,
  isAdmin,
  normalizeHealth,
  overallHealth,
  roleLabel,
  severityOf,
  statusMeta,
} from '../lib/domain.js';
import { formatLocation, truncateId, initials } from '../lib/format.js';

/**
 * Alan mantığı — backend karar matrisiyle uyumu doğrular.
 * Karar matrisi: 0–1 ihlal → Onaylandı, 2–3 ihlal → Şüpheli.
 */

describe('severityOf', () => {
  it('üç kural ihlalini kritik sayar', () => {
    expect(severityOf(['Velocity', 'Amount', 'Location'], 'Suspicious')).toBe(Severity.HIGH);
  });

  it('iki kural ihlalini yüksek sayar', () => {
    expect(severityOf(['Velocity', 'Amount'], 'Suspicious')).toBe(Severity.MEDIUM);
  });

  it('tek kural ihlalini düşük sayar', () => {
    expect(severityOf(['Amount'], 'Approved')).toBe(Severity.LOW);
  });

  it('ihlal yoksa normal döner', () => {
    expect(severityOf([], 'Approved')).toBe(Severity.NONE);
  });

  it('kural listesi yokken şüpheli durumu yüksek sayar', () => {
    // WS olayları triggeredRules taşımayabilir; durum yine de korunmalı.
    expect(severityOf(undefined, 'Suspicious')).toBe(Severity.MEDIUM);
  });

  it('geçersiz girdilerde çökmez', () => {
    expect(severityOf(null, null)).toBe(Severity.NONE);
  });
});

describe('describeRule', () => {
  it('backend kural adlarını çözer', () => {
    expect(describeRule('Velocity').fullLabel).toBe('Hız Kuralı');
    expect(describeRule('Amount').fullLabel).toBe('Tutar Kuralı');
    expect(describeRule('Location').fullLabel).toBe('İmkansız Seyahat');
  });

  it('bilinmeyen kural için güvenli geri dönüş verir', () => {
    expect(describeRule('Whatever').label).toBe('Whatever');
  });
});

describe('statusMeta', () => {
  it('backend durumlarını Türkçe etiketlere çevirir', () => {
    expect(statusMeta('Suspicious').label).toBe('Şüpheli');
    expect(statusMeta('Approved').label).toBe('Onaylandı');
    expect(statusMeta('Received').label).toBe('Alındı');
  });
});

describe('sistem sağlığı', () => {
  it('backend değerlerini normalleştirir', () => {
    expect(normalizeHealth('Healthy')).toBe(HealthStatus.HEALTHY);
    expect(normalizeHealth('Unhealthy')).toBe(HealthStatus.UNHEALTHY);
    expect(normalizeHealth(undefined)).toBe(HealthStatus.UNKNOWN);
  });

  it('yalnızca backend’in döndürdüğü üç servisi tanımlar', () => {
    expect(SERVICE_DEFS.map((s) => s.field)).toEqual(['postgreSql', 'redis', 'rabbitMq']);
  });

  it('tümü sağlıklıysa sağlıklı döner', () => {
    expect(
      overallHealth([{ status: HealthStatus.HEALTHY }, { status: HealthStatus.HEALTHY }])
    ).toBe(HealthStatus.HEALTHY);
  });

  it('bir servis hatalıysa bozulmuş döner', () => {
    expect(
      overallHealth([{ status: HealthStatus.HEALTHY }, { status: HealthStatus.UNHEALTHY }])
    ).toBe(HealthStatus.DEGRADED);
  });

  it('tümü hatalıysa hizmet dışı döner', () => {
    expect(
      overallHealth([{ status: HealthStatus.UNHEALTHY }, { status: HealthStatus.UNHEALTHY }])
    ).toBe(HealthStatus.UNHEALTHY);
  });

  it('veri yoksa bilinmiyor döner', () => {
    expect(overallHealth([])).toBe(HealthStatus.UNKNOWN);
  });
});

describe('roller', () => {
  it('Admin rolünü büyük/küçük harften bağımsız tanır', () => {
    expect(isAdmin('Admin')).toBe(true);
    expect(isAdmin('admin')).toBe(true);
    expect(isAdmin('Analyst')).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it('rolleri Türkçe etiketler', () => {
    expect(roleLabel('Admin')).toBe('Yönetici');
    expect(roleLabel('Analyst')).toBe('Analist');
  });
});

describe('biçimlendirme', () => {
  it("backend'in 'Unknown' değerini gizler", () => {
    expect(formatLocation('Istanbul', 'Unknown')).toBe('Istanbul');
    expect(formatLocation('Unknown', 'Unknown')).toBe('Bilinmiyor');
    expect(formatLocation('Berlin', 'Germany')).toBe('Berlin, Germany');
  });

  it('uzun kimlikleri kısaltır', () => {
    expect(truncateId('550e8400-e29b-41d4-a716-446655440000')).toContain('…');
    expect(truncateId('kısa')).toBe('kısa');
  });

  it('baş harfleri üretir', () => {
    expect(initials('customer-100')).toBe('C1');
    expect(initials('admin')).toBe('AD');
  });
});
