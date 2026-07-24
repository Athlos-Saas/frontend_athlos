import { Badge } from '@/components/ui/Badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import type { PlayerStatus } from '../insights';

export function StatusBadge({ status }: { status: PlayerStatus }) {
  if (!status.activeInjury?.notes) {
    return <Badge variant={status.variant}>{status.label}</Badge>;
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={status.variant} className="cursor-pointer">
            {status.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{status.activeInjury.notes}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
