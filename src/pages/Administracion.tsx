import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

  if (!isAdmin(role)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t('administracion.adminOnly.title', 'Solo administradores')}
        description={t(
          'administracion.adminOnly.description',
          'Roles, permisos y usuarios de la organización requieren rol de administrador.'
        )}
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('administracion.title', 'Administración')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('administracion.subtitle', 'Roles, permisos y usuarios de tu organización — todo en un solo lugar.')}
        </p>
      </div>
      <Tabs defaultValue="permisos">
        <TabsList>
          <TabsTrigger value="permisos">{t('administracion.tab.permisos', 'Matriz de permisos')}</TabsTrigger>
          <TabsTrigger value="roles">{t('administracion.tab.roles', 'Roles')}</TabsTrigger>
          <TabsTrigger value="usuarios">{t('administracion.tab.usuarios', 'Usuarios')}</TabsTrigger>
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
