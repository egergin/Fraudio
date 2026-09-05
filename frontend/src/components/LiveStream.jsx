import React from 'react';

export default function LiveStream({ transactions, onSelectUser }) {
  const getBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'suspicious':
        return <span className="badge-status badge-suspicious">Şüpheli</span>;
      case 'approved':
        return <span className="badge-status badge-approved">Onaylandı</span>;
      default:
        return <span className="badge-status badge-received">Alındı</span>;
    }
  };

  return (
    <div className="glass-card">
      <div className="card-title">
        <span>Canlı İşlem Akışı</span>
      </div>

      {transactions.length === 0 ? (
        <div className="empty-state">
          Henüz işlem alınmadı.
        </div>
      ) : (
        <div className="stream-list">
          {transactions.map((tx, idx) => (
            <div key={tx.transactionId || idx} className="stream-item">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="stream-user-link"
                    style={{ background: 'none', border: 'none', padding: 0 }}
                    onClick={() => onSelectUser(tx.userId)}
                  >
                    {tx.userId}
                  </button>
                  {getBadge(tx.status)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {tx.city || 'Bilinmiyor'}
                </div>
              </div>

              <div className="stream-meta">
                <div className="stream-amount" style={{ color: tx.status === 'Suspicious' ? 'var(--status-suspicious-text)' : 'var(--text-primary)' }}>
                  ₺{Number(tx.amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="stream-time">
                  {tx.occurredAt ? new Date(tx.occurredAt).toLocaleTimeString('tr-TR') : 'Az önce'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
