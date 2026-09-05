import React, { useState, useEffect } from 'react';

export default function UserDetailModal({ userId, token, apiUrl, onClose }) {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    if (!userId || !token) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`${apiUrl}/api/transaction-users/${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${apiUrl}/api/transaction-users/${encodeURIComponent(userId)}/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then((r) => (r.ok ? r.json() : []))
    ])
      .then(([userData, historyData]) => {
        if (!isMounted) return;
        if (!userData) {
          setError('Kullanıcı kayıtları veritabanında bulunamadı.');
        } else {
          setSummary(userData);
          setHistory(historyData || []);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Kullanıcı detayları getirilemedi.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, token, apiUrl]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600' }}>
              Kullanıcı İnceleme Dosyası
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
              {userId}
            </h2>
          </div>
          <button className="btn-secondary" onClick={onClose}>
            ✕ Kapat
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="empty-state">Kullanıcı telemetrisi ve işlem geçmişi yükleniyor...</div>
          ) : error ? (
            <div style={{ color: 'var(--status-suspicious-text)', padding: '20px' }}>{error}</div>
          ) : summary ? (
            <>
              {/* Summary KPIs */}
              <div className="kpi-row" style={{ marginBottom: '20px' }}>
                <div className="kpi-card">
                  <span className="kpi-label">Toplam İşlem</span>
                  <span className="kpi-value">{summary.totalTransactions}</span>
                </div>
                <div className="kpi-card" style={{ borderColor: summary.suspiciousTransactions > 0 ? 'rgba(244, 63, 94, 0.3)' : 'var(--border-subtle)' }}>
                  <span className="kpi-label" style={{ color: summary.suspiciousTransactions > 0 ? 'var(--status-suspicious-text)' : 'var(--text-muted)' }}>
                    Şüpheli İşlem Sayısı
                  </span>
                  <span className="kpi-value" style={{ color: summary.suspiciousTransactions > 0 ? 'var(--status-suspicious-text)' : 'var(--text-primary)' }}>
                    {summary.suspiciousTransactions}
                  </span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Son Bilinen Konum</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '4px' }}>
                    {summary.lastTransaction?.city || 'Bilinmiyor'}
                  </span>
                </div>
              </div>

              {/* History Table */}
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                İşlem Geçmişi (Son {history.length} Kayıt)
              </h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Durum</th>
                      <th>Tutar</th>
                      <th>Konum</th>
                      <th>Tetiklenen Kurallar</th>
                      <th>Zaman Damgası</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          Kayıtlı işlem geçmişi bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      history.map((tx, idx) => (
                        <tr key={tx.transactionId || idx}>
                          <td>
                            <span className={`badge-status ${tx.status === 'Suspicious' ? 'badge-suspicious' : 'badge-approved'}`}>
                              {tx.status === 'Suspicious' ? 'Şüpheli' : 'Onaylandı'}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '600' }}>
                            ₺{Number(tx.amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td>
                            {tx.city || 'Bilinmiyor'}{tx.country && tx.country !== 'Unknown' ? `, ${tx.country}` : ''}
                          </td>
                          <td>
                            {(tx.triggeredRules || []).length > 0 ? (
                              tx.triggeredRules.map((rule, rIdx) => (
                                <span key={rIdx} className="rule-pill">
                                  {getRuleLabel(rule)}
                                </span>
                              ))
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Yok</span>
                            )}
                          </td>
                          <td style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {new Date(tx.occurredAt).toLocaleString('tr-TR')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
