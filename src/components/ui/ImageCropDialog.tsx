import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { ZoomIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { cn } from '@/utils/cn';

const VIEWPORT_SIZE = 288;
const OUTPUT_SIZE = 640;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export interface ImageCropDialogProps {
  file: File | null;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  quality?: number;
}

/**
 * Recorte manual antes de subir una foto — reemplaza el downscale
 * "contain" automático (que centraba la imagen entera sin control) por un
 * recorte real: el usuario arrastra y hace zoom para elegir qué parte de
 * la imagen queda dentro del cuadro (justo lo que después se ve en el
 * avatar). Sin librería externa — solo canvas + drag/zoom manual, el mismo
 * criterio que ya se usa en el resto del proyecto (React Three Fiber
 * acotado, sin dependencias nuevas si un componente propio alcanza).
 */
export function ImageCropDialog({ file, onCancel, onConfirm, quality = 0.85 }: ImageCropDialogProps) {
  const { t } = useTranslation();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!file) {
      setImageUrl(null);
      setNaturalSize(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = naturalSize ? VIEWPORT_SIZE / Math.min(naturalSize.width, naturalSize.height) : 1;

  const clampPan = (nextZoom: number, x: number, y: number) => {
    if (!naturalSize) return { x, y };
    const displayedWidth = naturalSize.width * baseScale * nextZoom;
    const displayedHeight = naturalSize.height * baseScale * nextZoom;
    return {
      x: clamp(x, VIEWPORT_SIZE - displayedWidth, 0),
      y: clamp(y, VIEWPORT_SIZE - displayedHeight, 0),
    };
  };

  const handleImageLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    const scale = VIEWPORT_SIZE / Math.min(width, height);
    const displayedWidth = width * scale;
    const displayedHeight = height * scale;
    setNaturalSize({ width, height });
    setZoom(1);
    setPan({ x: (VIEWPORT_SIZE - displayedWidth) / 2, y: (VIEWPORT_SIZE - displayedHeight) / 2 });
  };

  const handleZoomChange = (nextZoom: number) => {
    setZoom(nextZoom);
    setPan((current) => clampPan(nextZoom, current.x, current.y));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!naturalSize) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    dragStart.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;
    setPan(clampPan(zoom, dragStart.current.panX + dx, dragStart.current.panY + dy));
  };

  const handlePointerUp = () => {
    dragStart.current = null;
    setIsDragging(false);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!naturalSize) return;
    event.preventDefault();
    handleZoomChange(clamp(zoom - event.deltaY * 0.001, MIN_ZOOM, MAX_ZOOM));
  };

  const handleConfirm = () => {
    if (!imageUrl || !naturalSize) return;
    const scale = baseScale * zoom;
    const sourceX = -pan.x / scale;
    const sourceY = -pan.y / scale;
    const sourceSize = VIEWPORT_SIZE / scale;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      canvas.toBlob(
        (blob) => {
          if (blob) onConfirm(blob);
        },
        'image/jpeg',
        quality,
      );
    };
    img.src = imageUrl;
  };

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('imageCropDialog.title', 'Ajustar foto')}</DialogTitle>
        </DialogHeader>

        <p className="mb-3 text-xs text-muted-foreground">
          {t('imageCropDialog.hint', 'Arrastra para mover la imagen y usa el control de zoom para elegir qué parte se va a mostrar.')}
        </p>

        <div
          className="relative mx-auto touch-none overflow-hidden rounded-full border border-border bg-panel"
          style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE, cursor: isDragging ? 'grabbing' : 'grab' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheel}
        >
          {imageUrl && (
            <img
              ref={imgRef}
              src={imageUrl}
              alt=""
              draggable={false}
              onLoad={handleImageLoad}
              className={cn('pointer-events-none absolute left-0 top-0 select-none', !naturalSize && 'invisible')}
              style={
                naturalSize
                  ? {
                      width: naturalSize.width * baseScale * zoom,
                      height: naturalSize.height * baseScale * zoom,
                      transform: `translate(${pan.x}px, ${pan.y}px)`,
                    }
                  : undefined
              }
            />
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => handleZoomChange(Number(event.target.value))}
            className="w-full accent-ai"
            aria-label={t('imageCropDialog.zoomLabel', 'Zoom')}
            disabled={!naturalSize}
          />
        </div>

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {t('imageCropDialog.cancel', 'Cancelar')}
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!naturalSize}>
            {t('imageCropDialog.confirm', 'Usar esta foto')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
