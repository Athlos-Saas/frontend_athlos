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
  const age = calculateAge(player.birthdate);
  const bmi = calculateBmi(player.height_cm, player.weight_kg);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información personal</CardTitle>
      </CardHeader>
      <div>
        <InfoRow label="Nombre completo" value={player.full_name} />
        <InfoRow label="Fecha de nacimiento" value={formatDate(player.birthdate)} />
        <InfoRow label="Edad" value={age !== null ? `${age} años` : null} />
        <InfoRow label="Altura" value={player.height_cm ? `${player.height_cm} cm` : null} />
        <InfoRow label="Peso" value={player.weight_kg ? `${player.weight_kg} kg` : null} />
        <InfoRow label="BMI" value={bmi} />
        <InfoRow label="Nacionalidad" value={null} />
        <InfoRow label="Pie dominante" value={null} />
        <InfoRow label="Posición principal" value={player.position} />
        <InfoRow label="Posiciones secundarias" value={null} />
        <InfoRow label="Contrato" value={null} />
        <InfoRow label="Valor estimado" value={null} />
        <InfoRow label="Agente" value={null} />
        <InfoRow label="Notas" value={null} />
      </div>
    </Card>
  );
}
