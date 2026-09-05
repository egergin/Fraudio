import React, { useState, useEffect } from 'react';

export default function SystemHealth({ token, apiUrl }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      } else {
        setError(`Sağlık kontrolü başarısız oldu: HTTP ${res.status}`);
      }
    } catch (err) {
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

  const getStatusBadge = (status) => {
    const isOk = status?.toLowerCase() === 'healthy';
    return (
      <span className="health-status-badge" style={{ color: isOk ? 'var(--status-approved-text)' : 'var(--status-suspicious-text)' }}>
        <span
          style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isOk ? 'var(--status-approved-text)' : 'var(--status-suspicious-text)'
          }}
        />
        {isOk ? 'Sağlıklı' : 'Sağlıksız'}
      </span>
    );
  };

  return (
    <div className="glass-card">
      <div className="card-title">
        <span>Sistem Sağlığı ve Altyapı Durumu</span>
        <button
          className="btn-secondary"
          style={{ padding: '4px 10px', fontSize: '11px' }}
          onClick={fetchHealth}
          disabled={loading}
        >
          {loading ? 'Kontrol Ediliyor...' : 'Yenile'}
        </button>
      </div>

      {error ? (
        <div style={{ color: 'var(--status-suspicious-text)', fontSize: '12px' }}>
          {error}
        </div>
      ) : !health ? (
        <div className="empty-state">Altyapı telemetrisi yükleniyor...</div>
      ) : (
        <div className="health-grid">
          <div className="health-item">
            <span className="health-name">PostgreSQL</span>
            {getStatusBadge(health.postgreSql)}
          </div>
          <div className="health-item">
            <span className="health-name">Redis</span>
            {getStatusBadge(health.redis)}
          </div>
          <div className="health-item">
            <span className="health-name">RabbitMQ</span>
            {getStatusBadge(health.rabbitMq)}
          </div>
        </div>
      )}
    </div>
  );
}
