import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Button } from './button.jsx';
import { cn } from '@/lib/utils.js';

/**
 * Yan çekmece — Radix Dialog üzerine kurulu.
 *
 * Radix odak tuzağını, Escape'i, odak iadesini ve `aria-modal` semantiğini
 * üstlenir. Masaüstünde sağdan açılan bir panel, mobilde tam ekrandır.
 */
export function Drawer({ open, onOpenChange, title, header, footer, children }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay data-slot="overlay" className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content
          data-slot="drawer"
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-drawer outline-none',
            'sm:max-w-[560px]'
          )}
        >
          {/* Radix erişilebilir bir başlık ister; görsel başlığı header sağlar. */}
          <Dialog.Title className="sr-only">{title}</Dialog.Title>

          <div className="flex items-start gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">{header}</div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Kapat">
                <X />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

          {footer && (
            <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default Drawer;
