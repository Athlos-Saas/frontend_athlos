import { useTranslation } from 'react-i18next';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { calculateAge, calculateBmi, formatDate } from '../format';
import type { PlayerCore } from '../queries';

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value === null || value === undefined || value === '' ? '--' : value}</span>
    </div>
  );
}

/**
 * Todos los campos salen de `players` o se calculan de ahí (edad, BMI). Los
 * que el pedido menciona pero no existen en el esquema (nacionalidad, pie
 * dominante, posiciones secundarias, contrato, valor, agente, notas
 * genéricas) se muestran fijos en "--" — ver la tabla de gaps del plan.
 */
export function PersonalInfoCard({ player }: { player: PlayerCore }) {
  const { t } = useTranslation();
  const age = calculateAge(player.birthdate);
  const bmi = calculateBmi(player.height_cm, player.weight_kg);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('personalInfoCard.title', 'Información personal')}</CardTitle>
      </CardHeader>
      <div>
        <InfoRow label={t('personalInfoCard.fullName', 'Nombre completo')} value={player.full_name} />
        <InfoRow label={t('personalInfoCard.birthdate', 'Fecha de nacimiento')} value={formatDate(player.birthdate)} />
        <InfoRow
          label={t('personalInfoCard.age', 'Edad')}
          value={age !== null ? t('personalInfoCard.ageValue', '{{age}} años', { age }) : null}
        />
        <InfoRow
          label={t('personalInfoCard.height', 'Altura')}
          value={player.height_cm ? t('personalInfoCard.heightValue', '{{value}} cm', { value: player.height_cm }) : null}
        />
        <InfoRow
          label={t('personalInfoCard.weight', 'Peso')}
          value={player.weight_kg ? t('personalInfoCard.weightValue', '{{value}} kg', { value: player.weight_kg }) : null}
        />
        <InfoRow label={t('personalInfoCard.bmi', 'BMI')} value={bmi} />
        <InfoRow label={t('personalInfoCard.nationality', 'Nacionalidad')} value={null} />
        <InfoRow label={t('personalInfoCard.dominantFoot', 'Pie dominante')} value={null} />
        <InfoRow label={t('personalInfoCard.mainPosition', 'Posición principal')} value={player.position} />
        <InfoRow label={t('personalInfoCard.secondaryPositions', 'Posiciones secundarias')} value={null} />
        <InfoRow label={t('personalInfoCard.contract', 'Contrato')} value={null} />
        <InfoRow label={t('personalInfoCard.estimatedValue', 'Valor estimado')} value={null} />
        <InfoRow label={t('personalInfoCard.agent', 'Agente')} value={null} />
        <InfoRow label={t('personalInfoCard.notes', 'Notas')} value={null} />
      </div>
    </Card>
  );
}
