import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Radio, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { tr } from '../i18n/tr.js';
import logo from '../assets/fraudio-logo.png';

export function Login() {
  const { login, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const from = location.state?.from || '/';
  if (token) {
    return <Navigate to={from} replace />;
  }

  async function submit(e) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError(tr.login.required);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch {
      setError('Kullanıcı adı veya şifre hatalı.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-brand" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={logo} alt="Fraudio logo" width={56} height={56} />
          <h1 style={{ margin: 0 }}>{tr.brand.name}</h1>
        </div>
        
        <p style={{ margin: 0 }}>Dolandırıcılık ihtimali taşıyan işlemleri dashboard üzerinden yönetin</p>
      </div>




      <div className="login-form-wrap">
        <form className="login-card" onSubmit={submit} noValidate={false}>
          <h2>{tr.login.title}</h2>

          <label className="field">
            <span>{tr.login.username}</span>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={tr.login.usernamePlaceholder}
              autoComplete="username"
              aria-invalid={!!error}
            />
          </label>
          <label className="field">
            <span>{tr.login.password}</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tr.login.passwordPlaceholder}
              autoComplete="current-password"
              aria-invalid={!!error}
            />
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button className="btn btn-block" type="submit" disabled={loading}>
            {loading ? tr.login.submitting : tr.login.submit}
          </button>
        </form>
      </div>
    </div>
  );
}

export function RequireAuth({ children }) {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
