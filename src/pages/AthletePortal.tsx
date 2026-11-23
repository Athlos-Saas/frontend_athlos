/**
 * Portal del atleta — la experiencia completa del rol `athlete`
 * (030_athlete_role.sql). Mobile-first: el jugador lo abre desde el celular,
 * normalmente para llenar el wellness antes de entrenar.
 *
 * Deliberadamente SIN AppShell (sin sidebar, header de staff, buscador ni
 * AthlosBot): el atleta no navega el dashboard. App.tsx lo enruta acá para
 * cualquier URL. Eso es UX; el aislamiento real lo da RLS — current_org_id()
 * es NULL para athlete y solo las políticas `*_athlete` le devuelven filas, y
 * siempre de su propio jugador.
 *
 * Orden de la página = orden de uso: 1) wellness de hoy (lo que se hace a
 * diario), 2) su carga, 3) su ficha, 4) sus partidos en video, 5) sus
 * lesiones (sin notas clínicas).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, CheckCircle2, Clapperboard, HeartPulse, LogOut, Minus, Plus, Stethoscope, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { TrendAreaChart } from '@/components/charts/TrendAreaChart';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { StatCard } from '@/components/ui/StatCard';
import { Toaster } from '@/components/ui/Toast';
import { colors } from '@/constants/tokens';
import {
  getMyAthleteRating,
  localIsoDate,
  useMyInjuries,
  useMyPlayerId,
  useMyVideoMetrics,
  useSubmitWellness,
  type WellnessCheckIn,
} from '@/features/athletePortal/queries';
import { PlayerRatingCard } from '@/features/playerProfile/components/PlayerRatingCard';
import { formatDate, formatNumber } from '@/features/playerProfile/format';
import {
  usePlayerCore,
  usePlayerGpsSessions,
  usePlayerMediaUrl,
  usePlayerVideoTracks,
  usePlayerWellness,
} from '@/features/playerProfile/queries';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

export interface AthletePortalProps {
  orgId: string;
  userId: string;
  fullName: string | null;
  onSignOut: () => void;
}

const SECTION_IDS = { today: 'hoy', load: 'carga', card: 'ficha', video: 'video' } as const;

export default function AthletePortal({ orgId, userId, fullName, onSignOut }: AthletePortalProps) {
  const { t } = useTranslation();
  const playerIdQuery = useMyPlayerId(userId);
  const playerId = playerIdQuery.data ?? null;

  let body: ReactNode;
  if (playerIdQuery.isLoading) {
    body = <Spinner label={t('athletePortal.loading', 'Cargando tu portal…')} className="min-h-[50vh]" />;
  } else if (playerIdQuery.isError) {
    body = (
      <ErrorState
        title={t('athletePortal.error.title', 'No se pudo cargar tu portal')}
        description={playerIdQuery.error instanceof Error ? playerIdQuery.error.message : undefined}
        onRetry={() => playerIdQuery.refetch()}
      />
    );
  } else if (!playerId) {
    body = (
      <EmptyState
        icon={UserRound}
        title={t('athletePortal.unlinked.title', 'Tu cuenta todavía no está enlazada a un jugador')}
        description={t(
          'athletePortal.unlinked.description',
          'Pide a un administrador de tu club que enlace tu cuenta a tu ficha de jugador desde Usuarios.',
        )}
      />
    );
  } else {
    body = <PortalContent orgId={orgId} playerId={playerId} />;
  }

  return (
    <div className="min-h-screen bg-bg pb-[env(safe-area-inset-bottom)]">
      <PortalHeader orgId={orgId} playerId={playerId} fullName={fullName} onSignOut={onSignOut} />
      <main className="mx-auto w-full max-w-2xl px-4 pb-10 pt-4">{body}</main>
      <Toaster />
    </div>
  );
}

function PortalHeader({
  orgId,
  playerId,
  fullName,
  onSignOut,
}: {
  orgId: string;
  playerId: string | null;
  fullName: string | null;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
        {playerId ? (
          <HeaderIdentity orgId={orgId} playerId={playerId} fallbackName={fullName} />
        ) : (
          <IdentityLine name={fullName ?? ''} photoUrl={null} subtitle="" />
        )}
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          <LogOut className="size-4" aria-hidden="true" />
          <span>{t('athletePortal.signOut', 'Salir')}</span>
        </Button>
      </div>
      {playerId && (
        <nav className="mx-auto flex w-full max-w-2xl gap-1 overflow-x-auto px-4 pb-2" aria-label={t('athletePortal.nav.label', 'Secciones del portal')}>
          {(
            [
              ['today', t('athletePortal.nav.today', 'Hoy')],
              ['load', t('athletePortal.nav.load', 'Mi carga')],
              ['card', t('athletePortal.nav.card', 'Mi ficha')],
              ['video', t('athletePortal.nav.video', 'Video')],
            ] as const
          ).map(([key, label]) => (
            <a
              key={key}
              href={`#${SECTION_IDS[key]}`}
              className="focus-ring shrink-0 rounded-full border border-border bg-panel px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

/** Solo se monta con jugador enlazado: usePlayerCore no tiene `enabled` y con un id vacío haría una consulta inválida. */
function HeaderIdentity({ orgId, playerId, fallbackName }: { orgId: string; playerId: string; fallbackName: string | null }) {
  const { t } = useTranslation();
  const core = usePlayerCore(orgId, playerId);
  const player = core.data;
  const photo = usePlayerMediaUrl(player?.photo_url);
  const subtitle = player
    ? [player.position, player.team_name ?? t('athletePortal.noTeam', 'Sin equipo asignado')].filter(Boolean).join(' · ')
    : '';
  return <IdentityLine name={player?.full_name ?? fallbackName ?? ''} photoUrl={photo.data ?? null} subtitle={subtitle} />;
}

function IdentityLine({ name, photoUrl, subtitle }: { name: string; photoUrl: string | null; subtitle: string }) {
  const { t } = useTranslation();
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <>
      <Avatar className="size-11">
        {photoUrl && <AvatarImage src={photoUrl} alt="" />}
        <AvatarFallback>{initials || <UserRound className="size-5" aria-hidden="true" />}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-foreground">
          {t('athletePortal.greeting', 'Hola, {{name}}', { name: name.split(' ')[0] || name })}
        </p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </>
  );
}

function PortalContent({ orgId, playerId }: { orgId: string; playerId: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
      <section id={SECTION_IDS.today} className="scroll-mt-32">
        <WellnessToday orgId={orgId} playerId={playerId} />
      </section>
      <section id={SECTION_IDS.load} className="scroll-mt-32">
        <SectionTitle icon={Activity}>{t('athletePortal.load.title', 'Mi carga reciente')}</SectionTitle>
        <MyLoad orgId={orgId} playerId={playerId} />
      </section>
      <section id={SECTION_IDS.card} className="scroll-mt-32">
        <SectionTitle icon={UserRound}>{t('athletePortal.card.title', 'Mi ficha')}</SectionTitle>
        <PlayerRatingCard orgId={orgId} playerId={playerId} loader={getMyAthleteRating} />
        <p className="mt-2 text-xs text-muted-foreground">
          {t('athletePortal.card.empty', 'Tu ficha aparece cuando haya suficientes datos de entrenamiento y competición.')}
        </p>
      </section>
      <section id={SECTION_IDS.video} className="scroll-mt-32">
        <SectionTitle icon={Clapperboard}>{t('athletePortal.video.title', 'Mis partidos en video')}</SectionTitle>
        <MyVideo orgId={orgId} playerId={playerId} />
      </section>
      <section className="scroll-mt-32">
        <SectionTitle icon={Stethoscope}>{t('athletePortal.injuries.title', 'Mi historial de lesiones')}</SectionTitle>
        <MyInjuries playerId={playerId} />
      </section>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Activity; children: ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
      <Icon className="size-5 text-ai" aria-hidden="true" />
      {children}
    </h2>
  );
}

// ---------------------------------------------------------------------------
// 1. Wellness de hoy — botones grandes (≥44 px) en vez de sliders: con el
// pulgar, un slider de 0-10 es impreciso y lento; tocar un número es un gesto.
// ---------------------------------------------------------------------------

const DEFAULT_CHECK_IN: Omit<WellnessCheckIn, 'entry_date'> = {
  rpe: 5,
  sleep_hours: 7.5,
  sleep_quality: 3,
  soreness: 2,
  mood: 4,
};

function ScalePicker({
  label,
  hint,
  min,
  max,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  lowLabel?: string;
  highLabel?: string;
}) {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className={cn('grid gap-1.5', options.length > 6 ? 'grid-cols-6 sm:grid-cols-11' : 'grid-cols-5')} role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <Button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === value}
            variant={option === value ? 'primary' : 'secondary'}
            className="h-11 px-0 text-base"
            onClick={() => onChange(option)}
          >
            {option}
          </Button>
        ))}
      </div>
      {(lowLabel || highLabel) && (
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </fieldset>
  );
}

function WellnessToday({ orgId, playerId }: { orgId: string; playerId: string }) {
  const { t } = useTranslation();
  const today = localIsoDate();
  const wellness = usePlayerWellness(orgId, playerId);
  const submit = useSubmitWellness(orgId, playerId);
  const todayEntry = useMemo(() => (wellness.data ?? []).find((entry) => entry.entry_date === today), [wellness.data, today]);
  const [form, setForm] = useState(DEFAULT_CHECK_IN);
  const [isEditing, setIsEditing] = useState(false);

  // Si ya cargó hoy, el formulario arranca con lo que cargó (corregir, no reescribir de cero).
  useEffect(() => {
    if (!todayEntry) return;
    setForm((previous) => ({
      ...previous,
      rpe: todayEntry.rpe ?? previous.rpe,
      sleep_hours: todayEntry.sleep_hours ?? previous.sleep_hours,
      soreness: todayEntry.soreness ?? previous.soreness,
      mood: todayEntry.mood ?? previous.mood,
    }));
  }, [todayEntry]);

  const setField = <K extends keyof typeof form>(key: K) => (value: (typeof form)[K]) => setForm((previous) => ({ ...previous, [key]: value }));

  const handleSubmit = () => {
    submit.mutate(
      { entry_date: today, ...form },
      {
        onSuccess: () => {
          setIsEditing(false);
          toast({ title: t('athletePortal.wellness.savedTitle', 'Wellness guardado'), variant: 'success' });
        },
        onError: (error) => {
          toast({
            title: t('athletePortal.wellness.saveErrorTitle', 'No se pudo guardar tu wellness'),
            description: error instanceof Error ? error.message : undefined,
            variant: 'danger',
          });
        },
      },
    );
  };

  if (wellness.isLoading) return <Skeleton className="h-72 w-full" />;
  if (wellness.isError) {
    return (
      <ErrorState
        title={t('athletePortal.error.sectionTitle', 'No se pudo cargar esta sección')}
        description={wellness.error instanceof Error ? wellness.error.message : undefined}
        onRetry={() => wellness.refetch()}
      />
    );
  }

  if (todayEntry && !isEditing) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{t('athletePortal.wellness.doneTitle', 'Ya registraste tu wellness de hoy')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('athletePortal.wellness.doneDescription', 'Puedes corregirlo durante el día si algo cambió.')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge variant="ai">RPE {todayEntry.rpe ?? '--'}</Badge>
              <Badge variant="neutral">
                {t('athletePortal.wellness.sleepHours', 'Horas de sueño')}: {todayEntry.sleep_hours ?? '--'}
              </Badge>
              <Badge variant="warning">
                {t('athletePortal.wellness.soreness', 'Dolor muscular (0-10)')}: {todayEntry.soreness ?? '--'}
              </Badge>
            </div>
          </div>
        </div>
        <Button variant="secondary" className="mt-4 w-full" onClick={() => setIsEditing(true)}>
          {t('athletePortal.wellness.edit', 'Corregir')}
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="size-5 text-success" aria-hidden="true" />
            {t('athletePortal.wellness.title', 'Wellness de hoy')}
          </CardTitle>
          <CardDescription className="mt-1">
            {t('athletePortal.wellness.subtitle', '30 segundos. Tu staff lo usa para cuidar tu carga.')}
          </CardDescription>
        </div>
      </CardHeader>
      <div className="space-y-5">
        <ScalePicker
          label={t('athletePortal.wellness.rpe', 'Esfuerzo del último entrenamiento (RPE 0-10)')}
          hint={t('athletePortal.wellness.rpeHint', '0 = reposo · 10 = máximo esfuerzo')}
          min={0}
          max={10}
          value={form.rpe}
          onChange={setField('rpe')}
        />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">{t('athletePortal.wellness.sleepHours', 'Horas de sueño')}</legend>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              className="h-11 w-14"
              aria-label={t('athletePortal.wellness.decrease', 'Menos')}
              onClick={() => setField('sleep_hours')(Math.max(0, form.sleep_hours - 0.5))}
            >
              <Minus className="size-4" aria-hidden="true" />
            </Button>
            <output className="flex-1 text-center text-2xl font-bold text-foreground" aria-live="polite">
              {form.sleep_hours.toFixed(1)} {t('athletePortal.wellness.hoursUnit', 'h')}
            </output>
            <Button
              type="button"
              variant="secondary"
              className="h-11 w-14"
              aria-label={t('athletePortal.wellness.increase', 'Más')}
              onClick={() => setField('sleep_hours')(Math.min(24, form.sleep_hours + 0.5))}
            >
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </fieldset>
        <ScalePicker
          label={t('athletePortal.wellness.sleepQuality', 'Calidad del sueño')}
          min={1}
          max={5}
          value={form.sleep_quality}
          onChange={setField('sleep_quality')}
          lowLabel={t('athletePortal.wellness.scaleLow', 'Mal')}
          highLabel={t('athletePortal.wellness.scaleHigh', 'Muy bien')}
        />
        <ScalePicker
          label={t('athletePortal.wellness.soreness', 'Dolor muscular (0-10)')}
          hint={t('athletePortal.wellness.sorenessHint', '0 = sin dolor · 10 = dolor fuerte')}
          min={0}
          max={10}
          value={form.soreness}
          onChange={setField('soreness')}
        />
        <ScalePicker
          label={t('athletePortal.wellness.mood', 'Ánimo')}
          min={1}
          max={5}
          value={form.mood}
          onChange={setField('mood')}
          lowLabel={t('athletePortal.wellness.scaleLow', 'Mal')}
          highLabel={t('athletePortal.wellness.scaleHigh', 'Muy bien')}
        />
        <Button size="lg" className="w-full" isLoading={submit.isPending} onClick={handleSubmit}>
          {t('athletePortal.wellness.submit', 'Enviar wellness')}
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 2. Mi carga — mismos charts que la ficha (TrendLineChart / TrendAreaChart).
// ---------------------------------------------------------------------------

const RECENT_SESSIONS = 14;

function MyLoad({ orgId, playerId }: { orgId: string; playerId: string }) {
  const { t } = useTranslation();
  const sessions = usePlayerGpsSessions(orgId, playerId);
  const wellness = usePlayerWellness(orgId, playerId);

  // La consulta viene ascendente por fecha: las últimas N son las más recientes.
  const recent = useMemo(() => (sessions.data ?? []).slice(-RECENT_SESSIONS), [sessions.data]);
  const wellnessTrend = useMemo(() => [...(wellness.data ?? [])].reverse().slice(-RECENT_SESSIONS), [wellness.data]);
  const last = recent[recent.length - 1];

  if (sessions.isLoading) return <Skeleton className="h-64 w-full" />;
  if (sessions.isError) {
    return (
      <ErrorState
        title={t('athletePortal.error.sectionTitle', 'No se pudo cargar esta sección')}
        description={sessions.error instanceof Error ? sessions.error.message : undefined}
        onRetry={() => sessions.refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      {recent.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={t('athletePortal.load.empty.title', 'Todavía no hay sesiones GPS')}
          description={t(
            'athletePortal.load.empty.description',
            'Cuando tu staff cargue las sesiones de entrenamiento vas a ver tu carga acá.',
          )}
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {t('athletePortal.load.lastSession', 'Última sesión')}: {formatDate(last?.session_date)}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <StatCard label={t('athletePortal.load.playerLoad', 'Player Load')} value={formatNumber(last?.player_load, 0)} accent="success" />
            <StatCard label={t('athletePortal.load.distance', 'Distancia (km)')} value={formatNumber(last?.distance_km, 2)} accent="ai" />
            <StatCard label={t('athletePortal.load.topSpeed', 'Vel. máxima (km/h)')} value={formatNumber(last?.top_speed_kmh, 1)} accent="purple" />
          </div>
          <ChartCard
            title={t('athletePortal.load.trendTitle', 'Player Load por sesión')}
            description={t('athletePortal.load.trendDescription', 'Tus últimas {{count}} sesiones GPS', { count: recent.length })}
            height={220}
          >
            <TrendLineChart data={recent} xKey="session_date" yKey="player_load" name={t('athletePortal.load.playerLoad', 'Player Load')} color={colors.green} />
          </ChartCard>
        </>
      )}
      {wellnessTrend.length > 1 && (
        <ChartCard title={t('athletePortal.load.wellnessTrendTitle', 'Tu dolor muscular reciente')} height={180}>
          <TrendAreaChart
            data={wellnessTrend}
            xKey="entry_date"
            yKey="soreness"
            name={t('athletePortal.load.sorenessSeries', 'Dolor')}
            color={colors.orange}
          />
        </ChartCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Mis partidos en video — tracks asignados a él + sus métricas por track.
// ---------------------------------------------------------------------------

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md bg-panel/60 px-2.5 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-mono text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function formatSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '--';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function MyVideo({ orgId, playerId }: { orgId: string; playerId: string }) {
  const { t } = useTranslation();
  const tracks = usePlayerVideoTracks(orgId, playerId);
  const metrics = useMyVideoMetrics(playerId, tracks.data ?? []);
  const metricsByTrack = useMemo(
    () => new Map((metrics.data ?? []).map((row) => [`${row.video_id}:${row.track_id}`, row])),
    [metrics.data],
  );
  const rows = useMemo(
    () => [...(tracks.data ?? [])].sort((a, b) => (b.match_date ?? '').localeCompare(a.match_date ?? '')),
    [tracks.data],
  );

  if (tracks.isLoading) return <Skeleton className="h-40 w-full" />;
  const error = tracks.error ?? metrics.error;
  if (tracks.isError || metrics.isError) {
    return (
      <ErrorState
        title={t('athletePortal.error.sectionTitle', 'No se pudo cargar esta sección')}
        description={error instanceof Error ? error.message : undefined}
        onRetry={() => {
          tracks.refetch();
          metrics.refetch();
        }}
      />
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Clapperboard}
        title={t('athletePortal.video.empty.title', 'Todavía no apareces en un video analizado')}
        description={t(
          'athletePortal.video.empty.description',
          'Cuando tu staff te asigne en el análisis de un partido, vas a ver tus métricas acá.',
        )}
      />
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((track) => {
        const m = metricsByTrack.get(`${track.video_id}:${track.track_id}`);
        return (
          <Card key={`${track.video_id}:${track.track_id}`}>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <p className="truncate font-semibold text-foreground">{track.video_title ?? t('athletePortal.video.untitled', 'Partido sin título')}</p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {track.match_date ? formatDate(track.match_date) : t('athletePortal.video.noDate', 'Sin fecha')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label={t('athletePortal.video.distance', 'Distancia')} value={`${formatNumber(track.distance_m, 0)} m`} />
              <Metric label={t('athletePortal.video.maxSpeed', 'Vel. máx.')} value={`${formatNumber(track.max_speed_kmh, 1)} km/h`} />
              <Metric label={t('athletePortal.video.avgSpeed', 'Vel. media')} value={`${formatNumber(track.avg_speed_kmh, 1)} km/h`} />
              <Metric label={t('athletePortal.video.timeVisible', 'Tiempo en cámara')} value={formatSeconds(track.time_visible_s)} />
              {m && (
                <>
                  <Metric label={t('athletePortal.video.passes', 'Pases')} value={m.passes_made} />
                  <Metric label={t('athletePortal.video.passesReceived', 'Pases recibidos')} value={m.passes_received} />
                  <Metric label={t('athletePortal.video.carries', 'Conducciones')} value={m.carries} />
                  <Metric label={t('athletePortal.video.shots', 'Remates (a puerta)')} value={`${m.shots} (${m.shots_on_target})`} />
                  <Metric label={t('athletePortal.video.possession', 'Posesión')} value={formatSeconds(m.possession_time_s)} />
                </>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Lesiones — RPC athlete_my_injuries(): sin notes ni mechanism.
// ---------------------------------------------------------------------------

const SEVERITY_BADGE = { minor: 'warning', moderate: 'danger', severe: 'danger' } as const;

function MyInjuries({ playerId }: { playerId: string }) {
  const { t } = useTranslation();
  const injuries = useMyInjuries(playerId);

  if (injuries.isLoading) return <Skeleton className="h-24 w-full" />;
  if (injuries.isError) {
    return (
      <ErrorState
        title={t('athletePortal.error.sectionTitle', 'No se pudo cargar esta sección')}
        description={injuries.error instanceof Error ? injuries.error.message : undefined}
        onRetry={() => injuries.refetch()}
      />
    );
  }
  const rows = injuries.data ?? [];

  return (
    <Card>
      <p className="mb-3 text-xs text-muted-foreground">
        {t('athletePortal.injuries.note', 'Ves fechas, zona, tipo y severidad. Las notas clínicas quedan con el staff médico.')}
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('athletePortal.injuries.empty', 'Sin lesiones registradas.')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((injury, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={`${injury.injury_date}-${index}`} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {[injury.injury_type, injury.body_area].filter(Boolean).join(' · ') || '--'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(injury.injury_date)}
                  {' · '}
                  {injury.return_date
                    ? t('athletePortal.injuries.returned', 'Alta: {{date}}', { date: formatDate(injury.return_date) })
                    : t('athletePortal.injuries.active', 'En recuperación')}
                </p>
              </div>
              <Badge variant={SEVERITY_BADGE[injury.severity]}>
                {t(`athletePortal.injuries.severity.${injury.severity}`, injury.severity)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
