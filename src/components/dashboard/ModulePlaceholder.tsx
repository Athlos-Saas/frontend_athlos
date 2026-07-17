import type { ComponentType } from 'react';
import { Construction } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

export interface ModulePlaceholderProps {
  title: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
}

export function ModulePlaceholder({ title, description, icon }: ModulePlaceholderProps) {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant="purple">Próximamente</Badge>
      </div>
      <EmptyState
        icon={icon ?? Construction}
        title="Módulo en construcción"
        description="Este módulo todavía no tiene una fuente de datos conectada. Se activará en cuanto el backend exponga la información correspondiente."
      />
    </div>
  );
}
