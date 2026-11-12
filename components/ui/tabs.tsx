'use client';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
export const Tabs = TabsPrimitive.Root;
export const TabsList = ({ className, ...p }: React.ComponentProps<typeof TabsPrimitive.List>) => <TabsPrimitive.List className={cn('inline-flex rounded-lg border border-hairline bg-ink-soft p-1', className)} {...p} />;
export const TabsTrigger = ({ className, ...p }: React.ComponentProps<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger className={cn('rounded-md px-3.5 py-1.5 text-sm font-semibold text-parchment-muted transition-colors data-[state=active]:bg-surface-raised data-[state=active]:text-gold-bright', className)} {...p} />
);
export const TabsContent = ({ className, ...p }: React.ComponentProps<typeof TabsPrimitive.Content>) => <TabsPrimitive.Content className={cn('mt-4', className)} {...p} />;
