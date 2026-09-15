const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
export const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/ws';

function authHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers ?? {}) },
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    if (window.location.hash !== '#/login') window.location.href = '/#/login';
    throw new Error('Unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (username, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  submitTransaction: (userId, amount, location) =>
    request('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ userId, amount, location }),
    }),
  userDetail: (userId) => request(`/api/transaction-users/${encodeURIComponent(userId)}`),
  userHistory: (userId) =>
    request(`/api/transaction-users/${encodeURIComponent(userId)}/transactions`),
  recentFrauds: () => request('/api/frauds/recent'),
  recentTransactions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/transactions/recent${qs ? `?${qs}` : ''}`);
  },
  dashboardSummary: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/dashboard/summary${qs ? `?${qs}` : ''}`);
  },
  dashboardSeries: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/dashboard/series${qs ? `?${qs}` : ''}`);
  },
  adminUsers: () => request('/api/admin/users'),
  health: () => request('/api/system/health'),
};
