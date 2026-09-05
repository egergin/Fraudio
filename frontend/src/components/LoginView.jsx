import React, { useState } from 'react';

export default function LoginView({ onLogin, error, loading }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username && password) {
      onLogin(username, password);
    }
  };

  return (
    <div className="login-card glass-card">
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div className="brand-icon" style={{ margin: '0 auto 12px', width: '48px', height: '48px', fontSize: '24px' }}>⚡</div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '6px' }}>Fraudio</h1>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(244, 63, 94, 0.15)',
          color: '#fda4af',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          fontSize: '13px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="login-username">Kullanıcı Adı</label>
          <input
            id="login-username"
            className="form-input"
            type="text"
            placeholder="admin veya analyst"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="login-password">Şifre</label>
          <input
            id="login-password"
            className="form-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button id="login-submit" type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '8px' }}>
          {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
        </button>
      </form>
    </div>
  );
}
