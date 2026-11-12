import * as React from 'react';
import { cn } from '@/lib/utils';

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('card', className)} {...p} />;
export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('flex items-start justify-between gap-3 p-5 pb-3', className)} {...p} />;
export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className={cn('font-display text-lg font-semibold text-parchment', className)} {...p} />;
export const CardBody = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('p-5 pt-2', className)} {...p} />;

const TONES = {
  gold: 'border-gold-dim/60 bg-gold/10 text-gold-bright', arcane: 'border-arcane-dim bg-arcane/15 text-arcane-bright', ember: 'border-ember/50 bg-ember/10 text-ember-bright',
  sage: 'border-sage/40 bg-sage/10 text-sage-bright', muted: 'border-hairline bg-surface-raised text-parchment-muted',
} as const;
export function Badge({ tone = 'muted', className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof TONES }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', TONES[tone], className)} {...p} />;
}
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn('h-10 w-full rounded-lg border border-hairline bg-ink-soft px-3 text-sm text-parchment placeholder:text-parchment-dim focus:border-gold-dim', className)} {...p} />
));
Input.displayName = 'Input';
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn('min-h-[84px] w-full rounded-lg border border-hairline bg-ink-soft px-3 py-2 text-sm text-parchment placeholder:text-parchment-dim focus:border-gold-dim', className)} {...p} />
));
Textarea.displayName = 'Textarea';
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cn('h-10 w-full rounded-lg border border-hairline bg-ink-soft px-3 text-sm text-parchment focus:border-gold-dim', className)} {...p} />
));
Select.displayName = 'Select';
export const Label = ({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label className={cn('mb-1.5 block text-xs font-semibold text-parchment-muted', className)} {...p} />;
export const Skeleton = ({ className }: { className?: string }) => <div className={cn('animate-pulse rounded-lg bg-surface-raised', className)} />;

/** Thin progress bar. `molten` = the gold XP pour; other tones for HP, goals etc. */
export function Bar({ value, max = 100, tone = 'gold', className, label }: { value: number; max?: number; tone?: 'gold' | 'arcane' | 'ember' | 'sage'; className?: string; label?: string }) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const fill = tone === 'gold' ? 'molten' : tone === 'arcane' ? 'bg-arcane' : tone === 'ember' ? 'bg-ember' : 'bg-sage';
  return (
    <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className={cn('relative h-2.5 w-full overflow-hidden rounded-full bg-ink-soft ring-1 ring-inset ring-hairline', className)}>
      <div className={cn('h-full rounded-full transition-[width] duration-1000 ease-out', fill)} style={{ width: `${pct}%` }} />
      {tone === 'gold' && pct > 2 && <div className="molten-shimmer pointer-events-none absolute inset-y-0 left-0 animate-shimmer opacity-60" style={{ width: `${pct}%` }} />}
    </div>
  );
}
export function Empty({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-hairline px-6 py-10 text-center">
      {icon && <div className="text-parchment-dim">{icon}</div>}
      <p className="font-display text-base text-parchment">{title}</p>
      {children && <p className="max-w-sm text-sm text-parchment-muted">{children}</p>}
    </div>
  );
}
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>{subtitle && <p className="mt-1 max-w-2xl text-sm text-parchment-muted">{subtitle}</p>}</div>
      {actions}
    </header>
  );
}
