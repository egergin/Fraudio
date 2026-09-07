import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { endpoints, onUnauthorized, ApiError, ErrorKind } from '../lib/api.js';

/**
 * Kimlik doğrulama durumu.
 *
 * Mevcut davranış birebir korunur:
 *  - POST /api/auth/login → { accessToken, expiresAt, role }
 *  - jeton localStorage'da 'token', rol 'role' anahtarıyla saklanır
 *  - sunucu tarafı çıkış uç noktası yoktur; çıkış yereldir
 *
 * Eklenenler (sözleşmeyi değiştirmez):
 *  - expiresAt saklanır ve süresi geçmiş oturum başlangıçta reddedilir
 *  - herhangi bir 401 yanıtı oturumu temizler
 */

const STORAGE = { token: 'token', role: 'role', expiresAt: 'expiresAt', username: 'username' };

const AuthContext = createContext(null);

function readStoredSession() {
  try {
    const token = localStorage.getItem(STORAGE.token);
    if (!token) return null;

    const expiresAt = localStorage.getItem(STORAGE.expiresAt);
    // Süresi dolmuş jetonla açılışta sahte "oturum açık" durumu göstermeyiz.
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return null;

    return {
      token,
      // Rol asla varsayılan olarak 'Admin' değildir — yetki sızıntısını önler.
      role: localStorage.getItem(STORAGE.role) || null,
      expiresAt,
      username: localStorage.getItem(STORAGE.username) || null,
    };
  } catch {
    return null;
  }
}

function persistSession(session) {
  try {
    if (!session) {
      Object.values(STORAGE).forEach((key) => localStorage.removeItem(key));
      return;
    }
    localStorage.setItem(STORAGE.token, session.token);
    if (session.role) localStorage.setItem(STORAGE.role, session.role);
    if (session.expiresAt) localStorage.setItem(STORAGE.expiresAt, session.expiresAt);
    if (session.username) localStorage.setItem(STORAGE.username, session.username);
  } catch {
    /* depolama kullanılamıyorsa oturum yalnızca bellekte kalır */
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);
  const [status, setStatus] = useState('idle'); // idle | pending | error
  const [error, setError] = useState(null);
  const [expiredNotice, setExpiredNotice] = useState(false);

  const signOut = useCallback((options = {}) => {
    persistSession(null);
    setSession(null);
    setError(null);
    setStatus('idle');
    setExpiredNotice(Boolean(options.expired));
  }, []);

  // Herhangi bir isteğin 401 alması oturumu sonlandırır.
  useEffect(() => onUnauthorized(() => signOut({ expired: true })), [signOut]);

  // Jeton süresi dolduğunda otomatik çıkış.
  useEffect(() => {
    if (!session?.expiresAt) return undefined;
    const remaining = new Date(session.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      signOut({ expired: true });
      return undefined;
    }
    // setTimeout 32-bit sınırını aşamaz; 8 saatlik jeton bu sınırın altında.
    const timer = setTimeout(() => signOut({ expired: true }), Math.min(remaining, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [session?.expiresAt, signOut]);

  const signIn = useCallback(async (username, password) => {
    setStatus('pending');
    setError(null);
    setExpiredNotice(false);

    try {
      const { data } = await endpoints.login({ username, password });

      if (!data?.accessToken) {
        throw new ApiError({
          kind: ErrorKind.SERVER,
          message: 'Sunucu geçerli bir oturum jetonu döndürmedi.',
        });
      }

      const next = {
        token: data.accessToken,
        role: data.role ?? null,
        expiresAt: data.expiresAt ?? null,
        username,
      };

      persistSession(next);
      setSession(next);
      setStatus('idle');
      return { ok: true };
    } catch (err) {
      const apiError =
        err instanceof ApiError
          ? err
          : new ApiError({ kind: ErrorKind.UNKNOWN, message: 'Giriş yapılamadı.' });
      setError(apiError);
      setStatus('error');
      return { ok: false, error: apiError };
    }
  }, []);

  const value = useMemo(
    () => ({
      session,
      token: session?.token ?? null,
      role: session?.role ?? null,
      username: session?.username ?? null,
      isAuthenticated: Boolean(session?.token),
      status,
      error,
      expiredNotice,
      signIn,
      signOut,
      dismissExpiredNotice: () => setExpiredNotice(false),
    }),
    [session, status, error, expiredNotice, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalıdır.');
  return ctx;
}
