import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils.js';

/**
 * Buton — shadcn yapısı, Fraudio görünümü.
 *
 * Varsayılan shadcn'den ayrıldığı yerler: küçük yarıçap, düşük yükseklik,
 * hap biçim yok, gradyan yok. Birincil eylem teal değil nötr-parlak;
 * teal yalnızca "canlı/bağlı" anlamına ayrılmıştır.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm font-medium ' +
    'transition-colors duration-100 outline-none disabled:pointer-events-none disabled:opacity-40 ' +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          'bg-fg text-fg-inverted hover:bg-white active:bg-fg-secondary',
        secondary:
          'bg-elevated text-fg border border-line-strong hover:bg-hover hover:border-line-interactive active:bg-active',
        ghost: 'text-fg-secondary hover:bg-hover hover:text-fg active:bg-active',
        danger:
          'bg-critical-bg text-critical-fg border border-critical-line hover:bg-critical/20',
        link: 'text-live-fg underline-offset-2 hover:underline',
      },
      size: {
        sm: 'h-6 px-2 text-2xs [&_svg]:size-3',
        md: 'h-7 px-2.5 text-xs [&_svg]:size-3.5',
        lg: 'h-9 px-4 text-sm [&_svg]:size-4',
        icon: 'size-7 [&_svg]:size-3.5',
        'icon-sm': 'size-6 [&_svg]:size-3',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}) {
  const Comp = asChild ? Slot : 'button';

  if (asChild) {
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {children}
      </Comp>
    );
  }

  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
      {children}
    </Comp>
  );
}

export { buttonVariants };
