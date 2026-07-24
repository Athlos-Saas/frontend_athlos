import { useEffect, useState } from 'react';
import { ShieldAlert, Trash2, UserPlus, Users as UsersIcon } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableSkeletonRows } from '@/components/ui/Table';
import { usePagedRows } from '@/hooks/usePagedRows';
import {
  deleteOrgUser,
  inviteOrgUser,
  listOrgUsers,
  updateOrgUserRole,
  type OrgUser,
  type OrgUserRole,
} from '@/lib/backendApi';
import { toast } from '@/store/toastStore';

const ROLE_LABEL: Record<OrgUserRole, string> = {
  admin: 'Administrador',
  coach: 'Entrenador',
  medical: 'Médico',
  analyst: 'Analista',
  viewer: 'Solo lectura',
};

const ROLE_BADGE: Record<OrgUserRole, 'purple' | 'ai' | 'success' | 'warning' | 'neutral'> = {
  admin: 'purple',
  coach: 'ai',
  medical: 'success',
  analyst: 'warning',
  viewer: 'neutral',
};

const ALL_ROLES = Object.keys(ROLE_LABEL) as OrgUserRole[];

export default function Usuarios({ orgId, role, currentUserId }: { orgId: string; role: string | null; currentUserId: string }) {
  const [users, setUsers] = useState<OrgUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'viewer' as OrgUserRole });
  const [isInviting, setIsInviting] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  const isAdmin = role === 'admin';
  const usersPager = usePagedRows(users ?? [], 10);

  const loadUsers = () => {
    setLoadError(null);
    listOrgUsers(orgId)
      .then(setUsers)
      .catch((error: Error) => setLoadError(error.message));
  };

  useEffect(() => {
    if (isAdmin) loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, isAdmin]);

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.full_name) {
      toast({ title: 'Completa email y nombre', variant: 'warning' });
      return;
    }
    setIsInviting(true);
    try {
      await inviteOrgUser(orgId, inviteForm);
      toast({
        title: 'Invitación enviada',
        description: `${inviteForm.email} recibirá un correo para establecer su contraseña.`,
        variant: 'success',
      });
      setIsInviteOpen(false);
      setInviteForm({ email: '', full_name: '', role: 'viewer' });
      loadUsers();
    } catch (error) {
      toast({ title: 'No se pudo invitar', description: error instanceof Error ? error.message : undefined, variant: 'danger' });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (user: OrgUser, newRole: OrgUserRole) => {
    setUpdatingRoleId(user.user_id);
    try {
      await updateOrgUserRole(orgId, user.user_id, newRole);
      toast({ title: `Rol actualizado a ${ROLE_LABEL[newRole]}`, variant: 'success' });
      loadUsers();
    } catch (error) {
      toast({ title: 'No se pudo cambiar el rol', description: error instanceof Error ? error.message : undefined, variant: 'danger' });
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleDelete = async (user: OrgUser) => {
    try {
      await deleteOrgUser(orgId, user.user_id);
      toast({ title: 'Usuario eliminado', description: 'Su acceso fue revocado por completo.', variant: 'success' });
      loadUsers();
    } catch (error) {
      toast({ title: 'No se pudo eliminar', description: error instanceof Error ? error.message : undefined, variant: 'danger' });
      throw error;
    }
  };

  if (!isAdmin) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Solo administradores"
        description="La gestión de usuarios de la organización requiere rol de administrador."
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Usuarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Miembros de tu organización. Las cuentas se crean por invitación — no hay registro público.
          </p>
        </div>
        <Button onClick={() => setIsInviteOpen(true)}>
          <UserPlus className="size-4" aria-hidden="true" /> Invitar usuario
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Miembros</CardTitle>
            <CardDescription className="mt-1">
              {users ? `${users.length} usuarios con acceso` : 'Cargando…'}
            </CardDescription>
          </div>
        </CardHeader>

        {loadError ? (
          <ErrorState title="No se pudieron cargar los usuarios" description={loadError} onRetry={loadUsers} />
        ) : users !== null && users.length === 0 ? (
          <EmptyState icon={UsersIcon} title="Sin usuarios" description="Invita al primer miembro de tu organización." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Alta</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users === null ? (
                <TableSkeletonRows columns={5} />
              ) : (
                usersPager.paged.map((user) => {
                  const isSelf = user.user_id === currentUserId;
                  return (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">
                        {user.full_name ?? '--'}
                        {isSelf && (
                          <Badge variant="ai" className="ml-2">
                            Tú
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email ?? '--'}</TableCell>
                      <TableCell>
                        {isSelf ? (
                          <Badge variant={ROLE_BADGE[user.role]}>{ROLE_LABEL[user.role]}</Badge>
                        ) : (
                          <Select
                            value={user.role}
                            onValueChange={(value) => handleRoleChange(user, value as OrgUserRole)}
                            disabled={updatingRoleId === user.user_id}
                          >
                            <SelectTrigger className="h-8 w-40 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_ROLES.map((roleOption) => (
                                <SelectItem key={roleOption} value={roleOption}>
                                  {ROLE_LABEL[roleOption]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isSelf && (
                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" size="icon">
                                <Trash2 className="size-4" aria-hidden="true" />
                                <span className="sr-only">Eliminar</span>
                              </Button>
                            }
                            title={`¿Eliminar a ${user.full_name ?? user.email ?? 'este usuario'}?`}
                            description="Se revoca todo su acceso a la plataforma (la cuenta se elimina). No se puede deshacer."
                            confirmLabel="Eliminar"
                            onConfirm={() => handleDelete(user)}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
        {users !== null && users.length > 0 && (
          <Pagination page={usersPager.page} pageCount={usersPager.pageCount} onPageChange={usersPager.setPage} className="mt-4" />
        )}
      </Card>

      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar usuario</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Recibirá un correo de Supabase con un enlace para establecer su contraseña — ninguna
            contraseña viaja por la app.
          </p>
          <Field label="Email" htmlFor="invite-email">
            <Input
              id="invite-email"
              type="email"
              value={inviteForm.email}
              onChange={(event) => setInviteForm((form) => ({ ...form, email: event.target.value }))}
              placeholder="persona@club.com"
            />
          </Field>
          <Field label="Nombre completo" htmlFor="invite-name">
            <Input
              id="invite-name"
              value={inviteForm.full_name}
              onChange={(event) => setInviteForm((form) => ({ ...form, full_name: event.target.value }))}
            />
          </Field>
          <Field label="Rol" htmlFor="invite-role">
            <Select
              value={inviteForm.role}
              onValueChange={(value) => setInviteForm((form) => ({ ...form, role: value as OrgUserRole }))}
            >
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((roleOption) => (
                  <SelectItem key={roleOption} value={roleOption}>
                    {ROLE_LABEL[roleOption]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={() => setIsInviteOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" isLoading={isInviting} onClick={handleInvite}>
              Enviar invitación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
