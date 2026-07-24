import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import CargasGps from './CargasGps';
import Videos from './Videos';

export default function Analisis({ orgId, role }: { orgId: string; role: string | null }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Análisis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cargas GPS y video análisis en un mismo lugar. (Rediseño visual completo en Fase 7 — el
          contenido interno de estas pestañas aún usa los estilos anteriores.)
        </p>
      </div>
      <Tabs defaultValue="gps">
        <TabsList>
          <TabsTrigger value="gps">Cargas GPS</TabsTrigger>
          <TabsTrigger value="video">Video análisis</TabsTrigger>
        </TabsList>
        <TabsContent value="gps">
          <CargasGps orgId={orgId} role={role} />
        </TabsContent>
        <TabsContent value="video">
          <Videos orgId={orgId} role={role} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
