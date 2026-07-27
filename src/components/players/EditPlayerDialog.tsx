import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, ShieldCheck, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { resizeImageToBlob } from '@/features/playerProfile/format';
import { usePlayerMediaUrl } from '@/features/playerProfile/queries';
import { toast } from '@/store/toastStore';
import type { Player } from '@/types/domain';

export interface PlayerUpdate {
  position: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  birthdate: string | null;
}

/**
 * Diálogo de edición de datos físicos de un jugador. Compartido entre
 * Roster.tsx (lista) y la ficha de jugador (/atletas/:playerId).
 * `onPhotoChange` es opcional: si no se pasa, la sección de foto no se
 * muestra (mismo criterio que el resto del componente — nunca ofrecer una
 * acción que no puede completarse de verdad).
 */
export function EditPlayerDialog({
  player,
  onClose,
  onSave,
  onPhotoChange,
}: {
  player: Player | null;
  onClose: () => void;
  onSave: (updated: PlayerUpdate) => Promise<void>;
  onPhotoChange?: (blob: Blob) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ position: '', height_cm: '', weight_kg: '', birthdate: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const currentPhoto = usePlayerMediaUrl(player?.photo_url);

  useEffect(() => {
    if (player) {
      setForm({
        position: player.position ?? '',
        height_cm: player.height_cm?.toString() ?? '',
        weight_kg: player.weight_kg?.toString() ?? '',
        birthdate: player.birthdate ?? '',
      });
    }
    setPendingPhoto((previous) => {
      if (previous) URL.revokeObjectURL(previous.previewUrl);
      return null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave({
      position: form.position || null,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      birthdate: form.birthdate || null,
    });
    setIsSaving(false);
  };

  const handlePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const blob = await resizeImageToBlob(file);
      setPendingPhoto((previous) => {
        if (previous) URL.revokeObjectURL(previous.previewUrl);
        return { blob, previewUrl: URL.createObjectURL(blob) };
      });
    } catch (error) {
      toast({
        title: t('editPlayerDialog.toast.photoProcessError', 'No se pudo procesar la imagen'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'danger',
      });
    }
  };

  const cancelPendingPhoto = () => {
    setPendingPhoto((previous) => {
      if (previous) URL.revokeObjectURL(previous.previewUrl);
      return null;
    });
  };

  const confirmPendingPhoto = async () => {
    if (!pendingPhoto || !onPhotoChange) return;
    setIsSavingPhoto(true);
    try {
      await onPhotoChange(pendingPhoto.blob);
      toast({ title: t('editPlayerDialog.toast.photoUpdated', 'Foto actualizada'), variant: 'success' });
      cancelPendingPhoto();
    } catch (error) {
      toast({
        title: t('editPlayerDialog.toast.photoSaveError', 'No se pudo guardar la foto'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'danger',
      });
    } finally {
      setIsSavingPhoto(false);
    }
  };

  return (
    <Dialog
      open={!!player}
      onOpenChange={(open) => {
        if (!open) {
          cancelPendingPhoto();
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editPlayerDialog.title', 'Editar {{name}}', { name: player?.full_name })}</DialogTitle>
        </DialogHeader>

        {onPhotoChange && (
          <div className="mb-4 flex items-start gap-3 rounded-md border border-border bg-panel/60 p-3">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card">
              {pendingPhoto ? (
                <img
                  src={pendingPhoto.previewUrl}
                  alt={t('editPlayerDialog.photoPreviewAlt', 'Vista previa')}
                  className="size-full object-cover"
                />
              ) : player?.photo_url && currentPhoto.isLoading ? (
                <Skeleton className="size-full" />
              ) : currentPhoto.data ? (
                <img src={currentPhoto.data} alt={player?.full_name} className="size-full object-cover" />
              ) : (
                <UserRound className="size-7 text-muted-foreground" aria-hidden="true" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelected} />

              {pendingPhoto ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    {player?.photo_url
                      ? t('editPlayerDialog.photo.replaceNotice', 'Vas a reemplazar la foto actual.')
                      : t('editPlayerDialog.photo.saveNotice', 'Vas a guardar esta foto.')}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" isLoading={isSavingPhoto} onClick={confirmPendingPhoto}>
                      {t('editPlayerDialog.photo.confirm', 'Confirmar')}
                    </Button>
                    <Button size="sm" variant="secondary" disabled={isSavingPhoto} onClick={cancelPendingPhoto}>
                      {t('editPlayerDialog.photo.cancel', 'Cancelar')}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Button size="sm" variant="secondary" onClick={() => photoInputRef.current?.click()}>
                    <Camera className="size-4" aria-hidden="true" /> {t('editPlayerDialog.photo.change', 'Cambiar foto')}
                  </Button>
                  <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                    {t(
                      'editPlayerDialog.photo.privacyNote',
                      'Se guarda en el almacenamiento privado de tu organización (se comprime automáticamente) — solo el staff con acceso puede verla.',
                    )}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        <Field label={t('editPlayerDialog.field.position', 'Posición')} htmlFor="edit-position">
          <Input id="edit-position" value={form.position} onChange={(event) => setForm((f) => ({ ...f, position: event.target.value }))} />
        </Field>
        <Field label={t('editPlayerDialog.field.height', 'Altura (cm)')} htmlFor="edit-height">
          <Input
            id="edit-height"
            type="number"
            value={form.height_cm}
            onChange={(event) => setForm((f) => ({ ...f, height_cm: event.target.value }))}
          />
        </Field>
        <Field label={t('editPlayerDialog.field.weight', 'Peso (kg)')} htmlFor="edit-weight">
          <Input
            id="edit-weight"
            type="number"
            value={form.weight_kg}
            onChange={(event) => setForm((f) => ({ ...f, weight_kg: event.target.value }))}
          />
        </Field>
        <Field label={t('editPlayerDialog.field.birthdate', 'Fecha de nacimiento')} htmlFor="edit-birthdate">
          <Input
            id="edit-birthdate"
            type="date"
            value={form.birthdate}
            onChange={(event) => setForm((f) => ({ ...f, birthdate: event.target.value }))}
          />
        </Field>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('editPlayerDialog.cancel', 'Cancelar')}
          </Button>
          <Button size="sm" isLoading={isSaving} onClick={handleSave}>
            {t('editPlayerDialog.save', 'Guardar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
