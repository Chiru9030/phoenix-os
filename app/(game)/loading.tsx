import { Skeleton } from '@/components/ui/primitives';
export default function Loading() {
  return (<div className="space-y-5" aria-busy="true" aria-label="Loading"><Skeleton className="h-9 w-72" /><Skeleton className="h-24 w-full" /><div className="grid gap-5 lg:grid-cols-[1fr_21rem]"><div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div><div className="space-y-5"><Skeleton className="h-44" /><Skeleton className="h-64" /></div></div></div>);
}
