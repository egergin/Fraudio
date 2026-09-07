import { useEffect, useRef, useState } from 'react';
import Icon from '../components/legacy/Icon.jsx';
import { Button } from '../components/legacy/primitives.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { ErrorKind } from '../lib/api.js';

/** Hata sınıfına göre kullanıcıya gösterilecek metin (ham mesaj değil). */
function loginErrorCopy(error) {
  if (!error) return null;
  switch (error.kind) {
    case ErrorKind.UNAUTHORIZED:
      return { title: 'Giriş bilgileri doğrulanamadı' };
    case ErrorKind.VALIDATION:
      return { title: error.message || 'Kullanıcı adı ve şifre zorunludur' };
    case ErrorKind.NETWORK:
      return { title: 'Sunucuya ulaşılamıyor' };
    case ErrorKind.SERVER:
    case ErrorKind.UNAVAILABLE:
      return { title: 'Servis kullanılamıyor' };
    default:
      return { title: 'Giriş yapılamadı' };
  }
}

export function LoginPage() {
  const { signIn, status, error, expiredNotice, dismissExpiredNotice } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);

  const usernameRef = useRef(null);
  const isSubmitting = status === 'pending';

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const trimmedUser = username.trim();
  const canSubmit = trimmedUser.length > 0 && password.length > 0 && !isSubmitting;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    dismissExpiredNotice();
    await signIn(trimmedUser, password);
    setPassword('');
  };

  const errorCopy = loginErrorCopy(error);

  return (
    <div className="auth">
      {/* Bilgilendirici sol panel — masaüstünde ürün kimliğini kurar */}
      <aside className="auth__aside">
        <div className="auth__aside-content">
          <span className="auth__mark" aria-hidden="true">
            <Icon name="bolt" size={22} strokeWidth={2} />
          </span>
          <h1 className="auth__wordmark">Fraudio</h1>
          <p className="auth__tag">Fraud Operations</p>
        </div>

        <p className="auth__footnote">Rol tabanlı erişim · Yönetici · Analist</p>
      </aside>

      {/* Giriş formu */}
      <main className="auth__main">
        <div className="auth__panel">
          <div>
            <h2 className="auth__title">Oturum açın</h2>
            <p className="auth__desc" style={{ marginTop: 'var(--sp-1)' }}>
              Devam etmek için panel kimlik bilgilerinizi girin.
            </p>
          </div>

          {expiredNotice && !errorCopy && (
            <div className="notice notice--warn" role="status">
              <Icon name="clock" size={13} className="notice__icon" />
              <span>Oturum süresi doldu</span>
            </div>
          )}

          {errorCopy && (
            <div className="notice notice--danger" role="alert">
              <Icon name="warning" size={13} className="notice__icon" />
              <span>{errorCopy.title}</span>
            </div>
          )}

          <form className="auth__form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label className="field__label" htmlFor="username">
                Kullanıcı adı
              </label>
              <input
                ref={usernameRef}
                id="username"
                name="username"
                className="input"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                placeholder="admin"
                value={username}
                disabled={isSubmitting}
                aria-invalid={touched && !trimmedUser ? 'true' : undefined}
                aria-describedby={touched && !trimmedUser ? 'username-error' : undefined}
                onChange={(event) => setUsername(event.target.value)}
              />
              {touched && !trimmedUser && (
                <span className="field__error" id="username-error">
                  <Icon name="warning" size={12} />
                  Kullanıcı adı gereklidir.
                </span>
              )}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="password">
                Şifre
              </label>
              <input
                id="password"
                name="password"
                className="input"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                disabled={isSubmitting}
                aria-invalid={touched && !password ? 'true' : undefined}
                aria-describedby={touched && !password ? 'password-error' : undefined}
                onChange={(event) => setPassword(event.target.value)}
              />
              {touched && !password && (
                <span className="field__error" id="password-error">
                  <Icon name="warning" size={12} />
                  Şifre gereklidir.
                </span>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              loading={isSubmitting}
              disabled={!canSubmit}
            >
              {isSubmitting ? 'Doğrulanıyor…' : 'Giriş yap'}
            </Button>
          </form>

          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Kimlik bilgileri sistem yöneticiniz tarafından sağlanır. Oturum jetonu 8 saat
            geçerlidir.
          </p>
        </div>
      </main>
    </div>
  );
}

export default LoginPage;
