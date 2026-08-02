import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  ChevronDown,
  Download,
  HeartPulse,
  Lock,
  MessageCircleQuestion,
  Shield,
  ShieldAlert,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';

import { generateReport } from '@/lib/backendApi';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { MatchAnalysisTab } from '@/features/coachModule/MatchAnalysisTab';
import { supabase } from '@/lib/supabase';
import { useChatStore } from '@/store/chatStore';
import { toast } from '@/store/toastStore';
import type { Team } from '@/types/domain';

type LoadState = 'loading' | 'error' | 'ready';
type FatigueLabel = 'bajo' | 'medio' | 'alto';
type Confidence = 'alta' | 'baja';
type Position = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Forward';

/** Esquema base para el once sugerido — el plantel de esta app siempre viene con posiciones en inglés (import real de roster), así que se arma sobre esa convención. */
const FORMATION: Record<Position, number> = { Goalkeeper: 1, Defender: 4, Midfielder: 3, Forward: 3 };
const POSITION_ORDER: Position[] = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];

interface RosterPlayer {
  id: string;
  full_name: string;
  position: string | null;
}

interface InjuryInfo {
  severity: 'minor' | 'moderate' | 'severe';
  notes: string | null;
}

interface RiskInfo {
  label: string;
  score: number | null;
  confianza: Confidence | null;
  createdAt: string;
}

interface WellnessAvg {
  soreness: number | null;
  mood: number | null;
  entries: number;
}

interface LeagueRow {
  goals: number | null;
  assists: number | null;
  points_per_game: number | null;
  gp: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  role_name: string | null;
}

interface PlayerReadiness {
  player: RosterPlayer;
  available: boolean;
  injury: InjuryInfo | null;
  fatigue: FatigueLabel | null;
  injuryRisk: RiskInfo | null;
  wellness: WellnessAvg | null;
  league: LeagueRow | null;
  gpsSessionsRecent: number;
  score: number;
}

const FATIGUE_PENALTY: Record<FatigueLabel, number> = { bajo: 10, medio: -10, alto: -25 };

function computeScore(input: {
  fatigue: FatigueLabel | null;
  wellness: WellnessAvg | null;
  league: LeagueRow | null;
  gpsSessionsRecent: number;
}): number {
  let score = 60;
  if (input.fatigue) score += FATIGUE_PENALTY[input.fatigue];
  if (input.wellness && input.wellness.entries > 0) {
    if (input.wellness.soreness !== null && input.wellness.soreness >= 6) score -= 10;
    else if (input.wellness.soreness !== null && input.wellness.soreness <= 2) score += 5;
  }
  if (input.gpsSessionsRecent === 0) score -= 10;
  if (input.league?.points_per_game) score += Math.min(20, input.league.points_per_game * 8);
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Módulo Entrenador — capa simple sobre datos que YA existen en el sistema
 * (GPS, wellness, riesgo de lesión/fatiga ya entrenados, stats de liga).
 * No agrega ninguna tubería nueva de datos: solo los traduce a lenguaje de
 * cancha (disponible/no disponible, once sugerido, a vigilar, candidatos a
 * MVP) con el detalle técnico siempre a un click de distancia. Ver
 * `computeScore` para la fórmula real detrás de cada sugerencia — nunca es
 * una caja negra, cada tarjeta muestra el motivo.
 */
export default function ModuloEntrenador({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [state, setState] = useState<LoadState>('loading');
  const [readiness, setReadiness] = useState<PlayerReadiness[]>([]);
  const [activeTab, setActiveTab] = useState<'resumen' | 'partidos'>('resumen');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const setScreenContext = useChatStore((s) => s.setScreenContext);
  const setPendingPrompt = useChatStore((s) => s.setPendingPrompt);

  useEffect(() => {
    supabase
      .from('teams')
      .select('id, name, sport, season')
      .eq('org_id', orgId)
      .order('season', { ascending: false })
      .then(({ data }) => {
        setTeams((data as Team[]) ?? []);
        if (data && data.length > 0) setSelectedTeamId(data[0].id);
      });
  }, [orgId]);

  useEffect(() => {
    if (!selectedTeamId) return;
    let isMounted = true;
    setState('loading');

    supabase
      .from('players')
      .select('id, full_name, position')
      .eq('org_id', orgId)
      .eq('team_id', selectedTeamId)
      .eq('is_active', true)
      .then(async ({ data: playersData, error }) => {
        if (!isMounted) return;
        if (error) {
          setState('error');
          return;
        }
        const roster = (playersData ?? []) as RosterPlayer[];
        const playerIds = roster.map((p) => p.id);
        if (playerIds.length === 0) {
          setReadiness([]);
          setState('ready');
          return;
        }

        const wellnessSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const gpsSince = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const [injuriesRes, predictionsRes, wellnessRes, gpsRes, attackerRes, gkRes] = await Promise.all([
          supabase.from('injuries').select('player_id, severity, notes, return_date').eq('org_id', orgId).is('return_date', null).in('player_id', playerIds),
          supabase
            .from('ml_predictions')
            .select('player_id, prediction_type, label, score, features, created_at')
            .eq('org_id', orgId)
            .in('prediction_type', ['injury_risk', 'fatigue_risk'])
            .in('player_id', playerIds)
            .order('created_at', { ascending: false }),
          supabase.from('wellness_entries').select('player_id, soreness, mood').eq('org_id', orgId).gte('entry_date', wellnessSince).in('player_id', playerIds),
          supabase.from('gps_sessions').select('player_id').eq('org_id', orgId).gte('session_date', gpsSince).in('player_id', playerIds),
          supabase.from('league_attacker_stats').select('player_id, goals, assists, points_per_game, gp, yellow_cards, red_cards, role_name').eq('org_id', orgId).in('player_id', playerIds),
          supabase.from('league_goalkeeper_stats').select('player_id, gp, gk_role').eq('org_id', orgId).in('player_id', playerIds),
        ]);

        if (!isMounted) return;

        const injuryByPlayer = new Map<string, InjuryInfo>();
        for (const row of injuriesRes.data ?? []) injuryByPlayer.set(row.player_id, { severity: row.severity, notes: row.notes });

        const fatigueByPlayer = new Map<string, FatigueLabel>();
        const riskByPlayer = new Map<string, RiskInfo>();
        for (const row of (predictionsRes.data ?? []) as {
          player_id: string;
          prediction_type: string;
          label: string;
          score: number | null;
          features: Record<string, unknown> | null;
          created_at: string;
        }[]) {
          if (row.prediction_type === 'fatigue_risk' && !fatigueByPlayer.has(row.player_id)) {
            fatigueByPlayer.set(row.player_id, row.label as FatigueLabel);
          }
          if (row.prediction_type === 'injury_risk' && !riskByPlayer.has(row.player_id)) {
            const features = row.features ?? {};
            riskByPlayer.set(row.player_id, {
              label: row.label,
              score: row.score,
              confianza: (features.confianza as Confidence | undefined) ?? null,
              createdAt: row.created_at,
            });
          }
        }

        const wellnessByPlayer = new Map<string, { soreness: number[]; mood: number[] }>();
        for (const row of wellnessRes.data ?? []) {
          const bucket = wellnessByPlayer.get(row.player_id) ?? { soreness: [], mood: [] };
          if (row.soreness !== null) bucket.soreness.push(row.soreness);
          if (row.mood !== null) bucket.mood.push(row.mood);
          wellnessByPlayer.set(row.player_id, bucket);
        }
        const avg = (values: number[]) => (values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null);

        const gpsCountByPlayer = new Map<string, number>();
        for (const row of gpsRes.data ?? []) gpsCountByPlayer.set(row.player_id, (gpsCountByPlayer.get(row.player_id) ?? 0) + 1);

        const leagueByPlayer = new Map<string, LeagueRow>();
        for (const row of attackerRes.data ?? []) {
          if (row.player_id) leagueByPlayer.set(row.player_id, row as LeagueRow);
        }
        for (const row of gkRes.data ?? []) {
          if (row.player_id && !leagueByPlayer.has(row.player_id)) {
            leagueByPlayer.set(row.player_id, {
              goals: null,
              assists: null,
              points_per_game: null,
              gp: row.gp,
              yellow_cards: null,
              red_cards: null,
              role_name: row.gk_role,
            });
          }
        }

        const nextReadiness: PlayerReadiness[] = roster.map((player) => {
          const injury = injuryByPlayer.get(player.id) ?? null;
          const fatigue = fatigueByPlayer.get(player.id) ?? null;
          const wellnessRaw = wellnessByPlayer.get(player.id);
          const wellness: WellnessAvg | null = wellnessRaw
            ? { soreness: avg(wellnessRaw.soreness), mood: avg(wellnessRaw.mood), entries: wellnessRaw.soreness.length }
            : { soreness: null, mood: null, entries: 0 };
          const league = leagueByPlayer.get(player.id) ?? null;
          const gpsSessionsRecent = gpsCountByPlayer.get(player.id) ?? 0;
          return {
            player,
            available: !injury,
            injury,
            fatigue,
            injuryRisk: riskByPlayer.get(player.id) ?? null,
            wellness,
            league,
            gpsSessionsRecent,
            score: computeScore({ fatigue, wellness, league, gpsSessionsRecent }),
          };
        });

        setReadiness(nextReadiness);
        setState('ready');
      });

    return () => {
      isMounted = false;
    };
  }, [orgId, selectedTeamId]);

  const available = useMemo(() => readiness.filter((r) => r.available), [readiness]);
  const unavailable = useMemo(() => readiness.filter((r) => !r.available), [readiness]);

  const suggestedXi = useMemo(() => {
    const byPosition = new Map<Position, PlayerReadiness[]>();
    for (const entry of available) {
      const pos = (entry.player.position as Position) ?? 'Midfielder';
      const list = byPosition.get(pos) ?? [];
      list.push(entry);
      byPosition.set(pos, list);
    }
    for (const list of byPosition.values()) list.sort((a, b) => b.score - a.score);

    return POSITION_ORDER.map((position) => {
      const needed = FORMATION[position];
      const pool = byPosition.get(position) ?? [];
      return { position, starters: pool.slice(0, needed), short: Math.max(0, needed - pool.length) };
    });
  }, [available]);

  const watchList = useMemo(() => {
    const rows: { entry: PlayerReadiness; reason: string; severity: 'warning' | 'danger' }[] = [];
    for (const entry of readiness) {
      if (entry.injury) {
        rows.push({
          entry,
          reason: t('coachModule.watch.outInjured', 'Lesionado ({{severity}}) — no disponible', { severity: entry.injury.severity }),
          severity: 'danger',
        });
        continue;
      }
      if (entry.injuryRisk && (entry.injuryRisk.label === 'alto' || entry.injuryRisk.label === 'medio')) {
        rows.push({
          entry,
          reason: t('coachModule.watch.injuryRisk', 'Riesgo de lesión {{label}}{{confidence}}', {
            label: entry.injuryRisk.label,
            confidence: entry.injuryRisk.confianza === 'baja' ? t('coachModule.watch.lowConfidenceSuffix', ' (con pocos datos todavía)') : '',
          }),
          severity: entry.injuryRisk.label === 'alto' ? 'danger' : 'warning',
        });
      }
      if (entry.fatigue === 'alto') {
        rows.push({ entry, reason: t('coachModule.watch.highFatigue', 'Fatiga alta esta semana — considerar descanso'), severity: 'warning' });
      }
      const yellow = entry.league?.yellow_cards ?? 0;
      if (yellow >= 3) {
        rows.push({
          entry,
          reason: t('coachModule.watch.cards', '{{count}} amarillas esta temporada — vigilar acumulación', { count: yellow }),
          severity: yellow >= 5 ? 'danger' : 'warning',
        });
      }
    }
    return rows.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : 1));
  }, [readiness, t]);

  const mvpCandidates = useMemo(() => {
    return available
      .filter((r) => r.league && r.league.points_per_game !== null && r.league.gp)
      .map((r) => {
        const maxGp = Math.max(...available.map((x) => x.league?.gp ?? 0), 1);
        const availabilityRatio = (r.league?.gp ?? 0) / maxGp;
        const fitnessFactor = r.fatigue === 'bajo' ? 1 : r.fatigue === 'medio' ? 0.6 : r.fatigue === 'alto' ? 0.2 : 0.5;
        const performanceFactor = Math.min(1, (r.league?.points_per_game ?? 0) / 1.2);
        const mvpScore = Math.round((performanceFactor * 0.5 + availabilityRatio * 0.3 + fitnessFactor * 0.2) * 100);
        return { entry: r, mvpScore, availabilityRatio };
      })
      .sort((a, b) => b.mvpScore - a.mvpScore)
      .slice(0, 3);
  }, [available]);

  // Lo que AthlosBot ve como "pista de pantalla" — se actualiza solo, el
  // entrenador no tiene que describirle nada de esto a mano.
  useEffect(() => {
    const selectedTeam = teams?.find((team) => team.id === selectedTeamId);
    setScreenContext({
      route: '/entrenador',
      tab: activeTab,
      team_id: selectedTeamId || undefined,
      team_name: selectedTeam?.name,
      available_count: available.length,
      injured_count: unavailable.length,
      watch_items: watchList.slice(0, 10).map(({ entry, reason }) => ({ player_name: entry.player.full_name, reason })),
    });
  }, [activeTab, teams, selectedTeamId, available.length, unavailable.length, watchList, setScreenContext]);

  const goToProfile = (playerId: string) => navigate(`/atletas/${playerId}`);

  const explain = (question: string) => setPendingPrompt(question);

  const handleGenerateReport = async (reportType: 'team_readiness' | 'watchlist') => {
    setIsGeneratingReport(true);
    try {
      const result = await generateReport(orgId, { report_type: reportType, team_id: selectedTeamId });
      toast({
        title: t('coachModule.report.successTitle', 'Reporte listo'),
        description: result.title,
        variant: 'success',
      });
      if (result.download_url) window.open(result.download_url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast({
        title: t('coachModule.report.errorTitle', 'No se pudo generar el reporte'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'danger',
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (state === 'loading' || teams === null) return <Skeleton className="h-96 w-full" />;

  if (teams.length === 0) {
    return (
      <EmptyState
        icon={Shield}
        title={t('coachModule.empty.title', 'Sin equipos todavía')}
        description={t('coachModule.empty.description', 'Creá un equipo y un roster para usar el módulo entrenador.')}
      />
    );
  }

  const briefing = t(
    'coachModule.briefing',
    'Hoy tenés {{available}}/{{total}} disponibles y {{watching}} para vigilar. Tu once sugerido está listo.',
    { available: available.length, total: readiness.length, watching: watchList.length },
  );

  return (
    <div>
      <div className="mb-4 rounded-lg border border-border bg-gradient-to-br from-panel to-bg px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('coachModule.title', 'Módulo Entrenador')}</h1>
              <span className="flex items-center gap-1.5 rounded-full border border-ai/30 bg-ai/10 px-2.5 py-1 text-[11px] font-medium text-ai">
                <Lock className="size-3" aria-hidden="true" />
                {t('coachModule.confidential', 'Información confidencial · uso del cuerpo técnico')}
              </span>
            </div>
            <p className="mt-2 text-sm text-foreground">{briefing}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('coachModule.subtitle', 'Lo más importante, en lenguaje simple — el detalle técnico está a un click de distancia')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {teams.length > 1 && (
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder={t('coachModule.selectTeam', 'Equipo')} />
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary" isLoading={isGeneratingReport}>
                  <Download className="size-4" aria-hidden="true" />
                  {t('coachModule.report.button', 'Descargar informe')}
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleGenerateReport('team_readiness')}>
                  {t('coachModule.report.teamReadiness', 'Reporte completo del plantel')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGenerateReport('watchlist')}>
                  {t('coachModule.report.watchlist', 'Solo jugadores a vigilar')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'resumen' | 'partidos')}>
        <TabsList>
          <TabsTrigger value="resumen">{t('coachModule.tabs.summary', 'Resumen')}</TabsTrigger>
          <TabsTrigger value="partidos">{t('coachModule.tabs.matches', 'Análisis de partidos')}</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('coachModule.stat.available', 'Disponibles')}
          value={`${available.length}/${readiness.length}`}
          icon={Users}
          accent="success"
        />
        <StatCard
          label={t('coachModule.stat.injured', 'Lesionados')}
          value={unavailable.length}
          icon={HeartPulse}
          accent={unavailable.length > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label={t('coachModule.stat.toWatch', 'A vigilar')}
          value={watchList.length}
          icon={ShieldAlert}
          accent={watchList.length > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label={t('coachModule.stat.highFatigue', 'Fatiga alta')}
          value={readiness.filter((r) => r.fatigue === 'alto').length}
          icon={Activity}
          accent="purple"
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-ai" aria-hidden="true" />
                {t('coachModule.xi.title', 'Once ideal sugerido (4-3-3)')}
              </CardTitle>
              <CardDescription className="mt-1">
                {t('coachModule.xi.description', 'Según disponibilidad, forma física reciente y rendimiento — nunca incluye lesionados')}
              </CardDescription>
            </div>
          </CardHeader>
          {available.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t('coachModule.xi.emptyTitle', 'Sin jugadores disponibles')}
              description={t('coachModule.xi.emptyDescription', 'Todo el plantel figura lesionado o sin datos.')}
            />
          ) : (
            <div className="space-y-4">
              {suggestedXi.map(({ position, starters, short }) => (
                <div key={position}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(`coachModule.position.${position}`, position)}
                  </p>
                  <div className="space-y-1.5">
                    {starters.map(({ player, score, fatigue }) => (
                      <div key={player.id} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => goToProfile(player.id)}
                          className="focus-ring flex flex-1 items-center justify-between gap-3 rounded-md border border-border bg-panel px-3 py-2 text-left transition-colors hover:border-ai/40 hover:bg-card"
                        >
                          <span className="text-sm font-medium text-foreground">{player.full_name}</span>
                          <span className="flex items-center gap-2">
                            {fatigue && (
                              <Badge variant={fatigue === 'alto' ? 'danger' : fatigue === 'medio' ? 'warning' : 'success'}>
                                {t(`coachModule.fatigue.${fatigue}`, fatigue)}
                              </Badge>
                            )}
                            <span className="text-xs font-semibold text-muted-foreground">{score}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            explain(
                              t('coachModule.explain.xiQuestion', '¿Por qué se sugiere a {{name}} de titular?', {
                                name: player.full_name,
                              }),
                            )
                          }
                          aria-label={t('coachModule.explain.label', 'Explicame esto')}
                          title={t('coachModule.explain.label', 'Explicame esto')}
                          className="focus-ring flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-ai/40 hover:text-ai"
                        >
                          <MessageCircleQuestion className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                    {short > 0 && (
                      <p className="px-3 text-xs text-warning">
                        {t('coachModule.xi.shortOnPosition', 'Plantel corto en esta posición — faltan {{count}}', { count: short })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-warning" aria-hidden="true" />
                {t('coachModule.watch.title', 'Jugadores a vigilar')}
              </CardTitle>
              <CardDescription className="mt-1">
                {t('coachModule.watch.description', 'Lesión activa, riesgo de lesión/fatiga o tarjetas acumuladas')}
              </CardDescription>
            </div>
          </CardHeader>
          {watchList.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title={t('coachModule.watch.emptyTitle', 'Nada que vigilar')}
              description={t('coachModule.watch.emptyDescription', 'Ningún jugador tiene alertas activas ahora mismo.')}
            />
          ) : (
            <div className="space-y-2">
              {watchList.map(({ entry, reason, severity }, index) => (
                <div key={`${entry.player.id}-${index}`} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => goToProfile(entry.player.id)}
                    className={
                      'focus-ring flex flex-1 items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-colors hover:bg-card ' +
                      (severity === 'danger' ? 'border-danger/30 bg-danger/5' : 'border-warning/30 bg-warning/5')
                    }
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{entry.player.full_name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{reason}</p>
                    </div>
                    <AlertTriangle className={'size-4 shrink-0 ' + (severity === 'danger' ? 'text-danger' : 'text-warning')} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      explain(
                        t('coachModule.explain.watchQuestion', '¿Por qué {{name}} está en la lista de vigilar?', {
                          name: entry.player.full_name,
                        }),
                      )
                    }
                    aria-label={t('coachModule.explain.label', 'Explicame esto')}
                    title={t('coachModule.explain.label', 'Explicame esto')}
                    className="focus-ring flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-ai/40 hover:text-ai"
                  >
                    <MessageCircleQuestion className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mb-5">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="size-4 text-purple" aria-hidden="true" />
              {t('coachModule.mvp.title', 'Candidatos a MVP de la temporada')}
            </CardTitle>
            <CardDescription className="mt-1">
              {t('coachModule.mvp.description', 'Combina rendimiento, disponibilidad y estado físico — nunca es un solo número sin explicación')}
            </CardDescription>
          </div>
        </CardHeader>
        {mvpCandidates.length === 0 ? (
          <EmptyState
            icon={Award}
            title={t('coachModule.mvp.emptyTitle', 'Sin datos suficientes')}
            description={t('coachModule.mvp.emptyDescription', 'Hacen falta estadísticas de liga para calcular candidatos.')}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {mvpCandidates.map(({ entry, mvpScore, availabilityRatio }, index) => (
              <div key={entry.player.id} className="relative animate-slide-up" style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'backwards' }}>
                <button
                  type="button"
                  onClick={() => goToProfile(entry.player.id)}
                  className="focus-ring w-full rounded-lg border border-border bg-panel p-4 text-left transition-colors hover:border-purple/40 hover:bg-card"
                >
                  <div className="mb-2 flex items-center justify-between pr-7">
                    <Badge variant="purple">#{index + 1}</Badge>
                    <span className="text-lg font-bold text-foreground">{mvpScore}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{entry.player.full_name}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t('coachModule.mvp.pointsPerGame', '{{value}} pts/partido', { value: (entry.league?.points_per_game ?? 0).toFixed(2) })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('coachModule.mvp.availability', '{{pct}}% de partidos jugados', { pct: Math.round(availabilityRatio * 100) })}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    explain(
                      t('coachModule.explain.mvpQuestion', '¿Por qué {{name}} es candidato a MVP?', { name: entry.player.full_name }),
                    )
                  }
                  aria-label={t('coachModule.explain.label', 'Explicame esto')}
                  title={t('coachModule.explain.label', 'Explicame esto')}
                  className="focus-ring absolute right-2 top-2 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-ai"
                >
                  <MessageCircleQuestion className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" size="sm" onClick={() => navigate('/analisis')}>
          <Video className="size-4" aria-hidden="true" />
          {t('coachModule.link.video', 'Ver mapas de calor y análisis de video completo')}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
        <Button variant="secondary" size="sm" onClick={() => navigate('/atletas')}>
          <Users className="size-4" aria-hidden="true" />
          {t('coachModule.link.roster', 'Ver plantel y estadísticas completas')}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
        </TabsContent>

        <TabsContent value="partidos">
          <MatchAnalysisTab orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
