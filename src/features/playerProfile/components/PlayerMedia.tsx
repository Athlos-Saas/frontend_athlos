import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Box, ImagePlus, Maximize2, RotateCw, UserRound, X, ZoomIn } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { toast } from '@/store/toastStore';
import { detectModel3DFormat, resizeImageToBlob, type Model3DExtension } from '../format';
import { usePlayerMediaUrl } from '../queries';
import type { Player3DViewerHandle } from './Player3DViewer';

/** three.js + drei pesan ~600kB — solo deben bajar si hay un modelo 3D para mostrar (subido o genérico). */
const Player3DViewer = lazy(() => import('./Player3DViewer'));

const MODEL_ACCEPT = '.glb,.gltf,.obj,.fbx';
const NO_MODEL_MESSAGE = 'Sube un modelo 3D primero (.glb, .gltf, .obj o .fbx). USDZ no se puede — es un formato propietario de Apple que no renderiza en el navegador.';
const GENERIC_AVATAR_URL = '/models/default-avatar.glb';

interface ActiveModel {
  kind: 'local' | 'remote' | 'generic';
  url: string;
  format: Model3DExtension;
  label: string;
}

/**
 * Prioridad de lo que se muestra: modelo local recién elegido > modelo 3D
 * guardado del jugador (`players.model_3d_url`, bucket privado `player-media`)
 * > foto (`players.photo_url`, mismo bucket) > avatar genérico 3D (bajo
 * demanda, con rótulo explícito de que no es este jugador) > silueta.
 * "Cambiar imagen" y "Subir modelo 3D" persisten de verdad ahora que existe
 * el bucket — antes de esto solo había vista previa en memoria.
 */
export function PlayerMedia({
  photoPath,
  modelPath,
  playerName,
  canEdit = false,
  onPhotoChange,
  onModelUpload,
}: {
  photoPath?: string | null;
  modelPath?: string | null;
  playerName: string;
  canEdit?: boolean;
  onPhotoChange?: (blob: Blob) => Promise<void>;
  onModelUpload?: (file: File, format: Model3DExtension) => Promise<void>;
}) {
  const photoUrlQuery = usePlayerMediaUrl(photoPath);
  const modelUrlQuery = usePlayerMediaUrl(modelPath);

  const [localModel, setLocalModel] = useState<ActiveModel | null>(null);
  const [showGeneric, setShowGeneric] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [isSavingModel, setIsSavingModel] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<Player3DViewerHandle | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleViewerReady = useCallback((handle: Player3DViewerHandle) => {
    viewerRef.current = handle;
  }, []);

  useEffect(() => {
    return () => {
      if (localModel) URL.revokeObjectURL(localModel.url);
    };
  }, [localModel]);

  const savedModelFormat = modelPath ? detectModel3DFormat(modelPath) : null;
  const remoteModel: ActiveModel | null =
    !localModel && modelUrlQuery.data && savedModelFormat
      ? { kind: 'remote', url: modelUrlQuery.data, format: savedModelFormat, label: 'Modelo 3D guardado' }
      : null;
  const genericModel: ActiveModel | null =
    !localModel && !remoteModel && showGeneric ? { kind: 'generic', url: GENERIC_AVATAR_URL, format: 'glb', label: 'Avatar genérico' } : null;
  const activeModel = localModel ?? remoteModel ?? genericModel;

  const clearOverride = () => {
    viewerRef.current = null;
    if (localModel) URL.revokeObjectURL(localModel.url);
    setLocalModel(null);
    setShowGeneric(false);
  };

  const handlePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onPhotoChange) return;
    setIsSavingPhoto(true);
    try {
      const blob = await resizeImageToBlob(file);
      await onPhotoChange(blob);
      toast({ title: 'Foto actualizada', variant: 'success' });
    } catch (error) {
      toast({ title: 'No se pudo guardar la foto', description: error instanceof Error ? error.message : undefined, variant: 'danger' });
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const handleModelSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const format = detectModel3DFormat(file.name);
    if (!format) {
      toast({
        title: 'Formato no soportado',
        description: `"${file.name}" no es .glb/.gltf/.obj/.fbx. Si es .usdz: three.js no puede renderizarlo (formato propietario de Apple).`,
        variant: 'danger',
      });
      return;
    }

    setLocalModel((previous) => {
      if (previous) URL.revokeObjectURL(previous.url);
      return { kind: 'local', url: URL.createObjectURL(file), format, label: file.name };
    });
    setShowGeneric(false);
    setAutoRotate(false);

    if (!canEdit || !onModelUpload) {
      toast({
        title: 'Vista previa local',
        description: 'Necesitas rol admin/coach/medical/analyst para guardar este modelo de forma permanente.',
        variant: 'warning',
      });
      return;
    }

    setIsSavingModel(true);
    try {
      await onModelUpload(file, format);
      toast({ title: 'Modelo 3D guardado', variant: 'success' });
    } catch (error) {
      toast({ title: 'No se pudo guardar el modelo 3D', description: error instanceof Error ? error.message : undefined, variant: 'danger' });
    } finally {
      setIsSavingModel(false);
    }
  };

  const handleFullscreen = () => {
    const node = containerRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      node.requestFullscreen().catch(() => {
        toast({ title: 'No se pudo abrir pantalla completa', description: 'Tu navegador bloqueó la solicitud.', variant: 'danger' });
      });
    }
  };

  const hasPhoto = !activeModel && !!photoUrlQuery.data;

  return (
    <div className="flex flex-col gap-3">
      <div ref={containerRef} className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-panel">
        {activeModel ? (
          <>
            <Suspense fallback={<Skeleton className="size-full" />}>
              <Player3DViewer url={activeModel.url} format={activeModel.format} autoRotate={autoRotate} onReady={handleViewerReady} />
            </Suspense>
            {activeModel.kind !== 'remote' && (
              <button
                type="button"
                onClick={clearOverride}
                className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-card/90 text-muted-foreground shadow-subtle hover:text-foreground"
                aria-label="Quitar vista previa"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
            <span className="absolute bottom-2 left-2 rounded-full bg-card/90 px-2 py-0.5 text-[10px] text-muted-foreground shadow-subtle">
              {activeModel.kind === 'generic' ? 'Avatar genérico · no es este jugador' : activeModel.kind === 'local' ? `Vista previa local · ${activeModel.label}` : activeModel.label}
            </span>
          </>
        ) : photoPath && photoUrlQuery.isLoading ? (
          <Skeleton className="size-full" />
        ) : hasPhoto ? (
          <img src={photoUrlQuery.data ?? undefined} alt={playerName} className="size-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <UserRound className="size-24 text-muted-foreground" aria-hidden="true" />
            <button type="button" onClick={() => setShowGeneric(true)} className="text-xs text-ai hover:underline">
              Ver avatar genérico en 3D
            </button>
          </div>
        )}
      </div>

      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelected} />
      <input ref={modelInputRef} type="file" accept={MODEL_ACCEPT} className="hidden" onChange={handleModelSelected} />

      <TooltipProvider>
        <div className="grid grid-cols-2 gap-2">
          <MediaActionButton
            icon={ImagePlus}
            label="Cambiar imagen"
            disabled={!canEdit}
            tooltip={canEdit ? 'Sube una foto — se guarda en Storage y en el perfil del jugador.' : 'Necesitas rol admin/coach/medical/analyst para cambiar la foto.'}
            isLoading={isSavingPhoto}
            onClick={() => photoInputRef.current?.click()}
          />
          <MediaActionButton
            icon={Box}
            label="Subir modelo 3D"
            tooltip={
              canEdit
                ? 'Sube un .glb/.gltf/.obj/.fbx — se guarda para este jugador.'
                : 'Puedes previsualizar un modelo, pero necesitas rol admin/coach/medical/analyst para guardarlo.'
            }
            isLoading={isSavingModel}
            onClick={() => modelInputRef.current?.click()}
          />
          <MediaActionButton
            icon={RotateCw}
            label={autoRotate ? 'Detener rotación' : 'Rotar'}
            disabled={!activeModel}
            tooltip={activeModel ? 'Activa/desactiva la rotación automática del modelo.' : NO_MODEL_MESSAGE}
            onClick={() => setAutoRotate((value) => !value)}
          />
          <MediaActionButton
            icon={ZoomIn}
            label="Encuadrar"
            disabled={!activeModel}
            tooltip={activeModel ? 'Vuelve a encuadrar el modelo en el centro.' : NO_MODEL_MESSAGE}
            onClick={() => viewerRef.current?.resetView()}
          />
        </div>
        <MediaActionButton
          icon={Maximize2}
          label="Pantalla completa"
          disabled={!activeModel && !hasPhoto}
          tooltip={activeModel || hasPhoto ? 'Abre esta vista en pantalla completa.' : 'Sube una foto o un modelo 3D primero.'}
          onClick={handleFullscreen}
          fullWidth
        />
      </TooltipProvider>
    </div>
  );
}

function MediaActionButton({
  icon: Icon,
  label,
  tooltip,
  fullWidth,
  disabled,
  isLoading,
  onClick,
}: {
  icon: typeof ImagePlus;
  label: string;
  tooltip: string;
  fullWidth?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={fullWidth ? 'block' : undefined}>
          <Button variant="secondary" size="sm" disabled={disabled} isLoading={isLoading} onClick={onClick} className="w-full">
            <Icon className="size-4" aria-hidden="true" /> {label}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
