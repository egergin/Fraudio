import React from 'react';

export default function FraudAlerts({ alerts, onSelectUser }) {
  const getRuleLabel = (rule) => {
    switch (rule?.toLowerCase()) {
      case 'velocity':
        return 'Hız (Velocity)';
      case 'amount':
        return 'Yüksek Tutar';
      case 'location':
        return 'İmkansız Konum';
      default:
        return rule;
    }
  };

  return (
    <div className="glass-card">
      <div className="card-title">
        <span style={{ color: 'var(--status-suspicious-text)' }}>Şüpheli İşlemler</span>
        <span className="badge-status badge-suspicious">{alerts.length} Tespit Edildi</span>
      </div>

      {alerts.length === 0 ? (
        <div className="empty-state">
          Şüpheli işlem tespit edilmedi.
        </div>
      ) : (
        <div className="stream-list">
          {alerts.map((alert, idx) => (
            <div
              key={alert.transactionId || idx}
              className="stream-item"
              style={{ borderColor: 'rgba(244, 63, 94, 0.25)' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="stream-user-link"
                    style={{ background: 'none', border: 'none', padding: 0 }}
                    onClick={() => onSelectUser(alert.userId)}
                  >
                    {alert.userId}
                  </button>
                </div>
                <div>
                  {(alert.triggeredRules || []).map((rule, rIdx) => (
                    <span key={rIdx} className="rule-pill">
                      {getRuleLabel(rule)}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {alert.city || 'Bilinmiyor'}
                </div>
              </div>

              <div className="stream-meta">
                <div className="stream-amount" style={{ color: 'var(--status-suspicious-text)' }}>
                  ₺{Number(alert.amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="stream-time">
                  {alert.occurredAt ? new Date(alert.occurredAt).toLocaleTimeString('tr-TR') : 'Az önce'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
