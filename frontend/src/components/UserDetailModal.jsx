import React, { useState, useEffect, useRef } from 'react';

export default function UserDetailModal({ userId, token, apiUrl, onClose }) {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const closeButtonRef = useRef(null);

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
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

  const isHighRisk = (summary?.suspiciousTransactions || 0) > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="modal-eyebrow">Kullanıcı inceleme dosyası</p>
            <div className="modal-title-row">
              <h2 id="modal-title" className="modal-title">{userId}</h2>
              {summary && (
                <span className={`risk-tag ${isHighRisk ? 'is-high' : 'is-low'}`}>
                  {isHighRisk ? 'Yüksek risk' : 'Düşük risk'}
                </span>
              )}
            </div>
          </div>
          <button ref={closeButtonRef} className="btn-secondary" onClick={onClose} aria-label="İnceleme dosyasını kapat">
            Kapat
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="state-block">
              <strong>Kullanıcı telemetrisi yükleniyor</strong>
              <span>İşlem geçmişi sorgulanıyor…</span>
            </div>
          ) : error ? (
            <div className="state-block state-danger">
              <strong>Kullanıcı bulunamadı</strong>
              <span>{error}</span>
            </div>
          ) : summary ? (
            <>
              <div className="kpi-row">
                <div className="kpi-card">
                  <span className="kpi-label">Toplam işlem</span>
                  <span className="kpi-value">{summary.totalTransactions}</span>
                </div>
                <div className={`kpi-card ${isHighRisk ? 'is-alert' : ''}`}>
                  <span className="kpi-label">Şüpheli işlem sayısı</span>
                  <span className="kpi-value">{summary.suspiciousTransactions}</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Son bilinen konum</span>
                  <span className="kpi-value">{summary.lastTransaction?.city || 'Bilinmiyor'}</span>
                </div>
              </div>

              <h3 className="section-subtitle">İşlem geçmişi (son {history.length} kayıt)</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Durum</th>
                      <th>Tutar</th>
                      <th>Konum</th>
                      <th>Tetiklenen kurallar</th>
                      <th>Zaman damgası</th>
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
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            ₺{Number(tx.amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td>
                            {tx.city || 'Bilinmiyor'}{tx.country && tx.country !== 'Unknown' ? `, ${tx.country}` : ''}
                          </td>
                          <td>
                            {(tx.triggeredRules || []).length > 0 ? (
                              <div className="rule-list">
                                {tx.triggeredRules.map((rule, rIdx) => (
                                  <span key={rIdx} className="rule-pill">{getRuleLabel(rule)}</span>
                                ))}
                              </div>
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
              <p className="limitation-note">Bu görünüm, ilgili kullanıcı için kayıtlı son 20 işlemi gösterir.</p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
