import React from 'react';

export default function Navbar({ userRole, wsStatus, onLogout }) {
  const getStatusClass = (status) => {
    switch (status) {
      case 'Connected':
        return 'status-connected';
      case 'Reconnecting':
        return 'status-reconnecting';
      default:
        return 'status-disconnected';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'Connected':
        return 'Bağlı';
      case 'Reconnecting':
        return 'Yeniden Bağlanıyor';
      default:
        return 'Bağlantı Kesildi';
    }
  };

  const getRoleLabel = (role) => {
    if (!role) return '';
    const r = role.toLowerCase();
    if (r === 'admin') return 'Admin';
    if (r === 'analyst') return 'Analist';
    return role;
  };

  return (
    <header className="navbar">
      <div className="nav-brand">
        <div className="brand-icon">⚡</div>
        <div>
          <h1 className="brand-name">Fraudio</h1>
        </div>
      </div>

      <div className="nav-status-group">
        <div className="status-pill" title={`WebSocket Durumu: ${getStatusLabel(wsStatus)}`}>
          <div className={`status-indicator ${getStatusClass(wsStatus)}`} />
          <span>{getStatusLabel(wsStatus)}</span>
        </div>

        {userRole && (
          <span className="role-badge">{getRoleLabel(userRole)}</span>
        )}

        <button id="logout-button" className="btn-secondary" onClick={onLogout}>
          Çıkış Yap
        </button>
      </div>
    </header>
  );
}
