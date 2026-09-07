/**
 * Merkezî API istemcisi.
 *
 * Sorumlulukları:
 *  - Temel URL çözümlemesi (VITE_API_URL sözleşmesi korunur)
 *  - Authorization başlığının eklenmesi
 *  - JSON ayrıştırma (boş gövde güvenli)
 *  - HTTP hatalarının tiplenmiş ApiError'a dönüştürülmesi
 *  - 401 / 403 ayrımı
 *  - AbortSignal ile iptal
 *
 * Backend sözleşmesi değiştirilmez; bu yalnızca bir taşıma katmanıdır.
 */

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/** Uygulama genelinde ayırt edilebilir hata sınıfları. */
export const ErrorKind = Object.freeze({
  NETWORK: 'network',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  VALIDATION: 'validation',
  SERVER: 'server',
  UNAVAILABLE: 'unavailable',
  ABORTED: 'aborted',
  UNKNOWN: 'unknown',
});

export class ApiError extends Error {
  constructor({ kind, status = 0, code = null, message, payload = null }) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.payload = payload;
  }

  get isAuthProblem() {
    return this.kind === ErrorKind.UNAUTHORIZED || this.kind === ErrorKind.FORBIDDEN;
  }
}

/** HTTP durum kodunu dahilî hata sınıfına eşler. */
function kindFromStatus(status) {
  if (status === 401) return ErrorKind.UNAUTHORIZED;
  if (status === 403) return ErrorKind.FORBIDDEN;
  if (status === 404) return ErrorKind.NOT_FOUND;
  if (status === 400 || status === 422) return ErrorKind.VALIDATION;
  if (status === 503) return ErrorKind.UNAVAILABLE;
  if (status >= 500) return ErrorKind.SERVER;
  return ErrorKind.UNKNOWN;
}

/** Kullanıcıya gösterilebilir, ham olmayan mesajlar. */
const FALLBACK_MESSAGE = {
  [ErrorKind.NETWORK]: 'Sunucuya ulaşılamıyor. Ağ bağlantınızı kontrol edin.',
  [ErrorKind.UNAUTHORIZED]: 'Oturumunuz sona ermiş. Lütfen yeniden giriş yapın.',
  [ErrorKind.FORBIDDEN]: 'Bu kaynak için yetkiniz bulunmuyor.',
  [ErrorKind.NOT_FOUND]: 'İstenen kayıt bulunamadı.',
  [ErrorKind.VALIDATION]: 'Gönderilen bilgiler geçersiz.',
  [ErrorKind.SERVER]: 'Sunucuda beklenmeyen bir hata oluştu.',
  [ErrorKind.UNAVAILABLE]: 'Servis şu anda kullanılamıyor.',
  [ErrorKind.UNKNOWN]: 'Beklenmeyen bir hata oluştu.',
};

/** Yanıt gövdesini güvenli biçimde JSON'a çevirir (204 / boş gövde toleranslı). */
async function readBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Oturum sona erdiğinde tetiklenen dinleyiciler.
 * AuthProvider bunu dinleyerek oturumu temizler.
 */
const unauthorizedListeners = new Set();

export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function notifyUnauthorized() {
  unauthorizedListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* dinleyici hataları isteği etkilemez */
    }
  });
}

/**
 * Temel istek fonksiyonu.
 *
 * @param {string} path                      '/api/...' ile başlayan yol
 * @param {object} [options]
 * @param {string} [options.method]          HTTP metodu
 * @param {object} [options.body]            JSON gövdesi
 * @param {string|null} [options.token]      JWT erişim jetonu
 * @param {AbortSignal} [options.signal]     iptal sinyali
 * @param {number[]} [options.acceptStatus]  hata sayılmayacak ek durum kodları
 * @returns {Promise<{data: any, status: number}>}
 */
export async function apiFetch(path, options = {}) {
  const {
    method = 'GET',
    body,
    token = null,
    signal,
    acceptStatus = [],
  } = options;

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ApiError({
        kind: ErrorKind.ABORTED,
        message: 'İstek iptal edildi.',
      });
    }
    throw new ApiError({
      kind: ErrorKind.NETWORK,
      message: FALLBACK_MESSAGE[ErrorKind.NETWORK],
    });
  }

  const payload = await readBody(response);

  // Çağıran taraf belirli bir durumu "başarı" sayabilir (ör. sağlık için 503).
  if (response.ok || acceptStatus.includes(response.status)) {
    return { data: payload, status: response.status };
  }

  const kind = kindFromStatus(response.status);

  if (kind === ErrorKind.UNAUTHORIZED) notifyUnauthorized();

  // Backend `{ code, message }` biçimini kullanır; varsa onu tercih ederiz.
  const serverMessage =
    payload && typeof payload === 'object' && typeof payload.message === 'string'
      ? payload.message
      : null;

  throw new ApiError({
    kind,
    status: response.status,
    code: payload?.code ?? null,
    message: serverMessage || FALLBACK_MESSAGE[kind] || FALLBACK_MESSAGE[ErrorKind.UNKNOWN],
    payload,
  });
}

/* --------------------------------------------------------------------------
   Uç nokta sarmalayıcıları — backend sözleşmesinin birebir yansıması.
   Yeni alan uydurulmaz; yalnızca var olan uçlar çağrılır.
   -------------------------------------------------------------------------- */

export const endpoints = {
  /** POST /api/auth/login — açık uç. → { accessToken, expiresAt, role } */
  login: (credentials, signal) =>
    apiFetch('/api/auth/login', { method: 'POST', body: credentials, signal }),

  /** GET /api/frauds/recent — Admin + Analyst. Son 20 şüpheli işlem. */
  recentFrauds: (token, signal) =>
    apiFetch('/api/frauds/recent', { token, signal }),

  /** GET /api/transaction-users/{id} — Admin + Analyst. */
  userSummary: (userId, token, signal) =>
    apiFetch(`/api/transaction-users/${encodeURIComponent(userId)}`, { token, signal }),

  /** GET /api/transaction-users/{id}/transactions — son 20 işlem. */
  userTransactions: (userId, token, signal) =>
    apiFetch(`/api/transaction-users/${encodeURIComponent(userId)}/transactions`, {
      token,
      signal,
    }),

  /** GET /api/system/health — yalnızca Admin. 503 geçerli bir yanıttır. */
  systemHealth: (token, signal) =>
    apiFetch('/api/system/health', { token, signal, acceptStatus: [503] }),

  /** POST /api/transactions — yalnızca Admin. → 202 { transactionId, status } */
  submitTransaction: (payload, token, signal) =>
    apiFetch('/api/transactions', { method: 'POST', body: payload, token, signal }),

  /** GET /api/admin/users — yalnızca Admin. Panel kullanıcı hesapları. */
  adminUsers: (token, signal) =>
    apiFetch('/api/admin/users', { token, signal }),
};

/** WebSocket URL'i — backend'in `?access_token=` sözleşmesini korur. */
export function buildWebSocketUrl(token) {
  const protocol = API_BASE.startsWith('https') ? 'wss' : 'ws';
  const host = API_BASE.replace(/^https?:\/\//, '');
  return `${protocol}://${host}/ws?access_token=${encodeURIComponent(token)}`;
}
