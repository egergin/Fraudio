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
const PAGE_TITLES = {
  '/': 'Genel Bakış',
  '/alerts': 'Dolandırıcılık İzleme',
  '/stream': 'Canlı Akış',
  '/health': 'Sistem Sağlığı',
  '/submit': 'İşlem Gönder',
  '/accounts': 'Panel Hesapları',
};

function usePageTitle() {
  const { pathname } = useLocation();
  return useMemo(() => {
    if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
    if (pathname.startsWith('/users/')) return 'Kullanıcı Dosyası';
    return 'Fraudio';
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
  const title = usePageTitle();

  return (
    <AppShell
      live={live}
      alertCount={live.totalSuspicious}
      pageTitle={title}
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
