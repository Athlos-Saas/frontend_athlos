import { History } from 'lucide-react';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { InjuryTimeline } from '../components/InjuryTimeline';
import { usePlayerInjuries } from '../queries';

/**
 * Historial = línea de tiempo completa de lesiones (injury_date desc).
 * "Observaciones de entrenadores/médico/scouting" que pedía el prompt no
 * tiene tabla en el esquema (no existe player_notes/observations con
 * autor+rol+fecha) — no se muestra, ver gaps del plan.
 */
export default function TabHistorial({ orgId, playerId }: { orgId: string; playerId: string }) {
  const { data, isLoading } = usePlayerInjuries(orgId, playerId);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const injuries = data ?? [];

  if (injuries.length === 0) {
    return <EmptyState icon={History} title="Sin historial" description="Este jugador no tiene lesiones registradas." />;
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Historial de lesiones</CardTitle>
          <CardDescription className="mt-1">{injuries.length} registros</CardDescription>
        </div>
      </CardHeader>
      <InjuryTimeline injuries={injuries} />
    </Card>
  );
}
