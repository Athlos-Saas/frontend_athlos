import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame, Gauge, TrendingDown, TrendingUp, Video as VideoIcon } from 'lucide-react';

import { LiveMatchMap } from '@/components/videos/LiveMatchMap';
import type { TrajectoryPoint } from '@/components/charts/SoccerPitchMap';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { Switch } from '@/components/ui/Switch';
import { supabase } from '@/lib/supabase';

interface VideoOption {
  id: string;
  title: string;
  match_date: string | null;
  processed_path: string | null;
  storage_path: string | null;
}

interface TrackRow {
  track_id: number;
  avg_speed_kmh: number | null;
  max_speed_kmh: number | null;
  time_visible_s: number | null;
  matched_player_id: string | null;
  shirt_color: string | null;
}

const MIN_TIME_VISIBLE_S = 20;
const FALLBACK_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#ef4444', '#06b6d4'];

/**
 * Pestaña "Análisis de partidos" del Módulo Entrenador — a diferencia del
 * tablero técnico de /analisis (mapa de calor, movimiento, forma del
 * equipo, velocidad por tramos), acá solo se muestran 3 números relevantes
 * (más rápido, más lento, promedio) y el mapa de posiciones se sincroniza
 * EN VIVO con el video real (no es una animación aparte con su propio
 * ritmo) — el entrenador reproduce el partido y ve el mapa moverse al
 * mismo tiempo, sin tener que interpretar tablas.
 */
export function MatchAnalysisTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [videos, setVideos] = useState<VideoOption[] | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [trajectories, setTrajectories] = useState<Record<string, TrajectoryPoint[]>>({});
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [playerNameById, setPlayerNameById] = useState<Map<string, string>>(new Map());
  const [currentTime, setCurrentTime] = useState(0);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [isLoadingMatch, setIsLoadingMatch] = useState(false);

  useEffect(() => {
    supabase
      .from('video_analyses')
      .select('id, title, match_date, processed_path, storage_path')
      .eq('org_id', orgId)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = (data as VideoOption[]) ?? [];
        setVideos(list);
        if (list.length > 0) setSelectedVideoId(list[0].id);
      });

    supabase
      .from('players')
      .select('id, full_name')
      .eq('org_id', orgId)
      .then(({ data }) => setPlayerNameById(new Map((data ?? []).map((p) => [p.id, p.full_name as string]))));
  }, [orgId]);

  useEffect(() => {
    if (!selectedVideoId || !videos) return;
    const video = videos.find((v) => v.id === selectedVideoId);
    if (!video) return;

    setIsLoadingMatch(true);
    setCurrentTime(0);
    setVideoUrl(null);
    setTrajectories({});
    setTracks([]);

    const bucket = video.processed_path ? 'processed' : video.storage_path ? 'videos' : null;
    const path = video.processed_path ?? video.storage_path;

    Promise.all([
      bucket && path ? supabase.storage.from(bucket).createSignedUrl(path, 3600) : Promise.resolve({ data: null }),
      supabase.storage.from('heatmaps').createSignedUrl(`${orgId}/${selectedVideoId}/tracks.json`, 3600),
      supabase
        .from('video_player_tracks')
        .select('track_id, avg_speed_kmh, max_speed_kmh, time_visible_s, matched_player_id, shirt_color')
        .eq('video_id', selectedVideoId),
    ]).then(async ([videoSignedRes, tracksJsonRes, tracksTableRes]) => {
      setVideoUrl(videoSignedRes.data?.signedUrl ?? null);
      setTracks((tracksTableRes.data as TrackRow[]) ?? []);

      if (tracksJsonRes.data?.signedUrl) {
        try {
          const response = await fetch(tracksJsonRes.data.signedUrl);
          const json = (await response.json()) as Record<string, TrajectoryPoint[]>;
          setTrajectories(json);
        } catch {
          setTrajectories({});
        }
      }
      setIsLoadingMatch(false);
    });
  }, [selectedVideoId, videos, orgId]);

  const colorByTrackId = useMemo(() => {
    const map = new Map<string, string>();
    tracks.forEach((track, index) => {
      map.set(String(track.track_id), track.shirt_color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]);
    });
    return map;
  }, [tracks]);

  const labelByTrackId = useMemo(() => {
    const map = new Map<string, string>();
    for (const track of tracks) {
      const name = track.matched_player_id ? playerNameById.get(track.matched_player_id) : null;
      map.set(String(track.track_id), name ? name.split(' ')[0] : `J${track.track_id}`);
    }
    return map;
  }, [tracks, playerNameById]);

  const speedStats = useMemo(() => {
    const eligible = tracks.filter((track) => (track.time_visible_s ?? 0) >= MIN_TIME_VISIBLE_S && track.max_speed_kmh !== null);
    if (eligible.length === 0) return null;
    const fastest = eligible.reduce((a, b) => ((a.max_speed_kmh ?? 0) >= (b.max_speed_kmh ?? 0) ? a : b));
    const slowest = eligible.reduce((a, b) => ((a.max_speed_kmh ?? 0) <= (b.max_speed_kmh ?? 0) ? a : b));
    const avgSpeeds = eligible.map((track) => track.avg_speed_kmh ?? 0).filter((v) => v > 0);
    const average = avgSpeeds.length > 0 ? avgSpeeds.reduce((a, b) => a + b, 0) / avgSpeeds.length : null;
    return { fastest, slowest, average };
  }, [tracks]);

  const nameFor = (trackId: number) => labelByTrackId.get(String(trackId)) ?? `J${trackId}`;

  if (videos === null) return <Skeleton className="h-96 w-full" />;

  if (videos.length === 0) {
    return (
      <EmptyState
        icon={VideoIcon}
        title={t('coachModule.matches.empty.title', 'Sin partidos analizados todavía')}
        description={t('coachModule.matches.empty.description', 'Subí y analizá un video en Análisis para verlo acá.')}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder={t('coachModule.matches.selectPlaceholder', 'Elegí un partido')} />
          </SelectTrigger>
          <SelectContent>
            {videos.map((video) => (
              <SelectItem key={video.id} value={video.id}>
                {video.title} {video.match_date ? `· ${video.match_date}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showHeatmap} onCheckedChange={setShowHeatmap} />
          {t('coachModule.matches.showHeatmap', 'Mostrar mapa de calor')}
        </label>
      </div>

      {isLoadingMatch ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-2">
              {videoUrl ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  playsInline
                  className="max-h-[420px] w-full rounded-lg"
                  onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                />
              ) : (
                <EmptyState
                  icon={VideoIcon}
                  title={t('coachModule.matches.noVideoTitle', 'Sin video para reproducir')}
                  description={t('coachModule.matches.noVideoDescription', 'Este análisis no tiene un archivo de video asociado.')}
                />
              )}
            </Card>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('coachModule.matches.liveMapLabel', 'Mapa en vivo — sincronizado con el video')}
              </p>
              <LiveMatchMap
                trajectories={trajectories}
                currentTime={currentTime}
                colorByTrackId={colorByTrackId}
                labelByTrackId={labelByTrackId}
                showHeatmap={showHeatmap}
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>{t('coachModule.matches.statsTitle', 'Lo relevante de este partido')}</CardTitle>
                <CardDescription className="mt-1">
                  {t('coachModule.matches.statsDescription', 'Solo lo que importa en cancha — el resto del detalle sigue en Análisis')}
                </CardDescription>
              </div>
            </CardHeader>
            {!speedStats ? (
              <EmptyState
                title={t('coachModule.matches.noStatsTitle', 'Sin datos suficientes')}
                description={t('coachModule.matches.noStatsDescription', 'Este partido no tiene identidades con suficiente tiempo en cuadro.')}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                  label={t('coachModule.matches.fastest', 'Más rápido')}
                  value={`${nameFor(speedStats.fastest.track_id)} · ${(speedStats.fastest.max_speed_kmh ?? 0).toFixed(1)} km/h`}
                  icon={TrendingUp}
                  accent="success"
                />
                <StatCard
                  label={t('coachModule.matches.slowest', 'Más lento')}
                  value={`${nameFor(speedStats.slowest.track_id)} · ${(speedStats.slowest.max_speed_kmh ?? 0).toFixed(1)} km/h`}
                  icon={TrendingDown}
                  accent="warning"
                />
                <StatCard
                  label={t('coachModule.matches.average', 'Promedio del equipo')}
                  value={speedStats.average !== null ? `${speedStats.average.toFixed(1)} km/h` : '—'}
                  icon={Gauge}
                  accent="ai"
                />
              </div>
            )}
          </Card>
        </>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Flame className="size-3.5" aria-hidden="true" />
        {t('coachModule.matches.deepLinkHint', 'Para el mapa de calor completo, forma del equipo y velocidad por tramos, entrá a Análisis.')}
      </p>
      <Button variant="secondary" size="sm" className="mt-2" onClick={() => window.location.assign('/analisis')}>
        {t('coachModule.link.video', 'Ver mapas de calor y análisis de video completo')}
      </Button>
    </div>
  );
}
