import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '@/utils/cn';

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('animate-fade-in fixed inset-0 z-50 bg-bg/70 backdrop-blur-sm', className)}
    {...props}
  />
));
DrawerOverlay.displayName = 'DrawerOverlay';

export interface DrawerContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: 'left' | 'right';
}

export const DrawerContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DrawerContentProps>(
  ({ className, children, side = 'right', ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DrawerOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed inset-y-0 z-50 flex w-full max-w-sm flex-col border-border bg-panel p-6 shadow-elevated focus:outline-none',
          side === 'right'
            ? 'right-0 border-l data-[state=open]:animate-[slide-in-right_0.22s_cubic-bezier(0.16,1,0.3,1)]'
            : 'left-0 border-r data-[state=open]:animate-[slide-in-left_0.22s_cubic-bezier(0.16,1,0.3,1)]',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="focus-ring absolute right-4 top-4 rounded-sm text-muted-foreground hover:text-foreground">
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Cerrar</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
);
DrawerContent.displayName = 'DrawerContent';

export function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 space-y-1', className)} {...props} />;
}

export const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-base font-semibold text-foreground', className)} {...props} />
));
DrawerTitle.displayName = 'DrawerTitle';

export const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
DrawerDescription.displayName = 'DrawerDescription';
