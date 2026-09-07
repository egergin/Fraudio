import React from 'react';

export default function Navbar({ userRole, wsStatus, onLogout }) {
  const labels = { Connected: 'Bağlı', Reconnecting: 'Yeniden bağlanıyor', Disconnected: 'Bağlantı kesildi' };
  const role = userRole?.toLowerCase() === 'admin' ? 'YÖNETİCİ' : 'ANALİST';
  return <header className="navbar"><a className="nav-brand" href="#top" aria-label="Fraudio ana sayfa"><span className="brand-mark">F</span><span><strong>FRAUDIO</strong><small>RISK INTELLIGENCE</small></span></a><div className="nav-actions"><div className="status-pill"><span className={`status-indicator status-${wsStatus.toLowerCase()}`} /> <span>{labels[wsStatus] || labels.Disconnected}</span></div><span className="role-badge">{role}</span><button id="logout-button" className="btn-secondary" onClick={onLogout}>Oturumu kapat</button></div></header>;
}
