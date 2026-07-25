import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ALL_ROLES, ROLE_BADGE, ROLE_LABEL } from '@/constants/roles';
import { listOrgUsers, type OrgUserRole } from '@/lib/backendApi';
import { cn } from '@/utils/cn';

interface RoleDefinition {
  role: OrgUserRole;
  descripcion: string;
  puedeEscribirDatos: boolean;
  puedeAdministrar: boolean;
  puedeEliminarProtegidas: boolean;
}

const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: 'admin',
    descripcion:
      'Acceso total. Único rol que puede gestionar Usuarios y editar la Organización en Configuración, y el único que puede eliminar filas protegidas (lesiones, sesiones GPS, videos, filas de stats de liga).',
    puedeEscribirDatos: true,
    puedeAdministrar: true,
    puedeEliminarProtegidas: true,
  },
  {
    role: 'coach',
    descripcion:
      'Puede crear y editar datos operativos (roster, wellness, videos, cargas GPS, stats de liga), pero no gestionar usuarios, no editar la Organización, y no puede eliminar las filas protegidas a admin.',
    puedeEscribirDatos: true,
    puedeAdministrar: false,
    puedeEliminarProtegidas: false,
  },
  {
    role: 'medical',
    descripcion: 'Mismos permisos que coach a nivel de escritura de datos — pensado para el staff médico.',
    puedeEscribirDatos: true,
    puedeAdministrar: false,
    puedeEliminarProtegidas: false,
  },
  {
    role: 'analyst',
    descripcion: 'Mismos permisos que coach a nivel de escritura de datos — pensado para el staff analítico.',
    puedeEscribirDatos: true,
    puedeAdministrar: false,
    puedeEliminarProtegidas: false,
  },
  {
    role: 'viewer',
    descripcion:
      'Rol de solo lectura. No está en la lista de roles con permiso de escritura — la base de datos rechaza cualquier intento de crear, editar o eliminar datos, aunque algunas pantallas no lo bloqueen visualmente de antemano (ver Matriz de permisos).',
    puedeEscribirDatos: false,
    puedeAdministrar: false,
    puedeEliminarProtegidas: false,
  },
];

function CapabilityRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {value ? (
        <Check className="size-4 text-success" aria-hidden="true" />
      ) : (
        <X className="size-4 text-muted-foreground/50" aria-hidden="true" />
      )}
    </div>
  );
}

export default function Roles({ orgId }: { orgId: string }) {
  const [counts, setCounts] = useState<Record<OrgUserRole, number> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadCounts = () => {
    setLoadError(null);
    listOrgUsers(orgId)
      .then((users) => {
        const next = Object.fromEntries(ALL_ROLES.map((role) => [role, 0])) as Record<OrgUserRole, number>;
        users.forEach((user) => {
          next[user.role] += 1;
        });
        setCounts(next);
      })
      .catch((error: Error) => setLoadError(error.message));
  };

  useEffect(() => {
    loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Los 5 niveles de permiso que existen en ATHLOS (<code>public.user_role</code> en la base) y qué puede
        hacer cada uno. Cuántos usuarios de tu organización tienen cada rol asignado hoy — ver el detalle
        completo en la pestaña Usuarios.
      </p>

      {loadError && <ErrorState title="No se pudo cargar el conteo de usuarios" description={loadError} onRetry={loadCounts} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROLE_DEFINITIONS.map((def) => (
          <Card key={def.role}>
            <CardHeader>
              <div>
                <CardTitle>
                  <Badge variant={ROLE_BADGE[def.role]}>{ROLE_LABEL[def.role]}</Badge>
                </CardTitle>
                <CardDescription className="mt-2">{def.descripcion}</CardDescription>
              </div>
              {counts ? (
                <span className={cn('shrink-0 text-xs font-medium', counts[def.role] === 0 ? 'text-muted-foreground/60' : 'text-foreground')}>
                  {counts[def.role]} {counts[def.role] === 1 ? 'usuario' : 'usuarios'}
                </span>
              ) : (
                <Skeleton className="h-4 w-16 shrink-0" />
              )}
            </CardHeader>
            <div className="space-y-1.5 border-t border-border pt-3">
              <CapabilityRow label="Escribir datos operativos" value={def.puedeEscribirDatos} />
              <CapabilityRow label="Administrar usuarios / organización" value={def.puedeAdministrar} />
              <CapabilityRow label="Eliminar filas protegidas" value={def.puedeEliminarProtegidas} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
