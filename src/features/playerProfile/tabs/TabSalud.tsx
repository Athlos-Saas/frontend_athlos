import { HeartPulse } from 'lucide-react';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { usePagedRows } from '@/hooks/usePagedRows';
import { BodyMap } from '../components/BodyMap';
import { formatDate } from '../format';
import { usePlayerInjuries, usePlayerWellness } from '../queries';

export default function TabSalud({ orgId, playerId }: { orgId: string; playerId: string }) {
  const wellness = usePlayerWellness(orgId, playerId);
  const injuries = usePlayerInjuries(orgId, playerId);

  const entries = wellness.data ?? [];
  const entriesPager = usePagedRows(entries, 10);

  if (wellness.isLoading || injuries.isLoading) return <Skeleton className="h-80 w-full" />;

  const latest = entries[0];

  return (
    <div className="space-y-5">
      {entries.length === 0 ? (
        <EmptyState icon={HeartPulse} title="Sin registros de wellness" description="Este jugador no tiene entradas de wellness diario todavía." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="RPE (último registro)" value={latest.rpe} accent="purple" />
            <StatCard label="Sueño" value={`${latest.sleep_hours}h`} accent="ai" />
            <StatCard label="Dolor muscular" value={latest.soreness} accent={latest.soreness >= 6 ? 'danger' : 'success'} />
            <StatCard label="Ánimo" value={latest.mood} accent="success" />
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Últimos registros</CardTitle>
                <CardDescription className="mt-1">{entries.length} entradas</CardDescription>
              </div>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">RPE</TableHead>
                  <TableHead className="text-right">Sueño</TableHead>
                  <TableHead className="text-right">Dolor</TableHead>
                  <TableHead className="text-right">Ánimo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entriesPager.paged.map((entry, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <TableRow key={index}>
                    <TableCell className="text-muted-foreground">{formatDate(entry.entry_date)}</TableCell>
                    <TableCell className="text-right">{entry.rpe}</TableCell>
                    <TableCell className="text-right">{entry.sleep_hours}h</TableCell>
                    <TableCell className="text-right">{entry.soreness}</TableCell>
                    <TableCell className="text-right">{entry.mood}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={entriesPager.page} pageCount={entriesPager.pageCount} onPageChange={entriesPager.setPage} className="mt-4" />
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Mapa de lesiones</CardTitle>
        </CardHeader>
        <BodyMap injuries={injuries.data ?? []} />
      </Card>
    </div>
  );
}
