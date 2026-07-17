import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';

import { ProfileScatterChart, type ScatterSeries } from '@/components/charts/ProfileScatterChart';
import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableSkeletonRows } from '@/components/ui/Table';
import { colors, profileColors } from '@/constants/tokens';
import { supabase } from '@/lib/supabase';

interface ProfileRow {
  jugador: string;
  perfil: string;
  distance_km?: number;
  sprint_distance_m?: number;
  top_speed_kmh?: number;
  player_load?: number;
  /** Resto de features numéricas devueltas por el modelo (ml_predictions.features). */
  [key: string]: unknown;
}

type LoadState = 'loading' | 'error' | 'ready';

export default function PerfilesMl({ orgId }: { orgId: string }) {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState('loading');
    Promise.all([
      supabase
        .from('ml_predictions')
        .select('player_id, label, features')
        .eq('org_id', orgId)
        .eq('prediction_type', 'physical_profile'),
      supabase.from('players').select('id, full_name').eq('org_id', orgId),
    ]).then(([predictionsRes, playersRes]) => {
      if (!isMounted) return;
      if (predictionsRes.error || playersRes.error) {
        setState('error');
        return;
      }
      const idToName = Object.fromEntries((playersRes.data ?? []).map((player) => [player.id, player.full_name]));
      const rows = (predictionsRes.data ?? []).map((prediction) => ({
        jugador: idToName[prediction.player_id] ?? prediction.player_id,
        perfil: prediction.label,
        ...(prediction.features || {}),
      }));
      setProfiles(rows);
      setState('ready');
    });
    return () => {
      isMounted = false;
    };
  }, [orgId, reloadToken]);

  if (state === 'error') return <ErrorState onRetry={() => setReloadToken((n) => n + 1)} />;

  const profileNames = [...new Set(profiles.map((row) => row.perfil))];
  const series: ScatterSeries[] = profileNames.map((name) => ({
    name,
    color: profileColors[name] || colors.blue,
    data: profiles.filter((row) => row.perfil === name),
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Perfiles físicos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clusters K-Means sobre medias por jugador (distancia, sprint, velocidad, Player Load)
        </p>
      </div>

      {state === 'ready' && profiles.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="Sin perfiles todavía"
          description={
            <>
              Corre <code>run_training.py</code> en el backend.
            </>
          }
        />
      ) : (
        <>
          <ChartCard title="Sprint vs Player Load" description="Tamaño del punto = velocidad máxima" isLoading={state === 'loading'} height={340} className="mb-5">
            <ProfileScatterChart
              series={series}
              xKey="sprint_distance_m"
              xLabel="Sprint (m)"
              yKey="player_load"
              yLabel="Player Load"
              zKey="top_speed_kmh"
              zLabel="Vel. máx"
            />
          </ChartCard>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Jugadores por perfil</CardTitle>
                <CardDescription className="mt-1">Promedios de carga física por jugador</CardDescription>
              </div>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jugador</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Dist. media (km)</TableHead>
                  <TableHead>Sprint medio (m)</TableHead>
                  <TableHead>Vel. máx media</TableHead>
                  <TableHead>Player Load medio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state === 'loading' ? (
                  <TableSkeletonRows columns={6} />
                ) : (
                  [...profiles]
                    .sort((a, b) => (a.perfil > b.perfil ? 1 : -1))
                    .map((row) => (
                      <TableRow key={row.jugador}>
                        <TableCell className="font-medium">{row.jugador}</TableCell>
                        <TableCell>
                          <Badge
                            style={{
                              backgroundColor: `${profileColors[row.perfil] || colors.blue}26`,
                              color: profileColors[row.perfil] || colors.blue,
                            }}
                          >
                            {row.perfil}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{Number(row.distance_km ?? 0).toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground">{Number(row.sprint_distance_m ?? 0).toFixed(0)}</TableCell>
                        <TableCell className="text-muted-foreground">{Number(row.top_speed_kmh ?? 0).toFixed(1)}</TableCell>
                        <TableCell className="text-muted-foreground">{Number(row.player_load ?? 0).toFixed(0)}</TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
