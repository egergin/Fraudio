import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import DashboardPage from '../pages/DashboardPage.jsx';
import FraudQueue from '../components/data/FraudQueue.jsx';
import { ConnectionState } from '../hooks/useLiveStream.js';
import { clearSession, mockFetch, renderApp, seedSession } from './utils.jsx';

/**
 * Dashboard — operasyon duruşu, canlı/kalıcı veri ayrımı ve duyarlı yerleşim.
 */

const idleLive = {
  connection: ConnectionState.CONNECTED,
  events: [],
  liveAlerts: [],
  totalReceived: 0,
  totalSuspicious: 0,
  totalApproved: 0,
  lastEventAt: null,
  connectedSince: Date.now(),
  isConnected: true,
  reconnect: vi.fn(),
};

const HEALTHY = {
  path: '/api/system/health',
  body: { postgreSql: 'Healthy', redis: 'Healthy', rabbitMq: 'Healthy' },
};

const criticalFraud = {
  transactionId: 'aaaa',
  userId: 'customer-999',
  amount: 9000,
  city: 'Tokyo',
  status: 'Suspicious',
  occurredAt: new Date().toISOString(),
  triggeredRules: ['Velocity', 'Amount', 'Location'],
};

beforeEach(() => clearSession());
afterEach(() => {
  vi.restoreAllMocks();
  clearSession();
});

describe('DashboardPage', () => {
  it('her şey sakinken sakin duruş gösterir', async () => {
    seedSession({ role: 'Admin' });
    globalThis.fetch = mockFetch([{ path: '/api/frauds/recent', body: [] }, HEALTHY]);

    const { container } = renderApp(<DashboardPage live={idleLive} />);

    await screen.findByText('İnceleme kuyruğu');
    // Sakin durumda arayüz nötr kalmalı: kritik/uyarı kenarı olmamalı.
    const summary = container.querySelector('[aria-label="Operasyon durumu"]');
    expect(summary.className).toMatch(/border-l-ok/);
    expect(within(summary).getByText('şüpheli işlem')).toBeInTheDocument();
    // Baskın figür sıfır olmalı.
    expect(summary.querySelector('.text-3xl')).toHaveTextContent('0');
  });

  it('kritik uyarı varsa duruşu yükseltir', async () => {
    seedSession({ role: 'Admin' });
    globalThis.fetch = mockFetch([
      { path: '/api/frauds/recent', body: [criticalFraud] },
      HEALTHY,
    ]);

    const { container } = renderApp(<DashboardPage live={idleLive} />);

    await screen.findByText('kritik uyarı');
    const summary = container.querySelector('[aria-label="Operasyon durumu"]');
    expect(summary.className).toMatch(/border-l-critical/);
    expect(summary.querySelector('.text-3xl')).toHaveTextContent('1');
  });

  it('servis hatasında bozulmuş duruşu bildirir', async () => {
    seedSession({ role: 'Admin' });
    globalThis.fetch = mockFetch([
      { path: '/api/frauds/recent', body: [] },
      {
        path: '/api/system/health',
        status: 503,
        body: { postgreSql: 'Healthy', redis: 'Unhealthy', rabbitMq: 'Healthy' },
      },
    ]);

    renderApp(<DashboardPage live={idleLive} />);

    // Bozulmuş servis hem şeritte hem servis listesinde ayırt edilebilmeli.
    expect(await screen.findByText('Bozulmuş')).toBeInTheDocument();
    expect(screen.getByText('Hatalı')).toBeInTheDocument();
  });

  it('oturum sayacını kalıcı sayıdan ayırt eder', async () => {
    seedSession({ role: 'Admin' });
    globalThis.fetch = mockFetch([
      { path: '/api/frauds/recent', body: [criticalFraud] },
      HEALTHY,
    ]);

    renderApp(
      <DashboardPage
        live={{ ...idleLive, events: [criticalFraud], totalSuspicious: 1 }}
      />
    );

    // WS kaynaklı sayaç "oturum" olarak etiketli kalmalı; geçmiş toplam gibi
    // sunulursa analist yanlış sonuç çıkarır.
    expect(await screen.findByText('oturum olayı')).toBeInTheDocument();
    expect(screen.getByText('oturumda şüpheli')).toBeInTheDocument();
    // Kalıcı sayı ise baskın figürde durur.
    expect(screen.getByText('kritik uyarı')).toBeInTheDocument();
  });

  it('Analist rolüne sağlık panelini yetkisiz olarak gösterir ve uç noktayı çağırmaz', async () => {
    seedSession({ role: 'Analyst', username: 'analyst' });
    const spy = mockFetch([{ path: '/api/frauds/recent', body: [] }]);
    globalThis.fetch = spy;

    renderApp(<DashboardPage live={idleLive} />);

    expect(await screen.findByText('Yönetici rolü gerekir')).toBeInTheDocument();
    const healthCalls = spy.mock.calls.filter(([url]) =>
      String(url).includes('/api/system/health')
    );
    expect(healthCalls).toHaveLength(0);
  });

  it('canlı akış kesikken yeniden bağlanma eylemi sunar', async () => {
    seedSession({ role: 'Admin' });
    globalThis.fetch = mockFetch([{ path: '/api/frauds/recent', body: [] }, HEALTHY]);

    renderApp(
      <DashboardPage
        live={{ ...idleLive, connection: ConnectionState.DISCONNECTED, isConnected: false }}
      />
    );

    expect(await screen.findByText('Akış kesildi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /yeniden bağlan/i })).toBeInTheDocument();
  });
});

describe('FraudQueue — duyarlı yerleşim', () => {
  const rows = [criticalFraud];

  it('geniş ekranda erişilebilir tablo render eder', () => {
    seedSession();
    renderApp(<FraudQueue rows={rows} onInspect={() => {}} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    // İçerik tek kez bulunmalı (çift render yok).
    expect(screen.getAllByText('customer-999')).toHaveLength(1);
  });

  it('dar ekranda tablo yerine yığılmış liste render eder', () => {
    window.matchMedia = (query) => ({
      matches: query.includes('720px'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    });

    seedSession();
    renderApp(<FraudQueue rows={rows} onInspect={() => {}} />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByText('customer-999')).toHaveLength(1);
  });
});
