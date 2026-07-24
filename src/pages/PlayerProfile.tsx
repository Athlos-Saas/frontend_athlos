import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, MoreVertical, Pencil, Share2, UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { EditPlayerDialog, type PlayerUpdate } from '@/components/players/EditPlayerDialog';
import { supabase } from '@/lib/supabase';
import { toast } from '@/store/toastStore';
import { canWrite } from '@/utils/permissions';
import { PersonalInfoCard } from '@/features/playerProfile/components/PersonalInfoCard';
import { PlayerMedia } from '@/features/playerProfile/components/PlayerMedia';
import { StatusBadge } from '@/features/playerProfile/components/StatusBadge';
import { calculateAge, formatDateTime, type Model3DExtension } from '@/features/playerProfile/format';
import { deriveStatus } from '@/features/playerProfile/insights';
import { uploadPlayerModel, uploadPlayerPhoto } from '@/features/playerProfile/mediaStorage';
import { usePlayerCore, usePlayerInjuries, usePlayerMediaUrl } from '@/features/playerProfile/queries';

const TabResumen = lazy(() => import('@/features/playerProfile/tabs/TabResumen'));
const TabEstadisticas = lazy(() => import('@/features/playerProfile/tabs/TabEstadisticas'));
const TabRendimiento = lazy(() => import('@/features/playerProfile/tabs/TabRendimiento'));
const TabHistorial = lazy(() => import('@/features/playerProfile/tabs/TabHistorial'));
const TabSalud = lazy(() => import('@/features/playerProfile/tabs/TabSalud'));
const TabScouting = lazy(() => import('@/features/playerProfile/tabs/TabScouting'));
const TabDocumentos = lazy(() => import('@/features/playerProfile/tabs/TabDocumentos'));
const TabMultimedia = lazy(() => import('@/features/playerProfile/tabs/TabMultimedia'));

const TAB_FALLBACK = <Skeleton className="h-64 w-full" />;

const NOT_IMPLEMENTED_MESSAGE = 'No implementado todavía: no hay librería de exportación/compartición instalada en el proyecto.';

export default function PlayerProfile({ orgId, role }: { orgId: string; role: string | null }) {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const core = usePlayerCore(orgId, playerId ?? '');
  const injuries = usePlayerInjuries(orgId, playerId ?? '');
  const headerPhoto = usePlayerMediaUrl(core.data?.photo_url);

  const status = useMemo(() => deriveStatus(injuries.data ?? []), [injuries.data]);
  const age = calculateAge(core.data?.birthdate);

  const handleSave = async (updated: PlayerUpdate) => {
    if (!core.data) return;
    const { error } = await supabase.from('players').update(updated).eq('id', core.data.id);
    if (error) {
      toast({ title: 'No se pudo guardar el jugador', description: error.message, variant: 'danger' });
      return;
    }
    toast({ title: 'Jugador actualizado', variant: 'success' });
    setIsEditing(false);
    core.refetch();
  };

  const handlePhotoChange = async (blob: Blob) => {
    if (!core.data) return;
    const path = await uploadPlayerPhoto(orgId, core.data.id, blob);
    const { error } = await supabase.from('players').update({ photo_url: path }).eq('id', core.data.id);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['playerProfile', 'mediaUrl', path] });
    core.refetch();
  };

  const handleModelUpload = async (file: File, format: Model3DExtension) => {
    if (!core.data) return;
    const path = await uploadPlayerModel(orgId, core.data.id, file, format);
    const { error } = await supabase.from('players').update({ model_3d_url: path }).eq('id', core.data.id);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['playerProfile', 'mediaUrl', path] });
    core.refetch();
  };

  if (!playerId) return <ErrorState title="Jugador no especificado" />;

  return (
    <div className="space-y-6 pb-10">
      <Button variant="ghost" size="sm" onClick={() => navigate('/atletas')}>
        <ArrowLeft className="size-4" aria-hidden="true" /> Volver al roster
      </Button>

      {core.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : core.isError ? (
        <ErrorState title="No se pudo cargar el jugador" onRetry={() => core.refetch()} />
      ) : !core.data ? (
        <ErrorState title="Jugador no encontrado" description="Puede que no exista o no pertenezca a tu organización." />
      ) : (
        <>
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-subtle sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-panel">
                {headerPhoto.data ? (
                  <img src={headerPhoto.data} alt={core.data.full_name} className="size-full object-cover" />
                ) : (
                  <UserRound className="size-8 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">{core.data.full_name}</h1>
                  <StatusBadge status={status} />
                  {!core.data.is_active && <Badge variant="neutral">Inactivo</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {core.data.position && <Badge variant="ai">{core.data.position}</Badge>}
                  <span>{core.data.team_name ?? 'Sin equipo asignado'}</span>
                  {core.data.team_season && <span>· {core.data.team_season}</span>}
                  {age !== null && <span>· {age} años</span>}
                  {core.data.height_cm && <span>· {core.data.height_cm} cm</span>}
                  {core.data.weight_kg && <span>· {core.data.weight_kg} kg</span>}
                </div>
                <p className="text-xs text-muted-foreground">Última actualización: {formatDateTime(core.data.updated_at)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canWrite(role) && (
                <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                  <Pencil className="size-4" aria-hidden="true" /> Editar jugador
                </Button>
              )}
              <TooltipProvider>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" aria-label="Más acciones">
                      <MoreVertical className="size-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <DropdownMenuItem disabled onSelect={(event) => event.preventDefault()}>
                            <Share2 className="size-4" aria-hidden="true" /> Compartir ficha
                          </DropdownMenuItem>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{NOT_IMPLEMENTED_MESSAGE}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <DropdownMenuItem disabled onSelect={(event) => event.preventDefault()}>
                            <Download className="size-4" aria-hidden="true" /> Exportar PDF
                          </DropdownMenuItem>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{NOT_IMPLEMENTED_MESSAGE}</TooltipContent>
                    </Tooltip>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipProvider>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
            <div className="space-y-6">
              <PlayerMedia
                photoPath={core.data.photo_url}
                modelPath={core.data.model_3d_url}
                playerName={core.data.full_name}
                canEdit={canWrite(role)}
                onPhotoChange={handlePhotoChange}
                onModelUpload={handleModelUpload}
              />
              <PersonalInfoCard player={core.data} />
            </div>

            <Tabs defaultValue="resumen">
              <TabsList className="flex flex-wrap">
                <TabsTrigger value="resumen">Resumen</TabsTrigger>
                <TabsTrigger value="estadisticas">Estadísticas</TabsTrigger>
                <TabsTrigger value="rendimiento">Rendimiento</TabsTrigger>
                <TabsTrigger value="historial">Historial</TabsTrigger>
                <TabsTrigger value="salud">Salud</TabsTrigger>
                <TabsTrigger value="scouting">Scouting</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
                <TabsTrigger value="multimedia">Multimedia</TabsTrigger>
              </TabsList>

              <TabsContent value="resumen">
                <Suspense fallback={TAB_FALLBACK}>
                  <TabResumen orgId={orgId} playerId={playerId} playerName={core.data.full_name} />
                </Suspense>
              </TabsContent>
              <TabsContent value="estadisticas">
                <Suspense fallback={TAB_FALLBACK}>
                  <TabEstadisticas orgId={orgId} playerId={playerId} />
                </Suspense>
              </TabsContent>
              <TabsContent value="rendimiento">
                <Suspense fallback={TAB_FALLBACK}>
                  <TabRendimiento orgId={orgId} playerId={playerId} />
                </Suspense>
              </TabsContent>
              <TabsContent value="historial">
                <Suspense fallback={TAB_FALLBACK}>
                  <TabHistorial orgId={orgId} playerId={playerId} />
                </Suspense>
              </TabsContent>
              <TabsContent value="salud">
                <Suspense fallback={TAB_FALLBACK}>
                  <TabSalud orgId={orgId} playerId={playerId} />
                </Suspense>
              </TabsContent>
              <TabsContent value="scouting">
                <Suspense fallback={TAB_FALLBACK}>
                  <TabScouting orgId={orgId} playerId={playerId} />
                </Suspense>
              </TabsContent>
              <TabsContent value="documentos">
                <Suspense fallback={TAB_FALLBACK}>
                  <TabDocumentos />
                </Suspense>
              </TabsContent>
              <TabsContent value="multimedia">
                <Suspense fallback={TAB_FALLBACK}>
                  <TabMultimedia orgId={orgId} playerId={playerId} photoPath={core.data.photo_url} />
                </Suspense>
              </TabsContent>
            </Tabs>
          </div>

          <EditPlayerDialog player={isEditing ? core.data : null} onClose={() => setIsEditing(false)} onSave={handleSave} />
        </>
      )}
    </div>
  );
}
