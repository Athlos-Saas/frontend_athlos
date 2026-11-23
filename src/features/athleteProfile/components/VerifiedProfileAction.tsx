import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeCheck } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { canManageVerifiedProfile } from '../constants';
import { VerifiedProfileDialog } from './VerifiedProfileDialog';

/**
 * Botón + diálogo "Perfil verificado" para la cabecera de la ficha del
 * jugador. Autocontenido para que PlayerProfile.tsx (que tocan otros módulos)
 * solo necesite una línea. No renderiza nada para roles sin gestión.
 */
export function VerifiedProfileAction({
  orgId,
  role,
  playerId,
  playerName,
}: {
  orgId: string;
  role: string | null;
  playerId: string;
  playerName: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!canManageVerifiedProfile(role)) return null;
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <BadgeCheck className="size-4" aria-hidden="true" /> {t('verifiedProfile.manage.openButton', 'Perfil verificado')}
      </Button>
      <VerifiedProfileDialog orgId={orgId} playerId={playerId} playerName={playerName} open={open} onOpenChange={setOpen} />
    </>
  );
}
