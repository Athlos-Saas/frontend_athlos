import { ShieldAlert } from 'lucide-react';

import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { isAdmin } from '@/utils/permissions';

import MatrizPermisos from './MatrizPermisos';
import Roles from './Roles';
import Usuarios from './Usuarios';

export default function Administracion({
  orgId,
  role,
  currentUserId,
}: {
  orgId: string;
  role: string | null;
  currentUserId: string;
}) {
  if (!isAdmin(role)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Solo administradores"
        description="Roles, permisos y usuarios de la organización requieren rol de administrador."
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Administración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Roles, permisos y usuarios de tu organización — todo en un solo lugar.
        </p>
      </div>
      <Tabs defaultValue="permisos">
        <TabsList>
          <TabsTrigger value="permisos">Matriz de permisos</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
        </TabsList>
        <TabsContent value="permisos">
          <MatrizPermisos orgId={orgId} viewerRole={role} />
        </TabsContent>
        <TabsContent value="roles">
          <Roles orgId={orgId} />
        </TabsContent>
        <TabsContent value="usuarios">
          <Usuarios orgId={orgId} role={role} currentUserId={currentUserId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
