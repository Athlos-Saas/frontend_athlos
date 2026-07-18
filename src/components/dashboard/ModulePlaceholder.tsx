import type { ComponentType } from 'react';
import { CheckCircle2, Construction } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

export interface ModulePlaceholderProps {
  title: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
  bullets?: string[];
  kpis?: string[];
}

export function ModulePlaceholder({ title, description, icon, bullets, kpis }: ModulePlaceholderProps) {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant="purple">Próximamente</Badge>
      </div>

      {kpis && kpis.length > 0 && (
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((label) => (
            <Card key={label} className="opacity-60">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-muted-foreground">—</p>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EmptyState
          icon={icon ?? Construction}
          title="Sin fuente de datos conectada"
          description="Este módulo se activa en cuanto el backend exponga la tabla correspondiente en Supabase."
        />

        {bullets && bullets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Lo que vas a poder hacer aquí</CardTitle>
            </CardHeader>
            <ul className="space-y-2.5">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-purple/70" aria-hidden="true" />
                  {bullet}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
