import { useEffect, useRef } from 'react';
import { Button } from '../ui/primitives.jsx';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Erişilebilir yan çekmece.
 *
 * - role="dialog" + aria-modal
 * - Escape ile kapanır
 * - Odak tuzağı (Tab döngüsü çekmece içinde kalır)
 * - Kapanınca odak, çekmeceyi açan öğeye döner
 * - Açıkken arka plan kaydırması engellenir
 */
export function Drawer({ open, onClose, labelledBy, children, footer, header }) {
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);

  // Açılışta odağı sakla ve çekmeceye taşı.
  useEffect(() => {
    if (!open) return undefined;

    returnFocusRef.current = document.activeElement;

    const panel = panelRef.current;
    const first = panel?.querySelector(FOCUSABLE);
    (first ?? panel)?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
      // Odağı tetikleyen öğeye geri ver.
      const target = returnFocusRef.current;
      if (target && typeof target.focus === 'function' && document.contains(target)) {
        target.focus();
      }
    };
  }, [open]);

  // Escape ve odak tuzağı.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const items = [...panel.querySelectorAll(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null
      );
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />
      <div
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        ref={panelRef}
        tabIndex={-1}
      >
        <header className="drawer__header">
          {header}
          <Button
            variant="ghost"
            icon="close"
            onClick={onClose}
            aria-label="İnceleme panelini kapat"
          />
        </header>

        <div className="drawer__body">{children}</div>

        {footer && <footer className="drawer__footer">{footer}</footer>}
      </div>
    </>
  );
}

export default Drawer;
