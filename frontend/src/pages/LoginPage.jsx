import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { FormField, Input, Notice } from '@/components/ui/input.jsx';
import { useAuth } from '@/auth/AuthContext.jsx';
import { ErrorKind } from '@/lib/api.js';

/** Hata sınıfına göre tek satırlık metin — ham sunucu mesajı gösterilmez. */
function loginErrorText(error) {
  if (!error) return null;
  switch (error.kind) {
    case ErrorKind.UNAUTHORIZED:
      return 'Giriş bilgileri doğrulanamadı';
    case ErrorKind.VALIDATION:
      return error.message || 'Kullanıcı adı ve şifre zorunludur';
    case ErrorKind.NETWORK:
      return 'Sunucuya ulaşılamıyor';
    case ErrorKind.SERVER:
    case ErrorKind.UNAVAILABLE:
      return 'Servis kullanılamıyor';
    default:
      return 'Giriş yapılamadı';
  }
}

/**
 * Giriş.
 *
 * Tek sütun, ortalanmış, dar. Pazarlama paneli yok: bu bir iç araçtır ve
 * buraya gelen kişi ne olduğunu zaten bilir.
 */
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

  const errorText = loginErrorText(error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-[336px]">
        {/* Marka: işaret + kelime. Slogan yok. */}
        <div className="mb-8 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-sm bg-live text-sm font-bold text-fg-inverted"
          >
            F
          </span>
          <div className="flex flex-col">
            <h1 className="text-md font-semibold leading-none tracking-[-0.01em] text-fg">
              Fraudio
            </h1>
            <span className="mt-1 text-2xs text-fg-muted">Fraud Operations</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {expiredNotice && !errorText && <Notice tone="warn">Oturum süresi doldu</Notice>}
          {errorText && <Notice tone="danger">{errorText}</Notice>}

          <FormField
            label="Kullanıcı adı"
            error={touched && !trimmedUser ? 'Zorunlu' : null}
          >
            {({ id, invalid, describedBy }) => (
              <Input
                ref={usernameRef}
                id={id}
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                value={username}
                disabled={isSubmitting}
                invalid={invalid}
                aria-describedby={describedBy}
                onChange={(e) => setUsername(e.target.value)}
              />
            )}
          </FormField>

          <FormField label="Şifre" error={touched && !password ? 'Zorunlu' : null}>
            {({ id, invalid, describedBy }) => (
              <Input
                id={id}
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                disabled={isSubmitting}
                invalid={invalid}
                aria-describedby={describedBy}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </FormField>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="mt-1 w-full"
            loading={isSubmitting}
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Doğrulanıyor…' : 'Giriş yap'}
          </Button>
        </form>
      </div>
    </main>
  );
}

export default LoginPage;
