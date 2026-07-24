import { EmptyState } from '@/components/ui/EmptyState';
import { colors } from '@/constants/tokens';
import type { Injury } from '@/types/domain';

interface Zone {
  key: string;
  label: string;
  keywords: string[];
  d: string;
}

// Figura humana simplificada (vista frontal), zonas amplias — no anatomía exacta.
const ZONES: Zone[] = [
  { key: 'head', label: 'Cabeza', keywords: ['head', 'cabeza', 'concus'], d: 'M50,4 a10,10 0 1,0 20,0 a10,10 0 1,0 -20,0' },
  { key: 'shoulder', label: 'Hombros', keywords: ['shoulder', 'hombro'], d: 'M30,26 h40 v8 h-40 z' },
  { key: 'arm', label: 'Brazos', keywords: ['arm', 'brazo', 'elbow', 'codo', 'wrist', 'muñeca'], d: 'M20,26 h8 v40 h-8 z M72,26 h8 v40 h-8 z' },
  { key: 'torso', label: 'Torso / espalda', keywords: ['torso', 'back', 'espalda', 'chest', 'pecho', 'rib'], d: 'M32,34 h36 v34 h-36 z' },
  { key: 'hip', label: 'Cadera / ingle', keywords: ['hip', 'cadera', 'groin', 'ingle', 'pelvis'], d: 'M32,68 h36 v10 h-36 z' },
  { key: 'thigh', label: 'Muslo', keywords: ['thigh', 'muslo', 'hamstring', 'isquio', 'quad'], d: 'M34,78 h14 v26 h-14 z M52,78 h14 v26 h-14 z' },
  { key: 'knee', label: 'Rodilla', keywords: ['knee', 'rodilla', 'acl', 'mcl', 'meniscus', 'menisco'], d: 'M34,104 h14 v8 h-14 z M52,104 h14 v8 h-14 z' },
  { key: 'ankle', label: 'Tobillo', keywords: ['ankle', 'tobillo'], d: 'M34,112 h14 v14 h-14 z M52,112 h14 v14 h-14 z' },
  { key: 'foot', label: 'Pie', keywords: ['foot', 'pie', 'metatarsal', 'toe'], d: 'M32,126 h18 v6 h-18 z M50,126 h18 v6 h-18 z' },
];

function matchZone(bodyArea: string): Zone | undefined {
  const text = bodyArea.toLowerCase();
  return ZONES.find((zone) => zone.keywords.some((keyword) => text.includes(keyword)));
}

/**
 * Preparada para futuro: hoy injuries.body_area casi siempre viene NULL (el
 * loader del roster no la captura todavía — ver gaps del plan). Si nunca hay
 * body_area con datos, esto muestra la silueta sin ninguna zona resaltada,
 * nunca inventa una lesión donde no la hay.
 */
export function BodyMap({ injuries }: { injuries: Injury[] }) {
  const withArea = injuries.filter((injury): injury is Injury & { body_area: string } => !!injury.body_area);
  const activeZoneKeys = new Set(
    withArea.filter((injury) => !injury.return_date).flatMap((injury) => matchZone(injury.body_area)?.key ?? []),
  );
  const historicalZoneKeys = new Set(
    withArea.filter((injury) => !!injury.return_date).flatMap((injury) => matchZone(injury.body_area)?.key ?? []),
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 100 136" className="h-64 w-auto">
        {ZONES.map((zone) => {
          const fill = activeZoneKeys.has(zone.key)
            ? colors.red
            : historicalZoneKeys.has(zone.key)
              ? colors.orange
              : colors.border;
          return <path key={zone.key} d={zone.d} fill={fill} fillOpacity={activeZoneKeys.has(zone.key) ? 0.85 : 0.5} />;
        })}
      </svg>
      {withArea.length === 0 ? (
        <EmptyState title="Sin información de zona corporal" description="Las lesiones registradas no tienen una zona del cuerpo capturada todavía." />
      ) : (
        <div className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: colors.red }} /> Lesión activa
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: colors.orange }} /> Historial
          </span>
        </div>
      )}
    </div>
  );
}
