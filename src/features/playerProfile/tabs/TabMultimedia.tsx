import { Film, UserRound } from 'lucide-react';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { usePagedRows } from '@/hooks/usePagedRows';
import { formatDate, formatNumber } from '../format';
import { usePlayerMediaUrl, usePlayerVideoTracks } from '../queries';

export default function TabMultimedia({ orgId, playerId, photoPath }: { orgId: string; playerId: string; photoPath?: string | null }) {
  const { data, isLoading } = usePlayerVideoTracks(orgId, playerId);
  const photoUrl = usePlayerMediaUrl(photoPath);

  const tracks = data ?? [];
  const tracksPager = usePagedRows(tracks, 10);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Foto</CardTitle>
        </CardHeader>
        {photoUrl.data ? (
          <img src={photoUrl.data} alt="Foto del jugador" className="h-48 w-48 rounded-xl object-cover" />
        ) : (
          <div className="flex h-48 w-48 items-center justify-center rounded-xl bg-border/40">
            <UserRound className="h-16 w-16 text-muted-foreground" />
          </div>
        )}
      </Card>

      {tracks.length === 0 ? (
        <EmptyState
          icon={Film}
          title="Sin video/tracking"
          description="Este jugador no está vinculado (matched_player_id) a ningún tracking de video analizado todavía."
        />
      ) : (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Tracking de video</CardTitle>
              <CardDescription className="mt-1">{tracks.length} registros</CardDescription>
            </div>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Video</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Distancia (m)</TableHead>
                <TableHead className="text-right">Vel. media (km/h)</TableHead>
                <TableHead className="text-right">Vel. máxima (km/h)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tracksPager.paged.map((track) => (
                <TableRow key={track.id}>
                  <TableCell className="font-medium text-foreground">{track.video_title ?? '--'}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(track.match_date)}</TableCell>
                  <TableCell className="text-right">{formatNumber(track.distance_m)}</TableCell>
                  <TableCell className="text-right">{formatNumber(track.avg_speed_kmh)}</TableCell>
                  <TableCell className="text-right">{formatNumber(track.max_speed_kmh)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={tracksPager.page} pageCount={tracksPager.pageCount} onPageChange={tracksPager.setPage} className="mt-4" />
        </Card>
      )}
    </div>
  );
}
