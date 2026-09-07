import { useEffect, useRef, useState } from 'react';
import Icon from '../components/ui/Icon.jsx';
import { Button } from '../components/ui/primitives.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { ErrorKind } from '../lib/api.js';

/** Hata sınıfına göre kullanıcıya gösterilecek metin (ham mesaj değil). */
function loginErrorCopy(error) {
  if (!error) return null;
  switch (error.kind) {
    case ErrorKind.UNAUTHORIZED:
      return {
        title: 'Giriş bilgileri doğrulanamadı',
        detail: 'Kullanıcı adı veya şifre hatalı. Bilgilerinizi kontrol edip yeniden deneyin.',
      };
    case ErrorKind.VALIDATION:
      return {
        title: 'Eksik bilgi',
        detail: error.message || 'Kullanıcı adı ve şifre alanları zorunludur.',
      };
    case ErrorKind.NETWORK:
      return {
        title: 'Sunucuya ulaşılamıyor',
        detail:
          'Kimlik doğrulama servisi yanıt vermiyor. Ağ bağlantınızı kontrol edin veya sistem yöneticisine bildirin.',
      };
    case ErrorKind.SERVER:
    case ErrorKind.UNAVAILABLE:
      return {
        title: 'Servis şu anda kullanılamıyor',
        detail: 'Kimlik doğrulama servisinde bir sorun var. Kısa bir süre sonra yeniden deneyin.',
      };
    default:
      return {
        title: 'Giriş yapılamadı',
        detail: 'Beklenmeyen bir hata oluştu. Lütfen yeniden deneyin.',
      };
  }
}

const CAPABILITIES = [
  {
    icon: 'pulse',
    text: 'İşlem akışını gerçek zamanlı izleyin ve anomalileri anında görün.',
  },
  {
    icon: 'shieldAlert',
    text: 'Hız, tutar ve imkansız seyahat kurallarına göre şüpheli işlemleri inceleyin.',
  },
  {
    icon: 'gauge',
    text: 'PostgreSQL, Redis ve RabbitMQ bağımlılıklarının sağlığını tek bakışta değerlendirin.',
  },
];

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
          <span className="brand">
            <span className="brand__mark" aria-hidden="true">
              <Icon name="bolt" size={15} strokeWidth={2} />
            </span>
            <span className="brand__text">
              <span className="brand__name">Fraudio</span>
              <span className="brand__tag">Fraud Operations</span>
            </span>
          </span>

          <div>
            <h1 className="auth__headline">
              Gerçek zamanlı dolandırıcılık tespiti ve operasyon paneli
            </h1>
            <p className="auth__sub" style={{ marginTop: 'var(--sp-3)' }}>
              E-ticaret işlemlerini akış hâlinde değerlendirin, kural ihlallerini şiddetine göre
              önceliklendirin ve şüpheli kullanıcıları tek ekrandan inceleyin.
            </p>
          </div>

          <ul className="auth__capabilities" style={{ listStyle: 'none' }}>
            {CAPABILITIES.map((capability) => (
              <li className="auth__capability" key={capability.icon}>
                <Icon
                  name={capability.icon}
                  size={15}
                  className="auth__capability-icon"
                />
                <span>{capability.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="auth__footnote">
          Erişim, rol tabanlı yetkilendirme ile sınırlandırılmıştır. Yönetici ve Analist rolleri
          farklı yeteneklere sahiptir.
        </p>
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
              <span>Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.</span>
            </div>
          )}

          {errorCopy && (
            <div className="notice notice--danger" role="alert">
              <Icon name="warning" size={13} className="notice__icon" />
              <span>
                <strong style={{ display: 'block', fontWeight: 600 }}>{errorCopy.title}</strong>
                {errorCopy.detail}
              </span>
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
