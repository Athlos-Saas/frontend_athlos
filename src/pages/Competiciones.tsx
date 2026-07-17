import Liga from './Liga';

export default function Competiciones({ orgId }: { orgId: string }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Competiciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Goleadores y roles ofensivos por liga y temporada. (Rediseño visual completo en Fase 7.)
        </p>
      </div>
      <Liga orgId={orgId} />
    </div>
  );
}
