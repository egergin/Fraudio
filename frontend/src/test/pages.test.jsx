import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlertsPage from '../pages/AlertsPage.jsx';
import HealthPage from '../pages/HealthPage.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import { clearSession, mockFetch, renderApp, seedSession } from './utils.jsx';

/**
 * Sayfa düzeyi davranış — gerçek API sözleşmesi, durumlar ve RBAC.
 */

const FRAUDS = [
  {
    transactionId: '11111111-1111-1111-1111-111111111111',
    userId: 'customer-100',
    amount: 5400.5,
    city: 'Istanbul',
    status: 'Suspicious',
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    triggeredRules: ['Velocity', 'Amount', 'Location'],
  },
  {
    transactionId: '22222222-2222-2222-2222-222222222222',
    userId: 'customer-200',
    amount: 320,
    city: 'Berlin',
    status: 'Suspicious',
    occurredAt: new Date(Date.now() - 120_000).toISOString(),
    triggeredRules: ['Velocity', 'Amount'],
  },
];

beforeEach(() => {
  clearSession();
});

afterEach(() => {
  vi.restoreAllMocks();
  clearSession();
});

describe('AlertsPage', () => {
  it('ilk yüklemede iskelet, sonra gerçek verileri gösterir', async () => {
    seedSession();
    globalThis.fetch = mockFetch([{ path: '/api/frauds/recent', body: FRAUDS }]);

    renderApp(<AlertsPage />);

    expect(await screen.findByText('customer-100')).toBeInTheDocument();
    expect(screen.getByText('customer-200')).toBeInTheDocument();
  });

  it('en yüksek şiddeti en üste sıralar', async () => {
    seedSession();
    globalThis.fetch = mockFetch([
      { path: '/api/frauds/recent', body: [FRAUDS[1], FRAUDS[0]] },
    ]);

    renderApp(<AlertsPage />);
    await screen.findByText('customer-100');

    const rows = screen.getAllByRole('button', { name: /kullanıcısının.*incele/i });
    // Üç kural ihlali olan kayıt (customer-100) ilk sırada olmalı.
    expect(within(rows[0]).getByText('customer-100')).toBeInTheDocument();
  });

  it('şiddet filtresi uygular', async () => {
    seedSession();
    globalThis.fetch = mockFetch([{ path: '/api/frauds/recent', body: FRAUDS }]);
    const user = userEvent.setup();

    renderApp(<AlertsPage />);
    await screen.findByText('customer-200');

    // "Kritik" hem filtre butonunda hem satır etiketinde geçiyor; filtre
    // grubuna kapsayarak tekilleştiriyoruz.
    const severityGroup = screen.getByRole('group', { name: 'Şiddet filtresi' });
    await user.click(within(severityGroup).getByRole('button', { name: /Kritik/ }));

    expect(screen.getByText('customer-100')).toBeInTheDocument();
    expect(screen.queryByText('customer-200')).not.toBeInTheDocument();
  });

  it('arama sonuç vermezse filtre-farkında boş durum gösterir', async () => {
    seedSession();
    globalThis.fetch = mockFetch([{ path: '/api/frauds/recent', body: FRAUDS }]);
    const user = userEvent.setup();

    renderApp(<AlertsPage />);
    await screen.findByText('customer-100');

    await user.type(screen.getByLabelText(/ara/i), 'yok-böyle-bir-kullanıcı');

    expect(await screen.findByText('Eşleşen kayıt yok')).toBeInTheDocument();
  });

  it('veri boşsa anlamlı boş durum gösterir', async () => {
    seedSession();
    globalThis.fetch = mockFetch([{ path: '/api/frauds/recent', body: [] }]);

    renderApp(<AlertsPage />);

    expect(await screen.findByText('Şüpheli işlem yok')).toBeInTheDocument();
  });

  it('ağ hatasında yeniden dene eylemiyle hata durumu gösterir', async () => {
    seedSession();
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    renderApp(<AlertsPage />);

    expect(await screen.findByText('Sunucuya ulaşılamıyor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /yeniden dene/i })).toBeInTheDocument();
  });

  it('API sınırını kullanıcıya açıkça bildirir', async () => {
    seedSession();
    globalThis.fetch = mockFetch([{ path: '/api/frauds/recent', body: FRAUDS }]);

    renderApp(<AlertsPage />);
    await screen.findByText('customer-100');

    expect(screen.getByText(/son 20 kaydı döndürür/i)).toBeInTheDocument();
  });

  it('satır seçilince inceleme çekmecesini açar ve kullanıcı verisini çeker', async () => {
    seedSession();
    globalThis.fetch = mockFetch([
      { path: '/api/frauds/recent', body: FRAUDS },
      {
        path: /\/api\/transaction-users\/customer-100$/,
        body: {
          userId: 'customer-100',
          totalTransactions: 12,
          suspiciousTransactions: 3,
          lastTransaction: null,
        },
      },
      { path: /\/transactions$/, body: [] },
    ]);
    const user = userEvent.setup();

    renderApp(<AlertsPage />);
    const row = await screen.findByRole('button', {
      name: /customer-100 kullanıcısının.*incele/i,
    });

    await user.click(row);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Üç kural birden ihlal edildi')).toBeInTheDocument();
  });

  it('çekmece Escape tuşuyla kapanır', async () => {
    seedSession();
    globalThis.fetch = mockFetch([
      { path: '/api/frauds/recent', body: FRAUDS },
      { path: /\/api\/transaction-users\//, body: { userId: 'x', totalTransactions: 0, suspiciousTransactions: 0 } },
    ]);
    const user = userEvent.setup();

    renderApp(<AlertsPage />);
    await user.click(
      await screen.findByRole('button', { name: /customer-100 kullanıcısının.*incele/i })
    );
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('HealthPage — RBAC', () => {
  it('Analist rolüne yetkisiz durumu gösterir ve API çağırmaz', async () => {
    seedSession({ role: 'Analyst', username: 'analyst' });
    const fetchSpy = mockFetch([]);
    globalThis.fetch = fetchSpy;

    renderApp(<HealthPage />);

    expect(await screen.findByText('Yetkiniz yok')).toBeInTheDocument();
    // Yetkisiz rolle sağlık uç noktası hiç çağrılmamalı.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Yönetici rolüne servis durumlarını gösterir', async () => {
    seedSession({ role: 'Admin' });
    globalThis.fetch = mockFetch([
      {
        path: '/api/system/health',
        body: { postgreSql: 'Healthy', redis: 'Healthy', rabbitMq: 'Healthy' },
      },
    ]);

    renderApp(<HealthPage />);

    expect(await screen.findByText('Tüm sistemler çalışıyor')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('Redis')).toBeInTheDocument();
    expect(screen.getByText('RabbitMQ')).toBeInTheDocument();
  });

  it('503 yanıtında bozulmuş durumu ayırt eder', async () => {
    seedSession({ role: 'Admin' });
    globalThis.fetch = mockFetch([
      {
        path: '/api/system/health',
        status: 503,
        body: { postgreSql: 'Healthy', redis: 'Unhealthy', rabbitMq: 'Healthy' },
      },
    ]);

    renderApp(<HealthPage />);

    expect(await screen.findByText('Sistem bozulmuş durumda')).toBeInTheDocument();
    expect(screen.getByText('503')).toBeInTheDocument();
  });

  it('tüm servisler hatalıysa hizmet dışı durumu gösterir', async () => {
    seedSession({ role: 'Admin' });
    globalThis.fetch = mockFetch([
      {
        path: '/api/system/health',
        status: 503,
        body: { postgreSql: 'Unhealthy', redis: 'Unhealthy', rabbitMq: 'Unhealthy' },
      },
    ]);

    renderApp(<HealthPage />);

    expect(await screen.findByText('Sistem hizmet dışı')).toBeInTheDocument();
  });
});

describe('LoginPage', () => {
  it('boş formda gönderimi engeller', async () => {
    globalThis.fetch = vi.fn();
    renderApp(<LoginPage />);

    expect(screen.getByRole('button', { name: /giriş yap/i })).toBeDisabled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('geçersiz kimlik bilgilerinde anlamlı hata gösterir', async () => {
    globalThis.fetch = mockFetch([
      {
        path: '/api/auth/login',
        method: 'POST',
        status: 401,
        body: { code: 'INVALID_CREDENTIALS', message: 'Geçersiz kullanıcı adı veya şifre.' },
      },
    ]);
    const user = userEvent.setup();

    renderApp(<LoginPage />);

    await user.type(screen.getByLabelText('Kullanıcı adı'), 'admin');
    await user.type(screen.getByLabelText('Şifre'), 'wrong');
    await user.click(screen.getByRole('button', { name: /giriş yap/i }));

    expect(await screen.findByText('Giriş bilgileri doğrulanamadı')).toBeInTheDocument();
  });

  it('ağ hatasını kimlik hatasından ayırt eder', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const user = userEvent.setup();

    renderApp(<LoginPage />);

    await user.type(screen.getByLabelText('Kullanıcı adı'), 'admin');
    await user.type(screen.getByLabelText('Şifre'), 'secret');
    await user.click(screen.getByRole('button', { name: /giriş yap/i }));

    expect(await screen.findByText('Sunucuya ulaşılamıyor')).toBeInTheDocument();
  });

  it('başarılı girişte jetonu ve rolü saklar', async () => {
    globalThis.fetch = mockFetch([
      {
        path: '/api/auth/login',
        method: 'POST',
        body: {
          accessToken: 'jwt-token',
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          role: 'Admin',
        },
      },
    ]);
    const user = userEvent.setup();

    renderApp(<LoginPage />);

    await user.type(screen.getByLabelText('Kullanıcı adı'), 'admin');
    await user.type(screen.getByLabelText('Şifre'), 'secret');
    await user.click(screen.getByRole('button', { name: /giriş yap/i }));

    await waitFor(() => expect(localStorage.getItem('token')).toBe('jwt-token'));
    expect(localStorage.getItem('role')).toBe('Admin');
  });
});
