import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth.jsx';
import { RealtimeBus } from './realtime.jsx';
import { Login, RequireAuth } from './pages/Login.jsx';
import { Shell } from './components/Shell.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Alerts } from './pages/Alerts.jsx';
import { LiveTransactions } from './pages/LiveTransactions.jsx';
import { SystemStatus } from './pages/SystemStatus.jsx';
import { UserDetail } from './pages/UserDetail.jsx';
import './styles/tokens.css';
import './styles/app.css';

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <RealtimeBus>
                  <Shell />
                </RealtimeBus>
              </RequireAuth>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/uyarilar" element={<Alerts />} />
            <Route path="/canli" element={<LiveTransactions />} />
            <Route path="/sistem" element={<SystemStatus />} />
            <Route path="/users/:userId" element={<UserDetail />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
