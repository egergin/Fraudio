import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  FileText,
  Home,
  ListChecks,
  LogOut,
  Menu,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { tr } from '../i18n/tr.js';
import { useNotifications } from '../realtime.jsx';
import { Brand } from './Brand.jsx';
import { formatAmount, formatTime } from './ui.jsx';
import { SubmitTransactionDialog } from './SubmitTransactionDialog.jsx';

function SearchBox() {
  const [value, setValue] = useState('');
  const navigate = useNavigate();
  return (
    <form
      className="search-form"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (q) navigate(`/users/${encodeURIComponent(q)}`);
      }}
    >
      <label htmlFor="user-search" style={{ position: 'absolute', left: -9999 }}>
        {tr.nav.searchPlaceholder}
      </label>
      <input
        id="user-search"
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Burada ara..."
        autoComplete="off"
      />
      <Search size={22} aria-hidden="true" />
    </form>
  );
}

function Header({ onMenu, navOpen }) {
  const { username, role, logout } = useAuth();
  const { items, unread, markAllSeen, clearNotifications } = useNotifications();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const panelRef = useRef(null);
  const navigate = useNavigate();
  const isAdmin = role === 'Admin';
  const initial = (username ?? '?').slice(0, 1).toLocaleUpperCase('tr-TR');

  useEffect(() => {
    if (!panelOpen) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setPanelOpen(false);
    }
    function onClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setPanelOpen(false);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [panelOpen]);

  function togglePanel() {
    if (!panelOpen) markAllSeen();
    setPanelOpen((v) => !v);
  }

  function goAlerts() {
    setPanelOpen(false);
    navigate('/uyarilar');
  }

  return (
    <>
      <button
        className="icon-btn hamburger"
        type="button"
        aria-label={tr.nav.menu}
        aria-expanded={navOpen}
        onClick={onMenu}
      >
        {navOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <SearchBox />
      <div className="header-right">
        {isAdmin && (
          <button className="btn" type="button" onClick={() => setSubmitOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            {tr.nav.testTransaction}
          </button>
        )}
        <div className="bell-wrap" ref={panelRef}>
          <button
            className="bell-btn"
            type="button"
            onClick={togglePanel}
            aria-label={tr.notifications.bellLabel(unread)}
            aria-expanded={panelOpen}
            aria-haspopup="true"
          >
            <Bell size={22} aria-hidden="true" />
            {unread > 0 && (
              <span className="count" aria-hidden="true">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
          {panelOpen && (
            <div className="notif-panel" role="dialog" aria-label={tr.notifications.title}>
              <div className="notif-head">
                <strong>{tr.notifications.title}</strong>
                <span className="notif-head-actions">
                  {unread > 0 && <span className="badge bad">{unread} yeni</span>}
                  <button
                    className="icon-btn icon-btn-sm icon-btn-danger"
                    type="button"
                    title={tr.notifications.clear}
                    aria-label={tr.notifications.clear}
                    disabled={items.length === 0}
                    onClick={() => setConfirmOpen(true)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </span>
              </div>
              {items.length === 0 ? (
                <p className="notif-empty">{tr.notifications.empty}</p>
              ) : (
                <ul className="notif-list">
                  {items.slice(0, 8).map((n) => (
                    <li key={n.transactionId} className={n.seen ? '' : 'unseen'}>
                      <p className="notif-text">{tr.notifications.newSuspicious}</p>
                      <p className="notif-meta">
                        <Link to={`/users/${encodeURIComponent(n.userId)}`} onClick={() => setPanelOpen(false)}>
                          {n.userId}
                        </Link>
                        {' · '}
                        <span className="num">{formatAmount(n.amount)}</span> {n.city}
                        {' · '}
                        {formatTime(n.occurredAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <button className="notif-foot" type="button" onClick={goAlerts}>
                {tr.notifications.viewAll}
              </button>
            </div>
          )}
        </div>
        <span className="user-chip" title={`${username} (${role})`}>
          <span className="avatar-lg" aria-hidden="true">
            {initial}
          </span>
          <span className="who" style={{ display: 'none' }}>
            {username}
          </span>
        </span>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          <LogOut size={16} aria-hidden="true" />
          {tr.nav.logout}
        </button>
      </div>
      {submitOpen && <SubmitTransactionDialog onClose={() => setSubmitOpen(false)} />}
      {confirmOpen && (
        <ConfirmClearNotifications
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            clearNotifications();
            setConfirmOpen(false);
          }}
        />
      )}
    </>
  );
}

function ConfirmClearNotifications({ onCancel, onConfirm }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal modal-sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="clear-notif-title"
        aria-describedby="clear-notif-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="clear-notif-title">{tr.notifications.clear}</h2>
        <p className="sub" id="clear-notif-desc">
          {tr.notifications.confirmText}
        </p>
        <div className="modal-actions">
          <button ref={cancelRef} className="btn btn-ghost" type="button" onClick={onCancel}>
            {tr.common.cancel}
          </button>
          <button className="btn btn-danger" type="button" onClick={onConfirm}>
            {tr.notifications.clearAction}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Shell() {
  const { role, token } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useNavigate();
  const isAdmin = role === 'Admin';

  if (!token) return <Outlet />;

  return (
    <div className={`shell${navOpen ? ' nav-open' : ''}`}>
      <a className="skip-link" href="#icerik">
        {tr.nav.skip}
      </a>
      <button
        className="scrim"
        aria-label={tr.nav.close}
        tabIndex={-1}
        onClick={() => setNavOpen(false)}
      />
      <aside className="sidebar" aria-label="Ana menü">
        <Brand />
        <nav className="nav" aria-label="Birincil">
          <NavLink to="/" end className="nav-item" onClick={() => setNavOpen(false)}>
            <Home size={20} aria-hidden="true" />
            {tr.nav.dashboard}
          </NavLink>
          <NavLink to="/uyarilar" className="nav-item" onClick={() => setNavOpen(false)}>
            <ListChecks size={20} aria-hidden="true" />
            {tr.nav.alerts}
          </NavLink>
          <NavLink to="/canli" className="nav-item" onClick={() => setNavOpen(false)}>
            <FileText size={20} aria-hidden="true" />
            {tr.nav.live}
          </NavLink>
          {isAdmin && (
            <>
              <div className="nav-group" aria-hidden="true">
                YÖNETİM
              </div>
              <NavLink
                to="/sistem"
                className="nav-item"
                onClick={() => setNavOpen(false)}
              >
                <BarChart3 size={20} aria-hidden="true" />
                {tr.nav.system}
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-foot">Fraudio · v0.1.0</div>
      </aside>

      <div className="main">
        <header className="header">
          <Header onMenu={() => setNavOpen((v) => !v)} navOpen={navOpen} />
        </header>
        <main className="content" id="icerik" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function BackToDashboard() {
  return <Link to="/">← {tr.common.backToDashboard}</Link>;
}
