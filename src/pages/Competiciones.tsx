import { useTranslation } from 'react-i18next';

import Liga from './Liga';

export default function Competiciones({ orgId, role }: { orgId: string; role: string | null }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('competiciones.title', 'Competiciones')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'competiciones.subtitle',
            'Goleadores y roles ofensivos por liga y temporada. (Rediseño visual completo en Fase 7.)',
          )}
        </p>
      </div>
      <Liga orgId={orgId} role={role} />
    </div>
  );
}
