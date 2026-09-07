import React, { useState } from 'react';

export default function LoginView({ onLogin, error, loading }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    if (username && password && !loading) onLogin(username, password);
  };

  return (
    <main className="login-shell">
      <section className="login-intro">
        <p className="eyebrow">OPERASYON MERKEZİ / GÜVENLİ GİRİŞ</p>
        <h1>Fraudio</h1>
        <p>Gerçek zamanlı işlem akışını, şüpheli aktiviteyi ve altyapı sağlığını tek operasyon panelinden izleyin.</p>
        <div className="login-signal">
          <span className="status-indicator status-connected" aria-hidden="true" />
          Canlı izleme aktif
        </div>
      </section>
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-heading">
          <span className="brand-mark" aria-hidden="true">F</span>
          <div>
            <strong id="login-title">Fraudio</strong>
            <small>Analist ve yönetici girişi</small>
          </div>
        </div>
        {error && <div className="alert-box" role="alert">{error}</div>}
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">Kullanıcı adı</label>
            <input
              id="login-username"
              className="form-input"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Şifre</label>
            <input
              id="login-password"
              className="form-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button id="login-submit" className="btn-primary" disabled={loading || !username || !password}>
            {loading ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </button>
        </form>
        <p className="login-footnote">Yetkisiz erişim denemeleri kayıt altına alınır.</p>
      </section>
    </main>
  );
}
