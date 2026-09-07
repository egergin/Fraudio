import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Activity,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Send,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import ConnectionIndicator from './ConnectionIndicator.jsx';
import { useAuth } from '@/auth/AuthContext.jsx';
import { isAdmin, roleLabel } from '@/lib/domain.js';
import { cn } from '@/lib/utils.js';

/** Gezinme — yalnızca backend'in gerçekten desteklediği yetenekler. */
const NAV = [
  {
    label: 'İzleme',
    items: [
      { to: '/', end: true, icon: LayoutDashboard, label: 'Genel Bakış' },
      { to: '/alerts', icon: ShieldAlert, label: 'Dolandırıcılık', badge: true },
      { to: '/stream', icon: Activity, label: 'Canlı Akış' },
    ],
  },
  {
    label: 'Yönetim',
    adminOnly: true,
    items: [
      { to: '/health', icon: HeartPulse, label: 'Sistem Sağlığı' },
      { to: '/submit', icon: Send, label: 'İşlem Gönder' },
      { to: '/accounts', icon: Users, label: 'Panel Hesapları' },
    ],
  },
];

function Wordmark({ compact = false }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="grid size-5 shrink-0 place-items-center rounded-sm bg-live text-[11px] font-bold text-fg-inverted"
      >
        F
      </span>
      {!compact && (
        <span className="text-sm font-semibold tracking-[-0.01em] text-fg">Fraudio</span>
      )}
    </span>
  );
}

function NavList({ role, alertCount, onNavigate }) {
  const admin = isAdmin(role);

  return NAV.filter((group) => !group.adminOnly || admin).map((group) => (
    <div key={group.label} className="flex flex-col gap-px">
      <p className="px-2 pb-1 pt-4 text-3xs font-semibold uppercase tracking-[0.1em] text-fg-subtle">
        {group.label}
      </p>
      {group.items.map(({ to, end, icon: Icon, label, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-xs transition-colors',
              isActive
                ? 'bg-elevated text-fg'
                : 'text-fg-secondary hover:bg-hover hover:text-fg'
            )
          }
        >
          {({ isActive }) => (
            <>
              {/* Aktif durum: ince sol işaret — belirgin ama sessiz. */}
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full transition-colors',
                  isActive ? 'bg-live' : 'bg-transparent'
                )}
              />
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate">{label}</span>
              {badge && alertCount > 0 && (
                <span className="tnum rounded-xs bg-critical-bg px-1 text-3xs font-semibold text-critical-fg">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </div>
  ));
}

/**
 * Uygulama kabuğu.
 *
 * Sabit kenar çubuğu + ince üst çubuk. Dekoratif öğe yok: marka, gezinme,
 * bağlantı durumu, rol, çıkış. Mobilde kenar çubuğu odak tuzaklı çekmece olur.
 */
export function AppShell({ live, alertCount = 0, pageTitle, children }) {
  const { role, username, signOut } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const toggleRef = useRef(null);
  const navRef = useRef(null);

  useEffect(() => setNavOpen(false), [location.pathname]);

  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setNavOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen]);

  useEffect(() => {
    if (navOpen) navRef.current?.querySelector('a')?.focus();
  }, [navOpen]);

  return (
    <div className="min-h-screen bg-bg">
      <a className="skip-link" href="#main">
        İçeriğe geç
      </a>

      {/* Kenar çubuğu — masaüstünde sabit */}
      <aside
        ref={navRef}
        id="app-nav"
        aria-label="Ana gezinme"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[200px] flex-col border-r border-line bg-surface px-2 pb-3',
          'transition-transform duration-200 ease-out lg:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-1">
          <Link to="/" aria-label="Fraudio ana sayfa">
            <Wordmark />
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setNavOpen(false)}
            aria-label="Menüyü kapat"
          >
            <X />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto">
          <NavList role={role} alertCount={alertCount} onNavigate={() => setNavOpen(false)} />
        </nav>
      </aside>

      {/* Mobil örtü */}
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="lg:pl-[200px]">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-bg/95 px-4 backdrop-blur-[2px]">
          <Button
            ref={toggleRef}
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label="Menüyü aç"
            aria-expanded={navOpen}
            aria-controls="app-nav"
            onClick={() => setNavOpen(true)}
          >
            <Menu />
          </Button>

          <h1 className="truncate text-sm font-semibold tracking-[-0.01em] text-fg">
            {pageTitle}
          </h1>

          <div className="ml-auto flex items-center gap-3">
            <ConnectionIndicator state={live.connection} onReconnect={live.reconnect} />

            <span className="hidden h-4 w-px bg-line-strong sm:block" aria-hidden="true" />

            <span className="hidden items-baseline gap-1.5 text-xs sm:flex">
              <span className="text-fg">{username || 'Kullanıcı'}</span>
              <span className="text-2xs text-fg-muted">{roleLabel(role)}</span>
            </span>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => signOut()}
              aria-label="Oturumu kapat"
              title="Oturumu kapat"
            >
              <LogOut />
            </Button>
          </div>
        </header>

        <main id="main" className="mx-auto max-w-[1640px] px-4 pb-16 pt-5 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
