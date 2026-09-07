import React, { useState } from 'react';

export default function LoginView({ onLogin, error, loading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <main className="login-shell">
      <div className="login-brand" aria-label="Ebolt">
        <img src="/ebolt-logo.svg" alt="" />
        <strong>Ebolt</strong>
      </div>
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-icon" aria-hidden="true"><img src="/ebolt-logo.svg" alt="" /></div>
        <h1 id="login-title">Giriş Yap</h1>
        {error && <div className="alert-box" role="alert">{error}</div>}
        <form onSubmit={(event) => { event.preventDefault(); if (email && password && !loading) onLogin(email, password); }}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <input id="login-email" className="form-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input id="login-password" className="form-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          </div>
          <button id="login-submit" className="btn-primary" disabled={loading}>{loading ? 'Giriş yapılıyor…' : 'Sign In'}</button>
        </form>
      </section>
    </main>
  );
}
