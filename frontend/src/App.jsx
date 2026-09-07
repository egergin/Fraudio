import React, { useEffect, useRef, useState } from 'react';
import Navbar from './components/Navbar.jsx';
import LoginView from './components/LoginView.jsx';
import LiveStream from './components/LiveStream.jsx';
import FraudAlerts from './components/FraudAlerts.jsx';
import FraudChart from './components/FraudChart.jsx';
import SystemHealth from './components/SystemHealth.jsx';
import UserDetailModal from './components/UserDetailModal.jsx';
import { apiFetch, API_BASE, ApiError } from './api.js';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [userRole, setUserRole] = useState(() => localStorage.getItem('role') || 'Admin');
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [wsStatus, setWsStatus] = useState('Disconnected');
  const [liveTransactions, setLiveTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertsState, setAlertsState] = useState('loading');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const handleLogin = async (username, password) => {
    setLoginLoading(true); setLoginError(null);
    try {
      const data = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      if (!data?.accessToken) throw new Error('Sunucu geçerli bir oturum döndürmedi.');
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('role', data.role || 'Analyst');
      setToken(data.accessToken); setUserRole(data.role || 'Analyst');
    } catch (error) {
      setLoginError(error instanceof ApiError && error.status >= 500 ? 'Kimlik doğrulama servisi şu anda kullanılamıyor.' : error.message || 'Giriş bilgileri doğrulanamadı.');
    } finally { setLoginLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('token'); localStorage.removeItem('role');
    setToken(null); setUserRole(null); wsRef.current?.close();
  };

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setAlertsState('loading');
    apiFetch('/api/frauds/recent', { token, signal: controller.signal })
      .then((data) => { setAlerts(data || []); setAlertsState('ready'); })
      .catch((error) => { if (error.name !== 'AbortError') setAlertsState(error.status === 401 || error.status === 403 ? 'unauthorized' : 'error'); });
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let stopped = false;
    const connect = () => {
      if (stopped) return;
      setWsStatus('Reconnecting');
      const protocol = API_BASE.startsWith('https') ? 'wss' : 'ws';
      const host = API_BASE.replace(/^https?:\/\//, '');
      const ws = new WebSocket(`${protocol}://${host}/ws?access_token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onopen = () => setWsStatus('Connected');
      ws.onerror = () => setWsStatus('Disconnected');
      ws.onclose = () => { if (!stopped) { setWsStatus('Disconnected'); reconnectTimeoutRef.current = setTimeout(connect, 3000); } };
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (!payload.transactionId) return;
          const merge = (items) => items.some((item) => item.transactionId === payload.transactionId)
            ? items.map((item) => item.transactionId === payload.transactionId ? { ...item, ...payload } : item)
            : [payload, ...items].slice(0, 30);
          if (['transaction.received', 'transaction.approved', 'transaction.suspicious'].includes(payload.eventType)) setLiveTransactions(merge);
          if (payload.eventType === 'transaction.suspicious') setAlerts((items) => [payload, ...items.filter((item) => item.transactionId !== payload.transactionId)].slice(0, 20));
        } catch { /* malformed socket event */ }
      };
    };
    connect();
    return () => { stopped = true; clearTimeout(reconnectTimeoutRef.current); wsRef.current?.close(); };
  }, [token]);

  if (!token) return <div className="app-container"><LoginView onLogin={handleLogin} error={loginError} loading={loginLoading} /></div>;

  const suspiciousCount = alerts.length;
  const attentionLabel = suspiciousCount > 0 ? 'İnceleme bekliyor' : 'Açık alarm yok';
  return (
    <div className="app-container">
      <Navbar userRole={userRole} wsStatus={wsStatus} onLogout={handleLogout} />
      <main className="main-content">
        <section className="hero-strip">
          <div><p className="eyebrow">OPERASYON MERKEZİ / GERÇEK ZAMANLI</p><h2>Risk akışını kontrol altında tutun.</h2><p className="hero-copy">Canlı işlemler, şüpheli hareketler ve altyapı sinyalleri tek operasyon görünümünde.</p></div>
          <div className={`attention-callout ${suspiciousCount ? 'is-alert' : 'is-clear'}`}><span className="status-indicator" /> <strong>{attentionLabel}</strong><small>{suspiciousCount ? `${suspiciousCount} işlem gözden geçirilmeli` : 'Sistem normal çalışıyor'}</small></div>
        </section>
        <section className="metric-row" aria-label="Operasyon özeti">
          <div className="metric-panel"><span>CANLI AKIŞ</span><strong>{liveTransactions.length}</strong><small>son 30 olay / geçici görünüm</small></div>
          <div className="metric-panel metric-panel-alert"><span>ŞÜPHELİ İŞLEMLER</span><strong>{suspiciousCount}</strong><small>son 20 kayıtla sınırlı</small></div>
          <div className="metric-panel"><span>BAĞLANTI</span><strong className="metric-status">{wsStatus === 'Connected' ? 'AKTİF' : wsStatus === 'Reconnecting' ? 'YENİDEN' : 'KAPALI'}</strong><small>WebSocket durumu</small></div>
        </section>
        {userRole?.toLowerCase() === 'admin' && <SystemHealth token={token} apiUrl={API_BASE} />}
        <section className="dashboard-grid dashboard-grid-primary"><LiveStream transactions={liveTransactions} onSelectUser={setSelectedUserId} /><FraudAlerts alerts={alerts} state={alertsState} onSelectUser={setSelectedUserId} /></section>
        <FraudChart alerts={alerts} />
      </main>
      {selectedUserId && <UserDetailModal userId={selectedUserId} token={token} apiUrl={API_BASE} onClose={() => setSelectedUserId(null)} />}
    </div>
  );
}
