import { useTranslation } from 'react-i18next';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import CargasGps from './CargasGps';
import RiesgoLesion from './RiesgoLesion';
import Videos from './Videos';

export default function Analisis({ orgId, role }: { orgId: string; role: string | null }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t('analisis.title', 'Análisis')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'analisis.subtitle',
            'Cargas GPS y video análisis en un mismo lugar. (Rediseño visual completo en Fase 7 — el contenido interno de estas pestañas aún usa los estilos anteriores.)'
          )}
        </p>
      </div>
      <Tabs defaultValue="gps">
        <TabsList>
          <TabsTrigger value="gps">{t('analisis.tabs.gps', 'Cargas GPS')}</TabsTrigger>
          <TabsTrigger value="video">{t('analisis.tabs.video', 'Video análisis')}</TabsTrigger>
          <TabsTrigger value="riesgo">{t('analisis.tabs.riesgo', 'Riesgo de lesión')}</TabsTrigger>
        </TabsList>
        <TabsContent value="gps">
          <CargasGps orgId={orgId} role={role} />
        </TabsContent>
        <TabsContent value="video">
          <Videos orgId={orgId} role={role} />
        </TabsContent>
        <TabsContent value="riesgo">
          <RiesgoLesion orgId={orgId} role={role} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
