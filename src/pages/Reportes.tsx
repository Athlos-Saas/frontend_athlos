/**
 * Reportes — genera y consulta reportes PDF con marca ATHLOS.
 *
 * Generar (semanal del plantel, post-partido, rival) pasa por el backend
 * (POST /v1/reports, roles de escritura); el historial y la descarga leen
 * directo de Supabase con RLS (cualquier miembro de la org). Ningún PDF
 * incluye datos médicos individuales porque cualquier miembro, incluido
 * `viewer`, puede abrirlos (ver services/report_service.py en el backend).
 */
import { FileBarChart2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ReportGenerator } from '@/features/reports/ReportGenerator';
import { ReportHistory } from '@/features/reports/ReportHistory';

export default function Reportes({ orgId, role }: { orgId: string; role: string | null }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <FileBarChart2 className="size-6 text-ai" aria-hidden="true" />
          {t('reportsModule.title', 'Reportes')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'reportsModule.subtitle',
            'Reportes profesionales del plantel, de cada partido y de tus rivales, listos para compartir con el cuerpo técnico.',
          )}
        </p>
      </div>
      <ReportGenerator orgId={orgId} role={role} />
      <ReportHistory orgId={orgId} role={role} />
    </div>
  );
}
