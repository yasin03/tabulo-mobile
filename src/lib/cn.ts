import { twMerge } from 'tailwind-merge';

type ClassValue = string | false | null | undefined;

/** className birleştirme; çakışan Tailwind sınıflarında sonuncusu kazanır. */
export function cn(...classes: ClassValue[]): string {
  return twMerge(classes.filter(Boolean).join(' '));
}
