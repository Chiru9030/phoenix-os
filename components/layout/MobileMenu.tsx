'use client';
import * as React from 'react';
import { Menu } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { SideNav } from './NavLinks';
export function MobileMenu() {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger aria-label="Open menu" className="rounded-lg p-2 text-parchment-muted hover:bg-surface-raised md:hidden"><Menu className="h-5 w-5" /></DialogTrigger>
      <DialogContent title="Menu" className="top-0 !translate-y-0 left-0 !translate-x-0 h-dvh w-[min(86vw,20rem)] max-h-none rounded-none rounded-r-xl"><SideNav onNavigate={() => setOpen(false)} /></DialogContent>
    </Dialog>
  );
}
