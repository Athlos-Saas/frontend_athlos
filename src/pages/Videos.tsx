import { useEffect, useState } from 'react';
import { Film, Upload } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableSkeletonRows } from '@/components/ui/Table';
import { supabase } from '@/lib/supabase';
import { toast } from '@/store/toastStore';
import type { VideoAnalysis, VideoPlayerTrack } from '@/types/domain';

const STATUS_BADGE: Record<VideoAnalysis['status'], 'ai' | 'warning' | 'success' | 'danger'> = {
  uploaded: 'ai',
  processing: 'warning',
  done: 'success',
  failed: 'danger',
};

export default function Videos({ orgId }: { orgId: string }) {
  const [videos, setVideos] = useState<VideoAnalysis[] | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState('Partido sin título');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [tracks, setTracks] = useState<VideoPlayerTrack[]>([]);

  const loadVideos = () => {
    supabase
      .from('video_analyses')
      .select('id, title, status, created_at')
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

  useEffect(() => {
    if (!selectedVideoId) {
      setTracks([]);
      return;
    }
    supabase
      .from('video_player_tracks')
      .select('track_id, distance_m, time_visible_s, avg_speed_kmh, max_speed_kmh')
      .eq('video_id', selectedVideoId)
      .order('distance_m', { ascending: false })
      .then(({ data }) => setTracks(data ?? []));
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
      toast({
        title: 'Video registrado',
        description: 'El worker del backend lo procesará (POST /v1/videos/{id}/process).',
        variant: 'success',
      });
    }
    setSelectedFile(null);
    setIsUploading(false);
    loadVideos();
  };

  const doneVideos = (videos ?? []).filter((video) => video.status === 'done');

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {videos === null ? (
                <TableSkeletonRows columns={3} />
              ) : (
                videos.map((video) => (
                  <TableRow key={video.id}>
                    <TableCell className="font-medium">{video.title}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[video.status]}>{video.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(video.created_at).toLocaleString('es-ES')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {doneVideos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tracks por jugador</CardTitle>
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
                {tracks.map((track) => (
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
        </Card>
      )}
    </div>
  );
}
