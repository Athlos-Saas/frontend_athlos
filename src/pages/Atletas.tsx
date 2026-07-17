import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import PerfilesMl from './PerfilesMl';
import Wellness from './Wellness';

export default function Atletas({ orgId }: { orgId: string }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Atletas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Perfiles físicos (clustering) y wellness diario por jugador. (Rediseño visual completo en
          Fase 7 — el contenido interno de estas pestañas aún usa los estilos anteriores.)
        </p>
      </div>
      <Tabs defaultValue="perfiles">
        <TabsList>
          <TabsTrigger value="perfiles">Perfiles físicos</TabsTrigger>
          <TabsTrigger value="wellness">Wellness diario</TabsTrigger>
        </TabsList>
        <TabsContent value="perfiles">
          <PerfilesMl orgId={orgId} />
        </TabsContent>
        <TabsContent value="wellness">
          <Wellness orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
