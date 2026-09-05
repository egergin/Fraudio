import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar.jsx';
import LoginView from './components/LoginView.jsx';
import LiveStream from './components/LiveStream.jsx';
import FraudAlerts from './components/FraudAlerts.jsx';
import FraudChart from './components/FraudChart.jsx';
import SystemHealth from './components/SystemHealth.jsx';
import UserDetailModal from './components/UserDetailModal.jsx';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [userRole, setUserRole] = useState(localStorage.getItem('role') || 'Admin');
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [wsStatus, setWsStatus] = useState('Disconnected');
  const [liveTransactions, setLiveTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Authentication
  const handleLogin = async (username, password) => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.accessToken) {
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('role', data.role || 'Analyst');
        setToken(data.accessToken);
        setUserRole(data.role || 'Analyst');
      } else {
        setLoginError(data.message || 'Geçersiz kullanıcı adı veya şifre.');
      }
    } catch (err) {
      setLoginError('Kimlik doğrulama sunucusuna bağlanılamadı.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setToken(null);
    setUserRole(null);
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  // Fetch initial frauds
  useEffect(() => {
    if (!token) return;

    fetch(`${API_BASE}/api/frauds/recent`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setAlerts(data || []);
      })
      .catch(() => { });
  }, [token]);

  // WebSocket Connection
  useEffect(() => {
    if (!token) return;

    let isUnmounted = false;

    const connectWebSocket = () => {
      if (isUnmounted) return;

      const wsProtocol = API_BASE.startsWith('https') ? 'wss' : 'ws';
      const wsHost = API_BASE.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}://${wsHost}/ws?access_token=${encodeURIComponent(token)}`;

      setWsStatus('Reconnecting');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isUnmounted) setWsStatus('Connected');
      };

      ws.onclose = () => {
        if (!isUnmounted) {
          setWsStatus('Disconnected');
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        }
      };

      ws.onerror = () => {
        if (!isUnmounted) setWsStatus('Disconnected');
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const eventType = payload.eventType;

          if (eventType === 'transaction.received') {
            setLiveTransactions((prev) => [payload, ...prev].slice(0, 30));
          } else if (eventType === 'transaction.approved') {
            setLiveTransactions((prev) => {
              const exists = prev.some((x) => x.transactionId === payload.transactionId);
              if (exists) {
                return prev.map((x) => (x.transactionId === payload.transactionId ? { ...x, ...payload } : x));
              }
              return [payload, ...prev].slice(0, 30);
            });
          } else if (eventType === 'transaction.suspicious') {
            setLiveTransactions((prev) => {
              const exists = prev.some((x) => x.transactionId === payload.transactionId);
              if (exists) {
                return prev.map((x) => (x.transactionId === payload.transactionId ? { ...x, ...payload } : x));
              }
              return [payload, ...prev].slice(0, 30);
            });
            setAlerts((prev) => [payload, ...prev.filter((x) => x.transactionId !== payload.transactionId)].slice(0, 20));
          }
        } catch (err) {
          console.error('WebSocket mesajı işlenirken hata oluştu:', err);
        }
      };
    };

    connectWebSocket();

    return () => {
      isUnmounted = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [token]);

  if (!token) {
    return (
      <div className="app-container">
        <LoginView onLogin={handleLogin} error={loginError} loading={loginLoading} />
      </div>
    );
  }

  // KPIs
  const totalStreamCount = liveTransactions.length;
  const suspiciousCount = alerts.length;
  const fraudRate = totalStreamCount > 0 ? ((suspiciousCount / totalStreamCount) * 100).toFixed(1) : '0.0';

  return (
    <div className="app-container">
      <Navbar userRole={userRole} wsStatus={wsStatus} onLogout={handleLogout} />

      <main className="main-content">
        {/* KPI Header Cards */}
        <div className="kpi-row">
          <div className="kpi-card">
            <span className="kpi-label">Canlı İşlem Akışı</span>
            <span className="kpi-value">{totalStreamCount}</span>
          </div>
          <div className="kpi-card" style={{ borderColor: 'rgba(244, 63, 94, 0.3)' }}>
            <span className="kpi-label" style={{ color: 'var(--status-suspicious-text)' }}>
              Tespit Edilen Dolandırıcılık
            </span>
            <span className="kpi-value" style={{ color: 'var(--status-suspicious-text)' }}>
              {suspiciousCount}
            </span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Anomali Oranı</span>
            <span className="kpi-value" style={{ color: 'var(--accent-cyan)' }}>
              %{fraudRate}
            </span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Aktif Kurallar</span>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Hız • Tutar • İmkansız Seyahat
            </span>
          </div>
        </div>

        {/* System Health (Admin Only) */}
        {userRole?.toLowerCase() === 'admin' && (
          <div style={{ marginBottom: '24px' }}>
            <SystemHealth token={token} apiUrl={API_BASE} />
          </div>
        )}

        {/* Chart Section */}
        <div style={{ marginBottom: '24px' }}>
          <FraudChart alerts={alerts} transactions={liveTransactions} />
        </div>

        {/* Real-Time Live Feed & Alerts Grid */}
        <div className="dashboard-grid">
          <LiveStream transactions={liveTransactions} onSelectUser={setSelectedUserId} />
          <FraudAlerts alerts={alerts} onSelectUser={setSelectedUserId} />
        </div>
      </main>

      {/* User Detail Dossier Modal */}
      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          token={token}
          apiUrl={API_BASE}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
