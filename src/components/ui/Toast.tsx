import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

import { cn } from '@/utils/cn';
import { useToastStore, type ToastVariant } from '@/store/toastStore';

const VARIANT_ICON: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

const VARIANT_CLASS: Record<ToastVariant, string> = {
  default: 'border-border text-ai',
  success: 'border-success/30 text-success',
  warning: 'border-warning/30 text-warning',
  danger: 'border-danger/30 text-danger',
};

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
      {toasts.map(({ id, title, description, variant }) => {
        const Icon = VARIANT_ICON[variant];
        return (
          <ToastPrimitive.Root
            key={id}
            onOpenChange={(open) => !open && dismiss(id)}
            className={cn(
              'animate-slide-up group relative flex w-full items-start gap-3 rounded-lg border bg-panel p-4 shadow-elevated',
              'data-[swipe=end]:animate-fade-in',
              VARIANT_CLASS[variant],
            )}
          >
            <Icon className={cn('mt-0.5 size-4 shrink-0', VARIANT_CLASS[variant])} aria-hidden="true" />
            <div className="flex-1 space-y-1">
              <ToastPrimitive.Title className="text-sm font-semibold text-foreground">{title}</ToastPrimitive.Title>
              {description && (
                <ToastPrimitive.Description className="text-xs text-muted-foreground">
                  {description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close
              aria-label="Cerrar notificación"
              className="focus-ring rounded-sm text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-6 outline-none" />
    </ToastPrimitive.Provider>
  );
}
