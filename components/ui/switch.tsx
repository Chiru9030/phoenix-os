'use client';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';
export function Switch({ className, ...p }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root className={cn('relative h-6 w-11 shrink-0 rounded-full border border-hairline bg-ink-soft transition-colors data-[state=checked]:border-gold-dim data-[state=checked]:bg-gold/30', className)} {...p}>
      <SwitchPrimitive.Thumb className="block h-4 w-4 translate-x-1 rounded-full bg-parchment-muted transition-transform data-[state=checked]:translate-x-6 data-[state=checked]:bg-gold-bright" />
    </SwitchPrimitive.Root>
  );
}
