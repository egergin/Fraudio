import React, { useState } from 'react';

export default function LoginView({ onLogin, error, loading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand" aria-label="Fraudio">
          <img src="/fraudio-logo.svg" alt="" />
          <strong>Fraudio</strong>
        </div>
        <h1 id="login-title" className="sr-only">Fraudio giriş</h1>
        {error && <div className="alert-box" role="alert">{error}</div>}
        <form onSubmit={(event) => { event.preventDefault(); if (email && password && !loading) onLogin(email, password); }}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email"><span className="field-icon field-icon-user" aria-hidden="true" />Kullanıcı Adı</label>
            <input id="login-email" className="form-input" type="text" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password"><span className="field-icon field-icon-lock" aria-hidden="true" />Şifre</label>
            <input id="login-password" className="form-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          </div>
          <button id="login-submit" className="btn-primary" disabled={loading}>{loading ? 'GİRİŞ YAPILIYOR…' : 'GİRİŞ'}</button>
        </form>
      </section>
    </main>
  );
}
