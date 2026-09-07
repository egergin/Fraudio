import React, { useState, useEffect } from 'react';

const STATUS_LABELS = { healthy: 'Sağlıklı', degraded: 'Kısıtlı', unhealthy: 'Sağlıksız' };

function normalizeStatus(status) {
  const key = status?.toLowerCase();
  return STATUS_LABELS[key] ? key : 'unknown';
}

function StatusBadge({ status }) {
  const key = normalizeStatus(status);
  return (
    <span className={`health-status-badge is-${key}`}>
      <span className="health-dot" aria-hidden="true" />
      {STATUS_LABELS[key] || 'Bilinmiyor'}
    </span>
  );
}

export default function SystemHealth({ token, apiUrl }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchHealth = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/system/health`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok || res.status === 503) {
        setHealth(await res.json());
        setLastChecked(new Date());
      } else if (res.status === 401 || res.status === 403) {
        setError('Bu görünüm için yönetici yetkisi gereklidir.');
      } else {
        setError(`Sağlık kontrolü başarısız oldu (HTTP ${res.status}).`);
      }
    } catch {
      setError('Sistem sağlık uç noktasına erişilemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, [token]);

  const services = health
    ? [
        { key: 'postgreSql', label: 'PostgreSQL', status: health.postgreSql },
        { key: 'redis', label: 'Redis', status: health.redis },
        { key: 'rabbitMq', label: 'RabbitMQ', status: health.rabbitMq }
      ]
    : [];
  const hasIssue = services.some((service) => normalizeStatus(service.status) !== 'healthy');

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className={`eyebrow ${hasIssue ? 'eyebrow-alert' : ''}`}>ALTYAPI</p>
          <h3>Sistem sağlığı</h3>
        </div>
        <div className="panel-heading-actions">
          {lastChecked && !error && (
            <span className="last-checked">Son kontrol: {lastChecked.toLocaleTimeString('tr-TR')}</span>
          )}
          <button className="btn-secondary" onClick={fetchHealth} disabled={loading}>
            {loading ? 'Kontrol ediliyor…' : 'Yenile'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="state-block state-danger">
          <strong>Sağlık verisi alınamadı</strong>
          <span>{error}</span>
        </div>
      ) : !health ? (
        <div className="state-block">
          <strong>Altyapı telemetrisi yükleniyor</strong>
          <span>PostgreSQL, Redis ve RabbitMQ durumu sorgulanıyor…</span>
        </div>
      ) : (
        <div className="health-grid">
          {services.map((service) => (
            <div key={service.key} className={`health-item ${normalizeStatus(service.status) === 'unhealthy' ? 'is-unhealthy' : ''}`}>
              <span className="health-name">{service.label}</span>
              <StatusBadge status={service.status} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
