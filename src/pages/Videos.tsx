import { useEffect, useRef, useState } from 'react';
import { Film, Play, Trash2, Upload } from 'lucide-react';

import { SoccerPitchMap, type TrajectoryPoint } from '@/components/charts/SoccerPitchMap';
import { AnalyzingIndicator } from '@/components/ui/AnalyzingIndicator';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableSkeletonRows } from '@/components/ui/Table';
import { usePagedRows } from '@/hooks/usePagedRows';
import { triggerVideoProcessing } from '@/lib/backendApi';
import { supabase } from '@/lib/supabase';
import { toast } from '@/store/toastStore';
import { canWrite } from '@/utils/permissions';
import type { VideoAnalysis, VideoPlayerTrack } from '@/types/domain';

const STATUS_BADGE: Record<VideoAnalysis['status'], 'ai' | 'warning' | 'success' | 'danger'> = {
  uploaded: 'ai',
  processing: 'warning',
  done: 'success',
  failed: 'danger',
};

const STATUS_LABEL: Record<VideoAnalysis['status'], string> = {
  uploaded: 'Subido',
  processing: 'Analizando',
  done: 'Listo',
  failed: 'Falló',
};

const POLL_INTERVAL_MS = 4000;

export default function Videos({ orgId, role }: { orgId: string; role: string | null }) {
  const [videos, setVideos] = useState<VideoAnalysis[] | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState('Partido sin título');
  const [isUploading, setIsUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [tracks, setTracks] = useState<VideoPlayerTrack[]>([]);
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [trajectories, setTrajectories] = useState<Record<string, TrajectoryPoint[]>>({});
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadVideos = () => {
    supabase
      .from('video_analyses')
      .select('id, title, status, created_at, storage_path, processed_path, error_message')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast({ title: 'No se pudieron cargar los videos', description: error.message, variant: 'danger' });
          return;
        }
        setVideos(data ?? []);
      });
  };

  useEffect(loadVideos, [orgId]);

  // Mientras haya algún video "processing", refresca solo — para que el estado
  // avance a "done"/"failed" sin que el usuario tenga que recargar la página.
  useEffect(() => {
    const hasProcessing = (videos ?? []).some((video) => video.status === 'processing');
    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(loadVideos, POLL_INTERVAL_MS);
    } else if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos]);

  useEffect(() => {
    setSelectedTrackId(null);
    if (!selectedVideoId) {
      setTracks([]);
      setResultVideoUrl(null);
      setTrajectories({});
      return;
    }
    supabase
      .from('video_player_tracks')
      .select('track_id, distance_m, time_visible_s, avg_speed_kmh, max_speed_kmh')
      .eq('video_id', selectedVideoId)
      .order('distance_m', { ascending: false })
      .then(({ data }) => setTracks(data ?? []));

    const selected = (videos ?? []).find((video) => video.id === selectedVideoId);
    if (selected?.processed_path) {
      supabase.storage
        .from('processed')
        .createSignedUrl(selected.processed_path, 3600)
        .then(({ data }) => setResultVideoUrl(data?.signedUrl ?? null));
    } else {
      setResultVideoUrl(null);
    }

    supabase.storage
      .from('heatmaps')
      .createSignedUrl(`${orgId}/${selectedVideoId}/tracks.json`, 3600)
      .then(({ data, error }) => {
        if (error || !data?.signedUrl) {
          setTrajectories({});
          return;
        }
        fetch(data.signedUrl)
          .then((response) => response.json())
          .then((json: Record<string, TrajectoryPoint[]>) => setTrajectories(json))
          .catch(() => setTrajectories({}));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideoId]);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);

    const storagePath = `${orgId}/raw/${Date.now()}-${selectedFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(storagePath, selectedFile, { contentType: selectedFile.type, upsert: true });

    if (uploadError) {
      toast({ title: 'Error al subir el video', description: uploadError.message, variant: 'danger' });
      setIsUploading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from('video_analyses')
      .insert({ org_id: orgId, title: videoTitle, storage_path: storagePath });

    if (insertError) {
      toast({ title: 'Error al registrar el video', description: insertError.message, variant: 'danger' });
    } else {
      toast({ title: 'Video subido', description: 'Ahora puedes darle "Analizar" en la tabla.', variant: 'success' });
    }
    setSelectedFile(null);
    setIsUploading(false);
    loadVideos();
  };

  const handleAnalyze = async (video: VideoAnalysis) => {
    setAnalyzingId(video.id);
    try {
      await triggerVideoProcessing(orgId, video.id);
      setVideos((current) => (current ?? []).map((v) => (v.id === video.id ? { ...v, status: 'processing' } : v)));
    } catch (error) {
      toast({
        title: 'No se pudo iniciar el análisis',
        description: error instanceof Error ? error.message : undefined,
        variant: 'danger',
      });
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleDelete = async (video: VideoAnalysis) => {
    const cleanupTargets: Array<[string, string]> = [];
    if (video.storage_path) cleanupTargets.push(['videos', video.storage_path]);
    if (video.processed_path) cleanupTargets.push(['processed', video.processed_path]);
    cleanupTargets.push(['heatmaps', `${orgId}/${video.id}/tracks.json`]);
    await Promise.all(
      cleanupTargets.map(([bucket, path]) => supabase.storage.from(bucket).remove([path]).catch(() => null)),
    );

    const { error } = await supabase.from('video_analyses').delete().eq('id', video.id);
    if (error) {
      toast({ title: 'No se pudo eliminar el video', description: error.message, variant: 'danger' });
      return;
    }
    toast({ title: 'Video eliminado', variant: 'success' });
    if (selectedVideoId === video.id) setSelectedVideoId('');
    loadVideos();
  };

  const doneVideos = (videos ?? []).filter((video) => video.status === 'done');
  const videosPager = usePagedRows(videos ?? [], 10);
  const tracksPager = usePagedRows(tracks, 10);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Video análisis</h1>
        <p className="mt-1 text-sm text-muted-foreground">Computer vision: tracking de jugadores desde video convencional</p>
      </div>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Subir video</CardTitle>
        </CardHeader>
        <Field label="Título" htmlFor="title">
          <Input id="title" value={videoTitle} onChange={(event) => setVideoTitle(event.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-panel file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
          />
          <Button onClick={handleUpload} disabled={!selectedFile} isLoading={isUploading}>
            <Upload className="size-4" aria-hidden="true" /> Subir y registrar
          </Button>
        </div>
      </Card>

      <Card className="mb-5">
        <CardHeader>
          <div>
            <CardTitle>Videos de la organización</CardTitle>
            <CardDescription className="mt-1">Estado del pipeline de procesamiento</CardDescription>
          </div>
        </CardHeader>
        {videos !== null && videos.length === 0 ? (
          <EmptyState icon={Film} title="Aún no hay videos" description="Sube el primer video para comenzar el análisis." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videos === null ? (
                <TableSkeletonRows columns={4} />
              ) : (
                videosPager.paged.map((video) => (
                  <TableRow key={video.id}>
                    <TableCell className="font-medium">{video.title}</TableCell>
                    <TableCell>
                      {video.status === 'processing' ? (
                        <AnalyzingIndicator label="Analizando video…" />
                      ) : (
                        <Badge variant={STATUS_BADGE[video.status]}>{STATUS_LABEL[video.status]}</Badge>
                      )}
                      {video.status === 'failed' && video.error_message && (
                        <p className="mt-1 max-w-xs text-xs text-danger">{video.error_message}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(video.created_at).toLocaleString('es-ES')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {video.status === 'uploaded' && canWrite(role) && (
                          <Button size="sm" variant="secondary" isLoading={analyzingId === video.id} onClick={() => handleAnalyze(video)}>
                            <Play className="size-4" aria-hidden="true" /> Analizar
                          </Button>
                        )}
                        {video.status === 'done' && (
                          <Button size="sm" variant="ghost" onClick={() => setSelectedVideoId(video.id)}>
                            Ver resultado
                          </Button>
                        )}
                        {canWrite(role) && (
                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" size="icon">
                                <Trash2 className="size-4" aria-hidden="true" />
                                <span className="sr-only">Eliminar</span>
                              </Button>
                            }
                            title={`¿Eliminar "${video.title}"?`}
                            description="Se borra el video, el análisis, los tracks y los archivos en Storage. No se puede deshacer."
                            confirmLabel="Eliminar"
                            onConfirm={() => handleDelete(video)}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
        <Pagination page={videosPager.page} pageCount={videosPager.pageCount} onPageChange={videosPager.setPage} className="mt-4" />
      </Card>

      {doneVideos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado del análisis</CardTitle>
          </CardHeader>
          <div className="mb-4 max-w-sm">
            <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un video procesado" />
              </SelectTrigger>
              <SelectContent>
                {doneVideos.map((video) => (
                  <SelectItem key={video.id} value={video.id}>
                    {video.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedVideoId && (
            <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {resultVideoUrl ? (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Video anotado</p>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video src={resultVideoUrl} controls playsInline className="w-full rounded-lg border border-border bg-panel" />
                </div>
              ) : (
                <EmptyState title="Sin video anotado" description="Este video procesado no generó un video anotado." />
              )}

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mapa de cancha</p>
                  {Object.keys(trajectories).length > 0 && (
                    <Select
                      value={selectedTrackId ?? '__density__'}
                      onValueChange={(value) => setSelectedTrackId(value === '__density__' ? null : value)}
                    >
                      <SelectTrigger className="h-7 w-44 text-xs">
                        <SelectValue placeholder="Vista" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__density__">Densidad (todos)</SelectItem>
                        {Object.keys(trajectories).map((trackId) => (
                          <SelectItem key={trackId} value={trackId}>
                            Jugador J{trackId}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {Object.keys(trajectories).length > 0 ? (
                  <SoccerPitchMap
                    mode={selectedTrackId ? 'track' : 'density'}
                    allTrajectories={trajectories}
                    selectedTrackId={selectedTrackId}
                  />
                ) : (
                  <EmptyState title="Sin datos de posición" description="No se detectaron suficientes posiciones para dibujar el mapa de cancha." />
                )}
              </div>
            </div>
          )}

          {selectedVideoId && tracks.length === 0 && (
            <EmptyState title="Sin tracks" description="Ese video no tiene tracks registrados." />
          )}
          {tracks.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Track</TableHead>
                  <TableHead>Distancia (m)</TableHead>
                  <TableHead>Tiempo visible (s)</TableHead>
                  <TableHead>Vel. media (km/h)</TableHead>
                  <TableHead>Vel. máx (km/h)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracksPager.paged.map((track) => (
                  <TableRow key={track.track_id}>
                    <TableCell className="font-medium">J{track.track_id}</TableCell>
                    <TableCell className="text-muted-foreground">{Number(track.distance_m).toFixed(1)}</TableCell>
                    <TableCell className="text-muted-foreground">{Number(track.time_visible_s).toFixed(1)}</TableCell>
                    <TableCell className="text-muted-foreground">{Number(track.avg_speed_kmh).toFixed(1)}</TableCell>
                    <TableCell className="text-muted-foreground">{Number(track.max_speed_kmh).toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {tracks.length > 0 && (
            <Pagination page={tracksPager.page} pageCount={tracksPager.pageCount} onPageChange={tracksPager.setPage} className="mt-4" />
          )}
        </Card>
      )}
    </div>
  );
}
