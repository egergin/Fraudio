import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import DashboardPage from '../pages/DashboardPage.jsx';
import FraudTable from '../components/data/FraudTable.jsx';
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
  it('her şey sakinken normal seyir duruşu gösterir', async () => {
    seedSession({ role: 'Admin' });
    globalThis.fetch = mockFetch([{ path: '/api/frauds/recent', body: [] }, HEALTHY]);

    renderApp(<DashboardPage live={idleLive} />);

    expect(await screen.findByText('Normal seyir')).toBeInTheDocument();
  });

  it('kritik uyarı varsa duruşu yükseltir', async () => {
    seedSession({ role: 'Admin' });
    globalThis.fetch = mockFetch([
      { path: '/api/frauds/recent', body: [criticalFraud] },
      HEALTHY,
    ]);

    renderApp(<DashboardPage live={idleLive} />);

    expect(await screen.findByText('1 kritik uyarı')).toBeInTheDocument();
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

    expect(await screen.findByText('Sistem bozulmuş durumda')).toBeInTheDocument();
  });

  it('oturum sayaçlarını geçmiş toplamdan ayırt eder', async () => {
    seedSession({ role: 'Admin' });
    globalThis.fetch = mockFetch([{ path: '/api/frauds/recent', body: [] }, HEALTHY]);

    renderApp(<DashboardPage live={idleLive} />);

    // WebSocket sayacı açıkça "geçmiş toplam değildir" olarak etiketlenmeli.
    expect(
      await screen.findByText(/Canlı akıştan sayıldı, geçmiş toplam değildir/i)
    ).toBeInTheDocument();
    // Kalıcı sayı ise API kaynağına atfedilmeli.
    expect(screen.getByText(/API'nin döndürdüğü son 20 kayıt/i)).toBeInTheDocument();
  });

  it('Analist rolüne sağlık panelini yetkisiz olarak gösterir ve uç noktayı çağırmaz', async () => {
    seedSession({ role: 'Analyst', username: 'analyst' });
    const spy = mockFetch([{ path: '/api/frauds/recent', body: [] }]);
    globalThis.fetch = spy;

    renderApp(<DashboardPage live={idleLive} />);

    expect(await screen.findByText('Erişim yetkiniz yok')).toBeInTheDocument();
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

    expect(await screen.findByText('Canlı akış bağlı değil')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /yeniden bağlan/i })).toBeInTheDocument();
  });
});

describe('FraudTable — duyarlı yerleşim', () => {
  const rows = [criticalFraud];

  it('geniş ekranda erişilebilir tablo render eder', () => {
    seedSession();
    renderApp(<FraudTable rows={rows} onInspect={() => {}} />);

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
    renderApp(<FraudTable rows={rows} onInspect={() => {}} />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByText('customer-999')).toHaveLength(1);
  });
});
