import { Loader2 } from 'lucide-react';

import { cn } from '@/utils/cn';

export function Spinner({ className, label = 'Cargando…' }: { className?: string; label?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground', className)}>
      <Loader2 className="size-4 animate-spin text-ai" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
