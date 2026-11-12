'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export function DialogContent({ className, children, title, description, ...p }: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string; description?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
      <DialogPrimitive.Content className={cn('card fixed left-1/2 top-1/2 z-50 max-h-[88dvh] w-[min(92vw,34rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-6', className)} {...p}>
        <DialogPrimitive.Title className="font-display text-xl font-semibold">{title}</DialogPrimitive.Title>
        <DialogPrimitive.Description className={cn('mt-1 text-sm text-parchment-muted', !description && 'sr-only')}>{description ?? title}</DialogPrimitive.Description>
        <div className="mt-4">{children}</div>
        <DialogPrimitive.Close aria-label="Close" className="absolute right-3 top-3 rounded-md p-1.5 text-parchment-dim hover:bg-surface-raised hover:text-parchment"><X className="h-4 w-4" /></DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
