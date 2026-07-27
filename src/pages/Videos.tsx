import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Film, Pencil, Play, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { type TrajectoryPoint } from '@/components/charts/SoccerPitchMap';
import { TacticalBoard, type RosterOption } from '@/components/videos/TacticalBoard';
import { AnalyzingIndicator, VIDEO_PROCESSING_STAGE_KEYS } from '@/components/ui/AnalyzingIndicator';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableSkeletonRows } from '@/components/ui/Table';
import { usePagedRows } from '@/hooks/usePagedRows';
import { pingBackend, triggerVideoProcessing, type YoloModelKey } from '@/lib/backendApi';
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

const YOLO_MODEL_LABEL: Record<YoloModelKey, string> = {
  nano: 'Nano (rápido)',
  small: 'Small (más preciso)',
};

export default function Videos({ orgId, role }: { orgId: string; role: string | null }) {
  const { t } = useTranslation();
  const [videos, setVideos] = useState<VideoAnalysis[] | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState(t('videos.defaultTitle', 'Partido sin título'));
  const [matchDate, setMatchDate] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [tracks, setTracks] = useState<VideoPlayerTrack[]>([]);
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [trajectories, setTrajectories] = useState<Record<string, TrajectoryPoint[]>>({});
  const [rosterPlayers, setRosterPlayers] = useState<RosterOption[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoAnalysis | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMatchDate, setEditMatchDate] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [analyzeVideo, setAnalyzeVideo] = useState<VideoAnalysis | null>(null);
  const [selectedYoloModel, setSelectedYoloModel] = useState<YoloModelKey>('nano');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadVideos = () => {
    supabase
      .from('video_analyses')
      .select('id, title, status, created_at, match_date, storage_path, processed_path, error_message, yolo_model')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast({ title: t('videos.toast.loadError', 'No se pudieron cargar los videos'), description: error.message, variant: 'danger' });
          return;
        }
        setVideos(data ?? []);
      });
  };

  useEffect(loadVideos, [orgId]);

  useEffect(() => {
    supabase
      .from('players')
      .select('id, full_name, position')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => setRosterPlayers((data as RosterOption[]) ?? []));
  }, [orgId]);

  // Mientras haya algún video "processing", refresca solo — para que el estado
  // avance a "done"/"failed" sin que el usuario tenga que recargar la página.
  // De paso, pinguea /health en cada tick: el plan free de Render duerme el
  // backend por falta de tráfico HTTP entrante (no le importa que el worker
  // de video siga corriendo adentro) — esto lo mantiene despierto mientras
  // esta pestaña siga abierta con un análisis en curso.
  useEffect(() => {
    const hasProcessing = (videos ?? []).some((video) => video.status === 'processing');
    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(() => {
        loadVideos();
        pingBackend();
      }, POLL_INTERVAL_MS);
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

  const loadTracks = (videoId: string) => {
    supabase
      .from('video_player_tracks')
      .select('track_id, distance_m, time_visible_s, avg_speed_kmh, max_speed_kmh, matched_player_id, shirt_color')
      .eq('video_id', videoId)
      .order('distance_m', { ascending: false })
      .then(({ data }) => setTracks(data ?? []));
  };

  useEffect(() => {
    if (!selectedVideoId) {
      setTracks([]);
      setResultVideoUrl(null);
      setTrajectories({});
      return;
    }
    loadTracks(selectedVideoId);

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
      toast({ title: t('videos.toast.uploadError', 'Error al subir el video'), description: uploadError.message, variant: 'danger' });
      setIsUploading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from('video_analyses')
      .insert({ org_id: orgId, title: videoTitle, match_date: matchDate || null, storage_path: storagePath });

    if (insertError) {
      toast({ title: t('videos.toast.registerError', 'Error al registrar el video'), description: insertError.message, variant: 'danger' });
    } else {
      toast({
        title: t('videos.toast.uploaded.title', 'Video subido'),
        description: t('videos.toast.uploaded.description', 'Ahora puedes darle "Analizar" en la tabla.'),
        variant: 'success',
      });
    }
    setSelectedFile(null);
    setMatchDate('');
    setIsUploading(false);
    loadVideos();
  };

  const handleAnalyze = async (video: VideoAnalysis, yoloModel: YoloModelKey) => {
    setAnalyzingId(video.id);
    try {
      await triggerVideoProcessing(orgId, video.id, yoloModel);
      setVideos((current) =>
        (current ?? []).map((v) => (v.id === video.id ? { ...v, status: 'processing', yolo_model: yoloModel } : v)),
      );
      setAnalyzeVideo(null);
    } catch (error) {
      toast({
        title: t('videos.toast.analyzeStartError', 'No se pudo iniciar el análisis'),
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
      toast({ title: t('videos.toast.deleteError', 'No se pudo eliminar el video'), description: error.message, variant: 'danger' });
      return;
    }
    toast({ title: t('videos.toast.deleted', 'Video eliminado'), variant: 'success' });
    if (selectedVideoId === video.id) setSelectedVideoId('');
    loadVideos();
  };

  const openRename = (video: VideoAnalysis) => {
    setEditingVideo(video);
    setEditTitle(video.title);
    setEditMatchDate(video.match_date ?? '');
  };

  const handleRenameVideo = async () => {
    if (!editingVideo) return;
    const trimmed = editTitle.trim();
    if (!trimmed) return;

    setIsSavingTitle(true);
    const { error } = await supabase
      .from('video_analyses')
      .update({ title: trimmed, match_date: editMatchDate || null })
      .eq('id', editingVideo.id);
    setIsSavingTitle(false);

    if (error) {
      toast({ title: t('videos.toast.renameError', 'No se pudo guardar los cambios'), description: error.message, variant: 'danger' });
      return;
    }
    setVideos((current) =>
      (current ?? []).map((v) => (v.id === editingVideo.id ? { ...v, title: trimmed, match_date: editMatchDate || null } : v)),
    );
    toast({ title: t('videos.toast.renamed', 'Video actualizado'), variant: 'success' });
    setEditingVideo(null);
  };

  const handleAssignTracks = async (trackIds: number[], playerId: string | null) => {
    if (!selectedVideoId || trackIds.length === 0) return;
    setIsAssigning(true);
    const { error } = await supabase
      .from('video_player_tracks')
      .update({ matched_player_id: playerId })
      .eq('video_id', selectedVideoId)
      .in('track_id', trackIds);
    setIsAssigning(false);
    if (error) {
      toast({ title: t('videos.toast.assignError', 'No se pudo guardar la asignación'), description: error.message, variant: 'danger' });
      return;
    }
    toast({
      title: playerId
        ? t('videos.toast.assigned.title', '{{count}} lectura(s) asignada(s)', { count: trackIds.length })
        : t('videos.toast.released.title', '{{count}} lectura(s) liberada(s)', { count: trackIds.length }),
      description: playerId
        ? t('videos.toast.assigned.description', 'Los datos de esas lecturas ya cuentan para el jugador en su ficha.')
        : undefined,
      variant: 'success',
    });
    loadTracks(selectedVideoId);
  };

  const rosterNameById = new Map(rosterPlayers.map((player) => [player.id, player.full_name]));
  const doneVideos = (videos ?? []).filter((video) => video.status === 'done');
  const videosPager = usePagedRows(videos ?? [], 10);
  const tracksPager = usePagedRows(tracks, 10);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('videos.title', 'Video análisis')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('videos.subtitle', 'Computer vision: tracking de jugadores desde video convencional')}
        </p>
      </div>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>{t('videos.upload.cardTitle', 'Subir video')}</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('videos.fields.title', 'Título')} htmlFor="title">
            <Input id="title" value={videoTitle} onChange={(event) => setVideoTitle(event.target.value)} />
          </Field>
          <Field label={t('videos.fields.matchDate', 'Fecha del partido (opcional)')} htmlFor="match-date">
            <Input
              id="match-date"
              type="date"
              value={matchDate}
              onChange={(event) => setMatchDate(event.target.value)}
            />
          </Field>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          {t(
            'videos.upload.matchDateHint',
            'Se usa para cruzar las métricas de este video con el historial GPS del jugador en su ficha. Sin fecha, el video no aparece en esa comparación.',
          )}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-panel file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
          />
          <Button onClick={handleUpload} disabled={!selectedFile} isLoading={isUploading}>
            <Upload className="size-4" aria-hidden="true" /> {t('videos.upload.submit', 'Subir y registrar')}
          </Button>
        </div>
      </Card>

      <Card className="mb-5">
        <CardHeader>
          <div>
            <CardTitle>{t('videos.list.cardTitle', 'Videos de la organización')}</CardTitle>
            <CardDescription className="mt-1">{t('videos.list.cardDescription', 'Estado del pipeline de procesamiento')}</CardDescription>
          </div>
        </CardHeader>
        {videos !== null && videos.length === 0 ? (
          <EmptyState
            icon={Film}
            title={t('videos.list.emptyTitle', 'Aún no hay videos')}
            description={t('videos.list.emptyDescription', 'Sube el primer video para comenzar el análisis.')}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('videos.list.columns.title', 'Título')}</TableHead>
                <TableHead>{t('videos.list.columns.status', 'Estado')}</TableHead>
                <TableHead>{t('videos.list.columns.date', 'Fecha')}</TableHead>
                <TableHead className="text-right">{t('videos.list.columns.action', 'Acción')}</TableHead>
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
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={video.status}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.25 }}
                        >
                          {video.status === 'processing' ? (
                            <AnalyzingIndicator
                              label={t('videos.status.analyzingLabel', 'Analizando video…')}
                              stageKeys={VIDEO_PROCESSING_STAGE_KEYS}
                            />
                          ) : (
                            <Badge variant={STATUS_BADGE[video.status]}>
                              {t(`videos.status.${video.status}`, STATUS_LABEL[video.status])}
                            </Badge>
                          )}
                        </motion.div>
                      </AnimatePresence>
                      {video.status === 'failed' && video.error_message && (
                        <p className="mt-1 max-w-xs text-xs text-danger">{video.error_message}</p>
                      )}
                      {video.yolo_model && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t(
                            `videos.yoloModel.${video.yolo_model}`,
                            YOLO_MODEL_LABEL[video.yolo_model as YoloModelKey] ?? video.yolo_model,
                          )}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(video.created_at).toLocaleString('es-ES')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {(video.status === 'uploaded' || video.status === 'failed') && canWrite(role) && (
                          <Button
                            size="sm"
                            variant="secondary"
                            isLoading={analyzingId === video.id}
                            onClick={() => {
                              setSelectedYoloModel((video.yolo_model as YoloModelKey) ?? 'nano');
                              setAnalyzeVideo(video);
                            }}
                          >
                            <Play className="size-4" aria-hidden="true" />
                            {video.status === 'failed' ? t('videos.actions.retry', 'Reintentar') : t('videos.actions.analyze', 'Analizar')}
                          </Button>
                        )}
                        {video.status === 'done' && (
                          <Button size="sm" variant="ghost" onClick={() => setSelectedVideoId(video.id)}>
                            {t('videos.actions.viewResult', 'Ver resultado')}
                          </Button>
                        )}
                        {canWrite(role) && (
                          <Button variant="ghost" size="icon" onClick={() => openRename(video)}>
                            <Pencil className="size-4" aria-hidden="true" />
                            <span className="sr-only">{t('videos.actions.editTitleSr', 'Editar título')}</span>
                          </Button>
                        )}
                        {canWrite(role) && (
                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" size="icon">
                                <Trash2 className="size-4" aria-hidden="true" />
                                <span className="sr-only">{t('videos.actions.deleteSr', 'Eliminar')}</span>
                              </Button>
                            }
                            title={t('videos.delete.title', '¿Eliminar "{{title}}"?', { title: video.title })}
                            description={t(
                              'videos.delete.description',
                              'Se borra el video, el análisis, los tracks y los archivos en Storage. No se puede deshacer.',
                            )}
                            confirmLabel={t('videos.delete.confirm', 'Eliminar')}
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
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Card>
          <CardHeader>
            <CardTitle>{t('videos.result.cardTitle', 'Resultado del análisis')}</CardTitle>
          </CardHeader>
          <div className="mb-4 max-w-sm">
            <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
              <SelectTrigger>
                <SelectValue placeholder={t('videos.result.selectPlaceholder', 'Selecciona un video procesado')} />
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

          {selectedVideoId && resultVideoUrl && (
            <div className="mb-5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('videos.result.annotatedVideoLabel', 'Video anotado')}
              </p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={resultVideoUrl} controls playsInline className="mx-auto max-h-[420px] w-full rounded-lg border border-border bg-panel" />
            </div>
          )}

          {selectedVideoId &&
            (Object.keys(trajectories).length > 0 ? (
              <div className="mb-5">
                <TacticalBoard
                  trajectories={trajectories}
                  tracks={tracks}
                  players={rosterPlayers}
                  canEdit={canWrite(role)}
                  isSaving={isAssigning}
                  onAssign={handleAssignTracks}
                />
              </div>
            ) : (
              <EmptyState
                title={t('videos.result.emptyPositionsTitle', 'Sin datos de posición')}
                description={t(
                  'videos.result.emptyPositionsDescription',
                  'No se detectaron suficientes posiciones para dibujar el tablero táctico.',
                )}
              />
            ))}

          {selectedVideoId && tracks.length === 0 && (
            <EmptyState
              title={t('videos.result.emptyTracksTitle', 'Sin tracks')}
              description={t('videos.result.emptyTracksDescription', 'Ese video no tiene tracks registrados.')}
            />
          )}
          {tracks.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('videos.result.columns.track', 'Track')}</TableHead>
                  <TableHead>{t('videos.result.columns.player', 'Jugador')}</TableHead>
                  <TableHead>{t('videos.result.columns.distance', 'Distancia (m)')}</TableHead>
                  <TableHead>{t('videos.result.columns.timeVisible', 'Tiempo visible (s)')}</TableHead>
                  <TableHead>{t('videos.result.columns.avgSpeed', 'Vel. media (km/h)')}</TableHead>
                  <TableHead>{t('videos.result.columns.maxSpeed', 'Vel. p95 (km/h)')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracksPager.paged.map((track) => (
                  <TableRow key={track.track_id}>
                    <TableCell className="font-medium">J{track.track_id}</TableCell>
                    <TableCell>
                      {track.matched_player_id ? (
                        <Badge variant="success">
                          {rosterNameById.get(track.matched_player_id) ?? t('videos.result.defaultPlayerBadge', 'Jugador')}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
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
        </motion.div>
      )}

      <Dialog open={editingVideo !== null} onOpenChange={(open) => !open && setEditingVideo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('videos.editDialog.title', 'Editar video')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label={t('videos.fields.title', 'Título')} htmlFor="edit-video-title">
              <Input
                id="edit-video-title"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleRenameVideo()}
              />
            </Field>
            <Field label={t('videos.fields.matchDate', 'Fecha del partido (opcional)')} htmlFor="edit-video-match-date">
              <Input
                id="edit-video-match-date"
                type="date"
                value={editMatchDate}
                onChange={(event) => setEditMatchDate(event.target.value)}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              {t(
                'videos.editDialog.matchDateHint',
                'Se usa para cruzar las métricas de este video con el historial GPS del jugador en su ficha.',
              )}
            </p>
          </div>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={() => setEditingVideo(null)}>
              {t('videos.editDialog.cancel', 'Cancelar')}
            </Button>
            <Button size="sm" isLoading={isSavingTitle} disabled={!editTitle.trim()} onClick={handleRenameVideo}>
              {t('videos.editDialog.save', 'Guardar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={analyzeVideo !== null} onOpenChange={(open) => !open && setAnalyzeVideo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('videos.analyzeDialog.title', 'Elegí el modelo de detección')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label={t('videos.analyzeDialog.modelLabel', 'Modelo')} htmlFor="analyze-yolo-model">
              <Select value={selectedYoloModel} onValueChange={(value) => setSelectedYoloModel(value as YoloModelKey)}>
                <SelectTrigger id="analyze-yolo-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nano">{t('videos.yoloModel.nano', 'Nano (rápido)')}</SelectItem>
                  <SelectItem value="small">{t('videos.yoloModel.small', 'Small (más preciso)')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <p className="text-xs text-muted-foreground">
              {t(
                'videos.analyzeDialog.hint',
                'Nano procesa más rápido y alcanza para video estándar bien encuadrado. Small detecta bastantes más jugadores y la pelota (probado: 4x más detecciones de jugador, 75x más de pelota) — conviene para tomas difíciles (cámara que panea, ángulo elevado, video vertical), a costa de ~30% más tiempo de proceso.',
              )}
            </p>
          </div>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={() => setAnalyzeVideo(null)}>
              {t('videos.analyzeDialog.cancel', 'Cancelar')}
            </Button>
            <Button
              size="sm"
              isLoading={analyzingId === analyzeVideo?.id}
              onClick={() => analyzeVideo && handleAnalyze(analyzeVideo, selectedYoloModel)}
            >
              <Play className="size-4" aria-hidden="true" /> {t('videos.analyzeDialog.confirm', 'Analizar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
