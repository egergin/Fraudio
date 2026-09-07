const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch(path, { token, signal, ...options } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  let payload = null;
  try { payload = await response.json(); } catch { /* empty response */ }
  if (!response.ok) {
    throw new ApiError(payload?.message || payload?.title || `İstek başarısız (${response.status})`, response.status);
  }
  return payload;
}

export { API_BASE };
