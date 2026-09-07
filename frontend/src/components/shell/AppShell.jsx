import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { Button } from '../ui/primitives.jsx';
import ConnectionIndicator from './ConnectionIndicator.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { isAdmin, roleLabel } from '../../lib/domain.js';
import { initials } from '../../lib/format.js';

/** Gezinme yapısı — yalnızca backend'in desteklediği yetenekler. */
const NAV_GROUPS = [
  {
    label: 'İzleme',
    items: [
      { to: '/', end: true, icon: 'dashboard', label: 'Genel Bakış' },
      { to: '/alerts', icon: 'shieldAlert', label: 'Dolandırıcılık', badge: 'alerts' },
      { to: '/stream', icon: 'activity', label: 'Canlı Akış' },
    ],
  },
  {
    label: 'Yönetim',
    adminOnly: true,
    items: [
      { to: '/health', icon: 'health', label: 'Sistem Sağlığı' },
      { to: '/submit', icon: 'send', label: 'İşlem Gönder' },
      { to: '/accounts', icon: 'users', label: 'Panel Hesapları' },
    ],
  },
];

function BrandMark() {
  return (
    <span className="brand__mark" aria-hidden="true">
      <Icon name="bolt" size={15} strokeWidth={2} />
    </span>
  );
}

function NavItems({ role, alertCount, onNavigate }) {
  const admin = isAdmin(role);

  return NAV_GROUPS.filter((group) => !group.adminOnly || admin).map((group) => (
    <div className="nav-group" key={group.label}>
      <p className="nav-group__label">{group.label}</p>
      {group.items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className="nav-item"
          onClick={onNavigate}
        >
          <Icon name={item.icon} size={15} className="nav-item__icon" />
          <span className="nav-item__label">{item.label}</span>
          {item.badge === 'alerts' && alertCount > 0 && (
            <span className="nav-item__count" aria-label={`${alertCount} şüpheli işlem`}>
              {alertCount > 99 ? '99+' : alertCount}
            </span>
          )}
        </NavLink>
      ))}
    </div>
  ));
}

/**
 * Uygulama kabuğu: marka, üst çubuk bağlamı, yan gezinme, oturum bilgisi.
 * Mobilde yan gezinme odak tuzaklı bir çekmeceye dönüşür.
 */
export function AppShell({ live, alertCount = 0, pageTitle, children }) {
  const { role, username, signOut } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const toggleRef = useRef(null);
  const navRef = useRef(null);

  // Yönlendirme değişince mobil çekmece kapanır.
  useEffect(() => setNavOpen(false), [location.pathname]);

  // Escape ile kapatma + odağı tetikleyiciye geri verme.
  useEffect(() => {
    if (!navOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setNavOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navOpen]);

  // Çekmece açıldığında ilk bağlantıya odaklan.
  useEffect(() => {
    if (navOpen) navRef.current?.querySelector('a')?.focus();
  }, [navOpen]);

  return (
    <div className="shell" data-nav-open={navOpen}>
      <a className="skip-link" href="#main">
        İçeriğe geç
      </a>

      <div className="shell__brand">
        <Link to="/" className="brand" aria-label="Fraudio ana sayfa">
          <BrandMark />
          <span className="brand__text">
            <span className="brand__name">Fraudio</span>
            <span className="brand__tag">Fraud Operations</span>
          </span>
        </Link>
      </div>

      <header className="shell__topbar">
        <div className="topbar__left">
          <Button
            ref={toggleRef}
            className="nav-toggle"
            variant="ghost"
            icon="menu"
            aria-label={navOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            aria-expanded={navOpen}
            aria-controls="app-nav"
            onClick={() => setNavOpen((open) => !open)}
          />
          <h1 className="topbar__title">{pageTitle}</h1>
        </div>

        <div className="topbar__right">
          <ConnectionIndicator state={live.connection} onReconnect={live.reconnect} />
          <span className="topbar__divider" aria-hidden="true" />
          <span className="user-chip" title={username ? `Oturum: ${username}` : undefined}>
            <span className="user-chip__avatar" aria-hidden="true">
              {initials(username || role || '?')}
            </span>
            <span className="user-chip__meta">
              <span className="user-chip__role">{username || 'Kullanıcı'}</span>
              <span className="user-chip__sub">{roleLabel(role)}</span>
            </span>
          </span>
          <Button
            variant="ghost"
            icon="logout"
            onClick={() => signOut()}
            aria-label="Oturumu kapat"
            title="Oturumu kapat"
          />
        </div>
      </header>

      {/* Mobil çekmece için arka plan örtüsü */}
      <div
        className="nav-scrim"
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />

      <nav
        className="shell__nav"
        id="app-nav"
        ref={navRef}
        aria-label="Ana gezinme"
        aria-hidden={undefined}
      >
        <div className="nav__mobile-brand">
          <Link to="/" className="brand">
            <BrandMark />
            <span className="brand__text">
              <span className="brand__name">Fraudio</span>
            </span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            icon="close"
            onClick={() => setNavOpen(false)}
            aria-label="Menüyü kapat"
          />
        </div>

        <NavItems role={role} alertCount={alertCount} onNavigate={() => setNavOpen(false)} />

        <div className="nav__spacer" />

      </nav>

      <main className="shell__main" id="main">
        {children}
      </main>
    </div>
  );
}

export default AppShell;
