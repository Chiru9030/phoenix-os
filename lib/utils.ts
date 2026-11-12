import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function pct(n: number, d: number) { return d <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((n / d) * 100))); }
export const round2 = (n: number) => Math.round(n * 100) / 100;
