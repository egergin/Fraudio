import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext.jsx';

/** Oturum açmış bir kullanıcıyı localStorage üzerinden kurar. */
export function seedSession({ role = 'Admin', username = 'admin' } = {}) {
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('role', role);
  localStorage.setItem('username', username);
  localStorage.setItem(
    'expiresAt',
    new Date(Date.now() + 3600_000).toISOString()
  );
}

export function clearSession() {
  localStorage.clear();
}

/** Yönlendirme + kimlik doğrulama sağlayıcılarıyla render. */
export function renderApp(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}

/** fetch'i belirli yol → yanıt eşlemesiyle taklit eder. */
export function mockFetch(routes) {
  return vi.fn(async (url, options = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '');
    const method = options.method ?? 'GET';

    for (const route of routes) {
      const methodMatches = (route.method ?? 'GET') === method;
      const pathMatches =
        route.path instanceof RegExp
          ? route.path.test(path)
          : path === route.path;

      if (methodMatches && pathMatches) {
        return {
          ok: route.status ? route.status < 400 : true,
          status: route.status ?? 200,
          text: async () =>
            route.body === undefined ? '' : JSON.stringify(route.body),
        };
      }
    }

    return { ok: false, status: 404, text: async () => JSON.stringify({ code: 'NOT_FOUND' }) };
  });
}
