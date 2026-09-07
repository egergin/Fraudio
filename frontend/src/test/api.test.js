import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, endpoints, ErrorKind, ApiError, buildWebSocketUrl } from '../lib/api.js';

/**
 * API katmanı — backend sözleşmesinin korunduğunu doğrular.
 * Yol, metot ve başlıklar backend controller'larıyla birebir eşleşmelidir.
 */

function stubFetch(response) {
  const spy = vi.fn(async () => response);
  globalThis.fetch = spy;
  return spy;
}

const okResponse = (body, status = 200) => ({
  ok: status < 400,
  status,
  text: async () => JSON.stringify(body),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiFetch', () => {
  it('Authorization başlığını Bearer şemasıyla ekler', async () => {
    const spy = stubFetch(okResponse({ ok: true }));
    await apiFetch('/api/frauds/recent', { token: 'abc123' });

    const [, init] = spy.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer abc123');
  });

  it('jeton yoksa Authorization başlığı göndermez', async () => {
    const spy = stubFetch(okResponse({}));
    await apiFetch('/api/auth/login', { method: 'POST', body: {} });

    const [, init] = spy.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('401 yanıtını UNAUTHORIZED olarak sınıflandırır', async () => {
    stubFetch(okResponse({ code: 'INVALID_CREDENTIALS', message: 'Geçersiz.' }, 401));

    await expect(apiFetch('/api/frauds/recent', { token: 't' })).rejects.toMatchObject({
      kind: ErrorKind.UNAUTHORIZED,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('403 yanıtını FORBIDDEN olarak ayırt eder', async () => {
    stubFetch(okResponse({}, 403));

    await expect(apiFetch('/api/system/health', { token: 't' })).rejects.toMatchObject({
      kind: ErrorKind.FORBIDDEN,
    });
  });

  it('404 yanıtını NOT_FOUND olarak sınıflandırır', async () => {
    stubFetch(okResponse({ code: 'USER_NOT_FOUND', message: 'Kullanıcı kaydı bulunamadı.' }, 404));

    await expect(apiFetch('/api/transaction-users/x', { token: 't' })).rejects.toMatchObject({
      kind: ErrorKind.NOT_FOUND,
      message: 'Kullanıcı kaydı bulunamadı.',
    });
  });

  it('acceptStatus ile 503 yanıtını geçerli veri olarak kabul eder', async () => {
    stubFetch(okResponse({ postgreSql: 'Healthy', redis: 'Unhealthy', rabbitMq: 'Healthy' }, 503));

    const { data, status } = await endpoints.systemHealth('t');
    expect(status).toBe(503);
    expect(data.redis).toBe('Unhealthy');
  });

  it('ağ hatasını NETWORK olarak sarmalar', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(apiFetch('/api/frauds/recent', { token: 't' })).rejects.toMatchObject({
      kind: ErrorKind.NETWORK,
    });
  });

  it('iptal edilen isteği ABORTED olarak işaretler', async () => {
    globalThis.fetch = vi.fn(async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    });

    await expect(apiFetch('/api/frauds/recent', { token: 't' })).rejects.toMatchObject({
      kind: ErrorKind.ABORTED,
    });
  });

  it('boş gövdeyi hatasız işler', async () => {
    stubFetch({ ok: true, status: 204, text: async () => '' });
    const { data } = await apiFetch('/api/x', { token: 't' });
    expect(data).toBeNull();
  });
});

describe('endpoints — backend sözleşmesi', () => {
  it('doğru yol ve metotları kullanır', async () => {
    const spy = stubFetch(okResponse([]));

    await endpoints.login({ username: 'a', password: 'b' });
    expect(spy.mock.calls[0][0]).toMatch(/\/api\/auth\/login$/);
    expect(spy.mock.calls[0][1].method).toBe('POST');

    await endpoints.recentFrauds('t');
    expect(spy.mock.calls[1][0]).toMatch(/\/api\/frauds\/recent$/);

    await endpoints.userSummary('customer-100', 't');
    expect(spy.mock.calls[2][0]).toMatch(/\/api\/transaction-users\/customer-100$/);

    await endpoints.userTransactions('customer-100', 't');
    expect(spy.mock.calls[3][0]).toMatch(
      /\/api\/transaction-users\/customer-100\/transactions$/
    );

    await endpoints.systemHealth('t');
    expect(spy.mock.calls[4][0]).toMatch(/\/api\/system\/health$/);

    await endpoints.submitTransaction({ userId: 'u', amount: 1, location: 'x' }, 't');
    expect(spy.mock.calls[5][0]).toMatch(/\/api\/transactions$/);
    expect(spy.mock.calls[5][1].method).toBe('POST');

    await endpoints.adminUsers('t');
    expect(spy.mock.calls[6][0]).toMatch(/\/api\/admin\/users$/);
  });

  it('kullanıcı kimliğini URL için kodlar', async () => {
    const spy = stubFetch(okResponse({}));
    await endpoints.userSummary('customer 100/../x', 't');
    expect(spy.mock.calls[0][0]).toContain('customer%20100%2F..%2Fx');
  });
});

describe('buildWebSocketUrl', () => {
  it('access_token sorgu parametresi sözleşmesini korur', () => {
    const url = buildWebSocketUrl('abc 123');
    expect(url).toMatch(/^ws:\/\//);
    expect(url).toContain('/ws?access_token=abc%20123');
  });
});

describe('ApiError', () => {
  it('yetki sorunlarını ayırt eder', () => {
    expect(new ApiError({ kind: ErrorKind.FORBIDDEN, message: 'x' }).isAuthProblem).toBe(true);
    expect(new ApiError({ kind: ErrorKind.NETWORK, message: 'x' }).isAuthProblem).toBe(false);
  });
});
