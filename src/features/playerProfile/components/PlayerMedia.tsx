import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Box, ImagePlus, Maximize2, RotateCw, UserRound, X, ZoomIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { ImageCropDialog } from '@/components/ui/ImageCropDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { toast } from '@/store/toastStore';
import { detectModel3DFormat, type Model3DExtension } from '../format';
import { usePlayerMediaUrl } from '../queries';
import type { Player3DViewerHandle } from './Player3DViewer';

/** three.js + drei pesan ~600kB — solo deben bajar si hay un modelo 3D para mostrar (subido o genérico). */
const Player3DViewer = lazy(() => import('./Player3DViewer'));

const MODEL_ACCEPT = '.glb,.gltf,.obj,.fbx';
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
 * > foto (`photoPath`, que el caller resuelve como `action_photo_url` con
 * respaldo a `photo_url` — ver PlayerProfile.tsx) > avatar genérico 3D (bajo
 * demanda, con rótulo explícito de que no es este jugador) > silueta.
 * "Cambiar foto de jugador" y "Subir modelo 3D" persisten de verdad ahora
 * que existe el bucket — antes de esto solo había vista previa en memoria.
 * Ojo: la foto que se sube desde acá (`onPhotoChange`) es deliberadamente
 * distinta de la foto de perfil/avatar que se edita desde "Editar jugador"
 * — este componente no sabe ni le importa cuál columna es, solo recibe
 * `photoPath`/`onPhotoChange` ya resueltos por el caller.
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
  const { t } = useTranslation();
  const noModelMessage = t(
    'playerMedia.noModelMessage',
    'Sube un modelo 3D primero (.glb, .gltf, .obj o .fbx). USDZ no se puede — es un formato propietario de Apple que no renderiza en el navegador.',
  );
  const photoUrlQuery = usePlayerMediaUrl(photoPath);
  const modelUrlQuery = usePlayerMediaUrl(modelPath);

  const [localModel, setLocalModel] = useState<ActiveModel | null>(null);
  const [showGeneric, setShowGeneric] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
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
      ? { kind: 'remote', url: modelUrlQuery.data, format: savedModelFormat, label: t('playerMedia.savedModel', 'Modelo 3D guardado') }
      : null;
  const genericModel: ActiveModel | null =
    !localModel && !remoteModel && showGeneric
      ? { kind: 'generic', url: GENERIC_AVATAR_URL, format: 'glb', label: t('playerMedia.genericAvatarLabel', 'Avatar genérico') }
      : null;
  const activeModel = localModel ?? remoteModel ?? genericModel;

  const clearOverride = () => {
    viewerRef.current = null;
    if (localModel) URL.revokeObjectURL(localModel.url);
    setLocalModel(null);
    setShowGeneric(false);
  };

  const handlePhotoSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file && onPhotoChange) setCropFile(file);
  };

  const handleCropConfirm = async (blob: Blob) => {
    setCropFile(null);
    if (!onPhotoChange) return;
    setIsSavingPhoto(true);
    try {
      await onPhotoChange(blob);
      toast({ title: t('playerMedia.photoUpdated', 'Foto actualizada'), variant: 'success' });
    } catch (error) {
      toast({
        title: t('playerMedia.photoSaveError', 'No se pudo guardar la foto'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'danger',
      });
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
        title: t('playerMedia.unsupportedFormatTitle', 'Formato no soportado'),
        description: t(
          'playerMedia.unsupportedFormatDescription',
          '"{{fileName}}" no es .glb/.gltf/.obj/.fbx. Si es .usdz: three.js no puede renderizarlo (formato propietario de Apple).',
          { fileName: file.name },
        ),
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
        title: t('playerMedia.localPreviewTitle', 'Vista previa local'),
        description: t(
          'playerMedia.localPreviewDescription',
          'Necesitas rol admin/coach/medical/analyst para guardar este modelo de forma permanente.',
        ),
        variant: 'warning',
      });
      return;
    }

    setIsSavingModel(true);
    try {
      await onModelUpload(file, format);
      toast({ title: t('playerMedia.modelSaved', 'Modelo 3D guardado'), variant: 'success' });
    } catch (error) {
      toast({
        title: t('playerMedia.modelSaveError', 'No se pudo guardar el modelo 3D'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'danger',
      });
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
        toast({
          title: t('playerMedia.fullscreenErrorTitle', 'No se pudo abrir pantalla completa'),
          description: t('playerMedia.fullscreenErrorDescription', 'Tu navegador bloqueó la solicitud.'),
          variant: 'danger',
        });
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
                aria-label={t('playerMedia.removePreview', 'Quitar vista previa')}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
            <span className="absolute bottom-2 left-2 rounded-full bg-card/90 px-2 py-0.5 text-[10px] text-muted-foreground shadow-subtle">
              {activeModel.kind === 'generic'
                ? t('playerMedia.genericAvatarBadge', 'Avatar genérico · no es este jugador')
                : activeModel.kind === 'local'
                  ? t('playerMedia.localPreviewBadge', 'Vista previa local · {{label}}', { label: activeModel.label })
                  : activeModel.label}
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
              {t('playerMedia.viewGenericAvatar', 'Ver avatar genérico en 3D')}
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
            label={t('playerMedia.changePhotoLabel', 'Cambiar foto de jugador')}
            disabled={!canEdit}
            tooltip={
              canEdit
                ? t(
                    'playerMedia.changePhotoTooltipEnabled',
                    'Se usa acá cuando no hay modelo 3D cargado — es distinta de la foto de perfil (avatar del encabezado, se edita desde "Editar jugador").',
                  )
                : t('playerMedia.changePhotoTooltipDisabled', 'Necesitas rol admin/coach/medical/analyst para cambiar la foto.')
            }
            isLoading={isSavingPhoto}
            onClick={() => photoInputRef.current?.click()}
          />
          <MediaActionButton
            icon={Box}
            label={t('playerMedia.uploadModelLabel', 'Subir modelo 3D')}
            tooltip={
              canEdit
                ? t('playerMedia.uploadModelTooltipEnabled', 'Sube un .glb/.gltf/.obj/.fbx — se guarda para este jugador.')
                : t(
                    'playerMedia.uploadModelTooltipDisabled',
                    'Puedes previsualizar un modelo, pero necesitas rol admin/coach/medical/analyst para guardarlo.',
                  )
            }
            isLoading={isSavingModel}
            onClick={() => modelInputRef.current?.click()}
          />
          <MediaActionButton
            icon={RotateCw}
            label={autoRotate ? t('playerMedia.stopRotation', 'Detener rotación') : t('playerMedia.rotate', 'Rotar')}
            disabled={!activeModel}
            tooltip={activeModel ? t('playerMedia.rotateTooltip', 'Activa/desactiva la rotación automática del modelo.') : noModelMessage}
            onClick={() => setAutoRotate((value) => !value)}
          />
          <MediaActionButton
            icon={ZoomIn}
            label={t('playerMedia.resetViewLabel', 'Encuadrar')}
            disabled={!activeModel}
            tooltip={activeModel ? t('playerMedia.resetViewTooltip', 'Vuelve a encuadrar el modelo en el centro.') : noModelMessage}
            onClick={() => viewerRef.current?.resetView()}
          />
        </div>
        <MediaActionButton
          icon={Maximize2}
          label={t('playerMedia.fullscreenLabel', 'Pantalla completa')}
          disabled={!activeModel && !hasPhoto}
          tooltip={
            activeModel || hasPhoto
              ? t('playerMedia.fullscreenTooltipEnabled', 'Abre esta vista en pantalla completa.')
              : t('playerMedia.fullscreenTooltipDisabled', 'Sube una foto o un modelo 3D primero.')
          }
          onClick={handleFullscreen}
          fullWidth
        />
      </TooltipProvider>

      <ImageCropDialog file={cropFile} onCancel={() => setCropFile(null)} onConfirm={handleCropConfirm} />
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
