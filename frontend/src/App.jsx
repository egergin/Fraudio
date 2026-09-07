import { useMemo } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import AppShell from './components/shell/AppShell.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import AlertsPage from './pages/AlertsPage.jsx';
import StreamPage from './pages/StreamPage.jsx';
import UserDetailPage from './pages/UserDetailPage.jsx';
import HealthPage from './pages/HealthPage.jsx';
import SubmitTransactionPage from './pages/SubmitTransactionPage.jsx';
import AccountsPage from './pages/AccountsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import { useAuth } from './auth/AuthContext.jsx';
import { useLiveStream } from './hooks/useLiveStream.js';
import { isAdmin } from './lib/domain.js';

/** Rota → üst çubuk bağlamı. */
const PAGE_META = {
  '/': { title: 'Genel Bakış', meta: 'Operasyon durumu ve öncelikli incelemeler' },
  '/alerts': { title: 'Dolandırıcılık İzleme', meta: 'Şüpheli işlemler' },
  '/stream': { title: 'Canlı Akış', meta: 'Gerçek zamanlı işlem olayları' },
  '/health': { title: 'Sistem Sağlığı', meta: 'Altyapı bağımlılıkları' },
  '/submit': { title: 'İşlem Gönder', meta: 'Manuel işlem alımı' },
  '/accounts': { title: 'Panel Hesapları', meta: 'Kullanıcılar ve roller' },
};

function usePageMeta() {
  const { pathname } = useLocation();
  return useMemo(() => {
    if (PAGE_META[pathname]) return PAGE_META[pathname];
    if (pathname.startsWith('/users/')) {
      return { title: 'Kullanıcı Dosyası', meta: 'İnceleme görünümü' };
    }
    return { title: 'Fraudio', meta: null };
  }, [pathname]);
}

/** Yalnızca Yönetici rolüne açık rotalar için koruma. */
function AdminRoute({ children }) {
  const { role } = useAuth();
  // Sayfaların kendisi de yetkisiz durumunu gösterir; burada yalnızca
  // gezinmeyi engelliyoruz, backend RBAC'ı yine tek doğruluk kaynağıdır.
  return isAdmin(role) ? children : <Navigate to="/" replace />;
}

/** Kullanıcı kimliği boşsa uyarı listesine döndür. */
function UserRoute() {
  const { userId } = useParams();
  if (!userId) return <Navigate to="/alerts" replace />;
  return <UserDetailPage />;
}

/** Oturum açıkken gösterilen uygulama. */
function AuthenticatedApp() {
  const { token } = useAuth();
  const live = useLiveStream(token);
  const { title, meta } = usePageMeta();

  return (
    <AppShell
      live={live}
      alertCount={live.totalSuspicious}
      pageTitle={title}
      pageMeta={meta}
    >
      <Routes>
        <Route path="/" element={<DashboardPage live={live} />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/stream" element={<StreamPage live={live} />} />
        <Route path="/users/:userId" element={<UserRoute />} />
        <Route
          path="/health"
          element={
            <AdminRoute>
              <HealthPage />
            </AdminRoute>
          }
        />
        <Route
          path="/submit"
          element={
            <AdminRoute>
              <SubmitTransactionPage />
            </AdminRoute>
          }
        />
        <Route
          path="/accounts"
          element={
            <AdminRoute>
              <AccountsPage />
            </AdminRoute>
          }
        />
        {/* Eski giriş yolu doğrudan panele yönlenir */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <AuthenticatedApp /> : <LoginPage />;
}
