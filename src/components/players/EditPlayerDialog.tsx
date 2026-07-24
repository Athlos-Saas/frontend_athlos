import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
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
 */
export function EditPlayerDialog({
  player,
  onClose,
  onSave,
}: {
  player: Player | null;
  onClose: () => void;
  onSave: (updated: PlayerUpdate) => Promise<void>;
}) {
  const [form, setForm] = useState({ position: '', height_cm: '', weight_kg: '', birthdate: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (player) {
      setForm({
        position: player.position ?? '',
        height_cm: player.height_cm?.toString() ?? '',
        weight_kg: player.weight_kg?.toString() ?? '',
        birthdate: player.birthdate ?? '',
      });
    }
  }, [player]);

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

  return (
    <Dialog open={!!player} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {player?.full_name}</DialogTitle>
        </DialogHeader>
        <Field label="Posición" htmlFor="edit-position">
          <Input id="edit-position" value={form.position} onChange={(event) => setForm((f) => ({ ...f, position: event.target.value }))} />
        </Field>
        <Field label="Altura (cm)" htmlFor="edit-height">
          <Input
            id="edit-height"
            type="number"
            value={form.height_cm}
            onChange={(event) => setForm((f) => ({ ...f, height_cm: event.target.value }))}
          />
        </Field>
        <Field label="Peso (kg)" htmlFor="edit-weight">
          <Input
            id="edit-weight"
            type="number"
            value={form.weight_kg}
            onChange={(event) => setForm((f) => ({ ...f, weight_kg: event.target.value }))}
          />
        </Field>
        <Field label="Fecha de nacimiento" htmlFor="edit-birthdate">
          <Input
            id="edit-birthdate"
            type="date"
            value={form.birthdate}
            onChange={(event) => setForm((f) => ({ ...f, birthdate: event.target.value }))}
          />
        </Field>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" isLoading={isSaving} onClick={handleSave}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
