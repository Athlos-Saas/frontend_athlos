import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, HeartPulse, Moon, Shield, Smile, Users, Zap } from 'lucide-react';

import { BenchmarkBarChart } from '@/components/charts/BenchmarkBarChart';
import { ComparisonBarChart } from '@/components/charts/ComparisonBarChart';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { colors } from '@/constants/tokens';
import { supabase } from '@/lib/supabase';
import { toast } from '@/store/toastStore';
import type { ConferenceBenchmark, Injury, Team } from '@/types/domain';

const DAYS_WINDOW = 30;
const WELLNESS_DAYS = 7;

interface RosterPlayer {
  id: string;
  full_name: string;
  position: string | null;
}

interface PlayerLoadAgg {
  player_id: string;
  name: string;
  distanceKm: number;
}

interface WellnessAvg {
  rpe: number | null;
  sleep: number | null;
  soreness: number | null;
  mood: number | null;
  entries: number;
}

/**
 * Vista de EQUIPO: solo agregados del plantel (disponibilidad, carga, wellness,
 * benchmark de conferencia) — el detalle individual vive en Atletas y en la
 * ficha de cada jugador. Nada de tabla-roster duplicada.
 */
export default function Equipos({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [roster, setRoster] = useState<RosterPlayer[] | null>(null);
  const [activeInjuries, setActiveInjuries] = useState<Injury[]>([]);
  const [gpsSessions, setGpsSessions] = useState<{ player_id: string; distance_km: number | null; player_load: number | null }[]>([]);
  const [wellnessAvg, setWellnessAvg] = useState<WellnessAvg | null>(null);
  const [benchmarks, setBenchmarks] = useState<ConferenceBenchmark[]>([]);

  useEffect(() => {
    supabase
      .from('teams')
      .select('id, name, sport, season')
      .eq('org_id', orgId)
      .order('season', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast({ title: 'No se pudieron cargar los equipos', description: error.message, variant: 'danger' });
          return;
        }
        setTeams(data ?? []);
        if (data && data.length > 0) setSelectedTeamId(data[0].id);
      });
  }, [orgId]);

  useEffect(() => {
    if (!selectedTeamId) return;
    setRoster(null);
    setWellnessAvg(null);

    supabase
      .from('players')
      .select('id, full_name, position')
      .eq('org_id', orgId)
      .eq('team_id', selectedTeamId)
      .eq('is_active', true)
      .then(async ({ data: players, error }) => {
        if (error) {
          toast({ title: 'No se pudo cargar el plantel', description: error.message, variant: 'danger' });
          setRoster([]);
          return;
        }
        setRoster(players ?? []);
        const playerIds = (players ?? []).map((player) => player.id);
        if (playerIds.length === 0) {
          setActiveInjuries([]);
          setGpsSessions([]);
          setWellnessAvg({ rpe: null, sleep: null, soreness: null, mood: null, entries: 0 });
          return;
        }

        const gpsSince = new Date(Date.now() - DAYS_WINDOW * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const wellnessSince = new Date(Date.now() - WELLNESS_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const [injuriesRes, gpsRes, wellnessRes] = await Promise.all([
          supabase.from('injuries').select('id, player_id, severity, notes').is('return_date', null).in('player_id', playerIds),
          supabase
            .from('gps_sessions')
            .select('player_id, distance_km, player_load')
            .eq('org_id', orgId)
            .gte('session_date', gpsSince)
            .in('player_id', playerIds),
          supabase
            .from('wellness_entries')
            .select('rpe, sleep_hours, soreness, mood')
            .eq('org_id', orgId)
            .gte('entry_date', wellnessSince)
            .in('player_id', playerIds),
        ]);

        setActiveInjuries((injuriesRes.data as Injury[]) ?? []);
        setGpsSessions(gpsRes.data ?? []);

        const wellness = wellnessRes.data ?? [];
        const avg = (values: (number | null)[]) => {
          const nums = values.filter((v): v is number => typeof v === 'number');
          return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
        };
        setWellnessAvg({
          rpe: avg(wellness.map((w) => w.rpe)),
          sleep: avg(wellness.map((w) => w.sleep_hours)),
          soreness: avg(wellness.map((w) => w.soreness)),
          mood: avg(wellness.map((w) => w.mood)),
          entries: wellness.length,
        });
      });
  }, [orgId, selectedTeamId]);

  const selectedTeam = useMemo(() => (teams ?? []).find((team) => team.id === selectedTeamId) ?? null, [teams, selectedTeamId]);

  useEffect(() => {
    if (!selectedTeam) return;
    supabase
      .from('conference_benchmarks')
      .select('position_group, team_name, metric, team_value, conference_value, diff')
      .eq('org_id', orgId)
      .eq('team_name', selectedTeam.name)
      .then(({ data }) => setBenchmarks((data as ConferenceBenchmark[]) ?? []));
  }, [orgId, selectedTeam]);

  const positionBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const player of roster ?? []) {
      const position = player.position?.trim() || 'Sin posición';
      counts.set(position, (counts.get(position) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([posicion, jugadores]) => ({ posicion, jugadores }));
  }, [roster]);

  const topLoads = useMemo<PlayerLoadAgg[]>(() => {
    const byPlayer = new Map<string, number>();
    for (const session of gpsSessions) {
      byPlayer.set(session.player_id, (byPlayer.get(session.player_id) ?? 0) + (session.distance_km ?? 0));
    }
    const names = new Map((roster ?? []).map((player) => [player.id, player.full_name]));
    return [...byPlayer.entries()]
      .map(([player_id, distanceKm]) => ({ player_id, name: names.get(player_id) ?? 'Jugador', distanceKm }))
      .sort((a, b) => b.distanceKm - a.distanceKm)
      .slice(0, 5);
  }, [gpsSessions, roster]);

  const injuredNames = useMemo(() => {
    const names = new Map((roster ?? []).map((player) => [player.id, player.full_name]));
    return activeInjuries.map((injury) => ({ ...injury, name: names.get(injury.player_id) ?? 'Jugador' }));
  }, [activeInjuries, roster]);

  if (teams === null) return <Skeleton className="h-96 w-full" />;

  if (teams.length === 0) {
    return <EmptyState icon={Shield} title="Sin equipos" description="Importa un roster para crear el primer equipo de la organización." />;
  }

  const totalDistance = gpsSessions.reduce((sum, s) => sum + (s.distance_km ?? 0), 0);
  const maxTopLoad = topLoads[0]?.distanceKm ?? 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Equipos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Estado agregado del plantel — el detalle individual vive en Atletas</p>
        </div>
        <div className="flex items-center gap-2">
          {teams.length > 1 && (
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Equipo" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name} {team.season ? `· ${team.season}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="secondary" size="sm" onClick={() => navigate('/atletas')}>
            Ver plantel <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {selectedTeam && (
        <div className="animate-slide-up mb-5 flex items-center gap-4 rounded-lg border border-border bg-card p-5 shadow-subtle">
          <span className="flex size-12 items-center justify-center rounded-lg bg-ai/10">
            <Shield className="size-6 text-ai" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{selectedTeam.name}</h2>
            <p className="text-sm text-muted-foreground">
              {selectedTeam.sport ?? 'soccer'}
              {selectedTeam.season ? ` · Temporada ${selectedTeam.season}` : ''}
            </p>
          </div>
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Jugadores activos" value={roster === null ? '…' : <AnimatedNumber value={roster.length} />} icon={Users} accent="ai" />
        <StatCard
          label="Disponibilidad"
          value={
            roster === null || roster.length === 0
              ? '--'
              : <AnimatedNumber value={((roster.length - activeInjuries.length) / roster.length) * 100} decimals={0} suffix="%" />
          }
          icon={HeartPulse}
          accent={activeInjuries.length > 0 ? 'warning' : 'success'}
        />
        <StatCard label={`Sesiones GPS (${DAYS_WINDOW}d)`} value={<AnimatedNumber value={gpsSessions.length} />} icon={Activity} accent="purple" />
        <StatCard
          label={`Distancia total (${DAYS_WINDOW}d)`}
          value={gpsSessions.length > 0 ? <AnimatedNumber value={totalDistance} decimals={1} suffix=" km" /> : '--'}
          icon={Zap}
          accent="success"
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {positionBreakdown.length > 0 && (
          <ChartCard title="Composición del plantel" description="Jugadores activos por posición">
            <ComparisonBarChart data={positionBreakdown} xKey="posicion" yKey="jugadores" name="Jugadores" color={colors.blue} />
          </ChartCard>
        )}

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Mayor carga ({DAYS_WINDOW} días)</CardTitle>
              <CardDescription className="mt-1">Top 5 por distancia acumulada — click abre la ficha</CardDescription>
            </div>
          </CardHeader>
          {topLoads.length === 0 ? (
            <EmptyState title="Sin sesiones GPS" description={`No hay sesiones registradas en los últimos ${DAYS_WINDOW} días.`} />
          ) : (
            <div className="space-y-2.5">
              {topLoads.map((load, index) => (
                <button
                  key={load.player_id}
                  type="button"
                  onClick={() => navigate(`/atletas/${load.player_id}`)}
                  className="animate-slide-up focus-ring block w-full rounded-md border border-border bg-panel px-4 py-2.5 text-left transition-colors hover:border-ai/40 hover:bg-card"
                  style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'backwards' }}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{load.name}</p>
                    <p className="text-sm font-semibold text-foreground">{load.distanceKm.toFixed(1)} km</p>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-border/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-success to-ai transition-[width] duration-700 ease-out"
                      style={{ width: `${maxTopLoad > 0 ? (load.distanceKm / maxTopLoad) * 100 : 0}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Wellness del plantel ({WELLNESS_DAYS} días)</CardTitle>
              <CardDescription className="mt-1">
                {wellnessAvg && wellnessAvg.entries > 0 ? `Promedio de ${wellnessAvg.entries} registros diarios` : 'Sin registros recientes'}
              </CardDescription>
            </div>
          </CardHeader>
          {!wellnessAvg || wellnessAvg.entries === 0 ? (
            <EmptyState title="Sin wellness" description="El plantel no registró wellness diario en la última semana." />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'RPE', value: wellnessAvg.rpe, icon: Zap, max: 10 },
                { label: 'Sueño (h)', value: wellnessAvg.sleep, icon: Moon, max: 12 },
                { label: 'Dolor', value: wellnessAvg.soreness, icon: HeartPulse, max: 10 },
                { label: 'Ánimo', value: wellnessAvg.mood, icon: Smile, max: 5 },
              ].map((metric, index) => (
                <div
                  key={metric.label}
                  className="animate-slide-up rounded-md bg-panel px-3 py-3"
                  style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'backwards' }}
                >
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <metric.icon className="size-3" aria-hidden="true" /> {metric.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {metric.value !== null ? <AnimatedNumber value={metric.value} decimals={1} /> : '--'}
                  </p>
                  {metric.value !== null && (
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border/60">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-ai to-purple transition-[width] duration-700"
                        style={{ width: `${Math.min((metric.value / metric.max) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className={injuredNames.length > 0 ? 'border-danger/30' : undefined}>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                {injuredNames.length > 0 && <span className="flex size-2.5 rounded-full bg-danger animate-pulse-glow" />}
                Lesionados
              </CardTitle>
              <CardDescription className="mt-1">Sin fecha de retorno registrada</CardDescription>
            </div>
            {injuredNames.length > 0 && <Badge variant="danger">{injuredNames.length}</Badge>}
          </CardHeader>
          {injuredNames.length === 0 ? (
            <EmptyState title="Plantel completo disponible" description="No hay lesiones activas en este equipo." />
          ) : (
            <div className="space-y-2">
              {injuredNames.map((injury, index) => (
                <button
                  key={injury.id}
                  type="button"
                  onClick={() => navigate(`/atletas/${injury.player_id}`)}
                  className="animate-slide-up focus-ring flex w-full items-center justify-between gap-3 rounded-md border border-border bg-panel px-4 py-2.5 text-left transition-colors hover:border-danger/40 hover:bg-card"
                  style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'backwards' }}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{injury.name}</p>
                    {injury.notes && <p className="text-xs text-muted-foreground">{injury.notes}</p>}
                  </div>
                  <Badge variant={injury.severity === 'severe' ? 'danger' : 'warning'}>{injury.severity}</Badge>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {benchmarks.filter((b) => b.position_group === 'attacker').length > 0 && (
        <ChartCard
          title="Rendimiento vs. conferencia"
          description={`${selectedTeam?.name} vs. media de la conferencia (stats ofensivas de liga)`}
        >
          <BenchmarkBarChart
            data={benchmarks
              .filter((b) => b.position_group === 'attacker')
              .map((row) => ({ metric: row.metric, team_value: row.team_value, conference_value: row.conference_value }))}
            teamLabel={selectedTeam?.name ?? 'Equipo'}
          />
        </ChartCard>
      )}
    </div>
  );
}
