import { AlertTriangle } from 'lucide-react';

import { cn } from '@/utils/cn';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'No se pudo cargar la información',
  description = 'Ocurrió un error al consultar los datos. Intenta de nuevo en unos segundos.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-danger/30 bg-danger/5 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-danger/15">
        <AlertTriangle className="size-5 text-danger" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
