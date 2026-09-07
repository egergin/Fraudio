import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Koşullu sınıfları birleştirir ve Tailwind çakışmalarını çözer. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
