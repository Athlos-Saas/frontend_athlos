import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';

import { cn } from '@/utils/cn';

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'focus-ring relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors',
      'data-[state=checked]:bg-ai data-[state=unchecked]:bg-border',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block size-4 rounded-full bg-white shadow-subtle transition-transform',
        'translate-x-0.5 data-[state=checked]:translate-x-[18px]',
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';
