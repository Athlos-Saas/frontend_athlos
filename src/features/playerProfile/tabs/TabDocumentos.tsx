import { FileText } from 'lucide-react';

import { EmptyState } from '@/components/ui/EmptyState';

/**
 * No existe tabla de documentos/archivos médicos por jugador en el esquema
 * (`reports` es por equipo, no por jugador) — no hay query que hacer aquí,
 * se muestra el gap explícitamente en vez de inventar contenido.
 */
export default function TabDocumentos() {
  return (
    <EmptyState
      icon={FileText}
      title="Documentos no disponibles todavía"
      description="No existe una tabla de documentos por jugador en la base de datos (contratos, informes médicos, PDFs). Para habilitar esta pestaña se necesitaría una tabla nueva (p. ej. player_documents) vinculada a players — no se agregó en esta pasada para no modificar el esquema existente."
    />
  );
}
