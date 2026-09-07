/**
 * Hafif satır içi ikon seti (stroke tabanlı, 1.5px, 24px ızgara).
 * Emoji yerine tutarlı, erişilebilir ve currentColor'a duyarlı grafikler.
 * Harici ikon paketi bağımlılığı eklemez.
 */

const PATHS = {
  shield: 'M12 3l7 3v5.5c0 4.2-2.9 8.1-7 9.5-4.1-1.4-7-5.3-7-9.5V6l7-3z',
  shieldAlert: 'M12 3l7 3v5.5c0 4.2-2.9 8.1-7 9.5-4.1-1.4-7-5.3-7-9.5V6l7-3zM12 8.5v4M12 15.5v.5',
  dashboard: 'M4 4h7v6H4V4zM13 4h7v10h-7V4zM4 12h7v8H4v-8zM13 16h7v4h-7v-4z',
  alert: 'M12 4l9 16H3l9-16zM12 10v4M12 17v.5',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  pulse: 'M3 12h4l2-5 3 10 2.5-6 1.5 3h5',
  health: 'M4 6h16v12H4zM4 10h16M8 14h3M8 6v12',
  server: 'M4 5h16v5H4zM4 14h16v5H4zM7.5 7.5h.01M7.5 16.5h.01',
  database: 'M4 6c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2zM4 6v12c0 1.1 3.6 2 8 2s8-.9 8-2V6M4 12c0 1.1 3.6 2 8 2s8-.9 8-2',
  queue: 'M4 7h16M4 12h16M4 17h10',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.3 3.6-6 8-6s8 2.7 8 6',
  users: 'M9 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2 20c0-3 3.1-5.5 7-5.5s7 2.5 7 5.5M17 6.2a3.5 3.5 0 010 6.6M19 20c0-2-.8-3.7-2-4.9',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  refresh: 'M20 11a8 8 0 10-1.5 6M20 5v6h-6',
  close: 'M6 6l12 12M18 6L6 18',
  chevronRight: 'M9 5l7 7-7 7',
  chevronDown: 'M5 9l7 7 7-7',
  arrowUpRight: 'M7 17L17 7M8 7h9v9',
  arrowRight: 'M4 12h16M14 6l6 6-6 6',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
  logout: 'M15 17l5-5-5-5M20 12H9M12 4H6a1 1 0 00-1 1v14a1 1 0 001 1h6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3.5 2',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  check: 'M5 12.5l4.5 4.5L19 7',
  checkCircle: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8.5 12.5l2.5 2.5 4.5-5',
  xCircle: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9 9l6 6M15 9l-6 6',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8v.5',
  warning: 'M10.3 4.3L2.6 18a2 2 0 001.7 3h15.4a2 2 0 001.7-3L13.7 4.3a2 2 0 00-3.4 0zM12 9v4M12 16.5v.5',
  inbox: 'M4 13h4l2 3h4l2-3h4M4 13l2.5-7h11L20 13v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z',
  plug: 'M9 3v6M15 3v6M6 9h12v3a6 6 0 01-12 0V9zM12 18v3',
  send: 'M21 3L3 10.5l7 3 3 7L21 3z',
  location: 'M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  gauge: 'M12 20a8 8 0 110-16 8 8 0 010 16zM12 12l4-3',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  filter: 'M3 5h18l-7 8v6l-4 2v-8L3 5z',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6l1-7z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zM12 15a3 3 0 100-6 3 3 0 000 6z',
  lock: 'M6 11h12v9H6v-9zM8.5 11V7.5a3.5 3.5 0 017 0V11',
  slash: 'M12 21a9 9 0 100-18 9 9 0 000 18zM5.6 5.6l12.8 12.8',
  history: 'M3 12a9 9 0 109-9 9 9 0 00-7.5 4M3 4v4h4M12 7v5l4 2',
};

export function Icon({ name, size = 16, strokeWidth = 1.5, className, ...rest }) {
  const d = PATHS[name];
  if (!d) return null;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}

export default Icon;
