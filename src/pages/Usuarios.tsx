import { useEffect, useState } from 'react';
import { ShieldAlert, Trash2, UserPlus, Users as UsersIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import { ALL_ROLES, ROLE_BADGE, ROLE_LABEL } from '@/constants/roles';
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
import { isAdmin } from '@/utils/permissions';

export default function Usuarios({ orgId, role, currentUserId }: { orgId: string; role: string | null; currentUserId: string }) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<OrgUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'viewer' as OrgUserRole });
  const [isInviting, setIsInviting] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  const isAdminUser = isAdmin(role);
  const usersPager = usePagedRows(users ?? [], 10);

  const loadUsers = () => {
    setLoadError(null);
    listOrgUsers(orgId)
      .then(setUsers)
      .catch((error: Error) => setLoadError(error.message));
  };

  useEffect(() => {
    if (isAdminUser) loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, isAdminUser]);

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.full_name) {
      toast({ title: t('usuarios.toast.completeFields', 'Completa email y nombre'), variant: 'warning' });
      return;
    }
    setIsInviting(true);
    try {
      await inviteOrgUser(orgId, inviteForm);
      toast({
        title: t('usuarios.toast.inviteSentTitle', 'Invitación enviada'),
        description: t('usuarios.toast.inviteSentDesc', '{{email}} recibirá un correo para establecer su contraseña.', {
          email: inviteForm.email,
        }),
        variant: 'success',
      });
      setIsInviteOpen(false);
      setInviteForm({ email: '', full_name: '', role: 'viewer' });
      loadUsers();
    } catch (error) {
      toast({
        title: t('usuarios.toast.inviteErrorTitle', 'No se pudo invitar'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'danger',
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (user: OrgUser, newRole: OrgUserRole) => {
    setUpdatingRoleId(user.user_id);
    try {
      await updateOrgUserRole(orgId, user.user_id, newRole);
      toast({
        title: t('usuarios.toast.roleUpdatedTitle', 'Rol actualizado a {{role}}', {
          role: t(`roles.label.${newRole}`, ROLE_LABEL[newRole]),
        }),
        variant: 'success',
      });
      loadUsers();
    } catch (error) {
      toast({
        title: t('usuarios.toast.roleUpdateErrorTitle', 'No se pudo cambiar el rol'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'danger',
      });
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleDelete = async (user: OrgUser) => {
    try {
      await deleteOrgUser(orgId, user.user_id);
      toast({
        title: t('usuarios.toast.userDeletedTitle', 'Usuario eliminado'),
        description: t('usuarios.toast.userDeletedDesc', 'Su acceso fue revocado por completo.'),
        variant: 'success',
      });
      loadUsers();
    } catch (error) {
      toast({
        title: t('usuarios.toast.deleteErrorTitle', 'No se pudo eliminar'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'danger',
      });
      throw error;
    }
  };

  if (!isAdminUser) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t('usuarios.adminOnly.title', 'Solo administradores')}
        description={t('usuarios.adminOnly.description', 'La gestión de usuarios de la organización requiere rol de administrador.')}
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('usuarios.title', 'Usuarios')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('usuarios.subtitle', 'Miembros de tu organización. Las cuentas se crean por invitación — no hay registro público.')}
          </p>
        </div>
        <Button onClick={() => setIsInviteOpen(true)}>
          <UserPlus className="size-4" aria-hidden="true" /> {t('usuarios.inviteButton', 'Invitar usuario')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t('usuarios.card.title', 'Miembros')}</CardTitle>
            <CardDescription className="mt-1">
              {users
                ? t('usuarios.card.count', '{{count}} usuarios con acceso', { count: users.length })
                : t('usuarios.card.loading', 'Cargando…')}
            </CardDescription>
          </div>
        </CardHeader>

        {loadError ? (
          <ErrorState title={t('usuarios.error.title', 'No se pudieron cargar los usuarios')} description={loadError} onRetry={loadUsers} />
        ) : users !== null && users.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title={t('usuarios.empty.title', 'Sin usuarios')}
            description={t('usuarios.empty.description', 'Invita al primer miembro de tu organización.')}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('usuarios.col.name', 'Nombre')}</TableHead>
                <TableHead>{t('usuarios.col.email', 'Email')}</TableHead>
                <TableHead>{t('usuarios.col.role', 'Rol')}</TableHead>
                <TableHead>{t('usuarios.col.createdAt', 'Alta')}</TableHead>
                <TableHead className="text-right">{t('usuarios.col.actions', 'Acciones')}</TableHead>
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
                            {t('usuarios.youBadge', 'Tú')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email ?? '--'}</TableCell>
                      <TableCell>
                        {isSelf ? (
                          <Badge variant={ROLE_BADGE[user.role]}>{t(`roles.label.${user.role}`, ROLE_LABEL[user.role])}</Badge>
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
                                  {t(`roles.label.${roleOption}`, ROLE_LABEL[roleOption])}
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
                                <span className="sr-only">{t('usuarios.deleteSr', 'Eliminar')}</span>
                              </Button>
                            }
                            title={t('usuarios.confirmDelete.title', '¿Eliminar a {{name}}?', {
                              name: user.full_name ?? user.email ?? t('usuarios.confirmDelete.fallbackUser', 'este usuario'),
                            })}
                            description={t(
                              'usuarios.confirmDelete.description',
                              'Se revoca todo su acceso a la plataforma (la cuenta se elimina). No se puede deshacer.'
                            )}
                            confirmLabel={t('usuarios.confirmDelete.confirmLabel', 'Eliminar')}
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
            <DialogTitle>{t('usuarios.dialog.title', 'Invitar usuario')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t(
              'usuarios.dialog.description',
              'Recibirá un correo de Supabase con un enlace para establecer su contraseña — ninguna contraseña viaja por la app.'
            )}
          </p>
          <Field label={t('usuarios.dialog.emailLabel', 'Email')} htmlFor="invite-email">
            <Input
              id="invite-email"
              type="email"
              value={inviteForm.email}
              onChange={(event) => setInviteForm((form) => ({ ...form, email: event.target.value }))}
              placeholder={t('usuarios.dialog.emailPlaceholder', 'persona@club.com')}
            />
          </Field>
          <Field label={t('usuarios.dialog.nameLabel', 'Nombre completo')} htmlFor="invite-name">
            <Input
              id="invite-name"
              value={inviteForm.full_name}
              onChange={(event) => setInviteForm((form) => ({ ...form, full_name: event.target.value }))}
            />
          </Field>
          <Field label={t('usuarios.dialog.roleLabel', 'Rol')} htmlFor="invite-role">
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
                    {t(`roles.label.${roleOption}`, ROLE_LABEL[roleOption])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={() => setIsInviteOpen(false)}>
              {t('usuarios.dialog.cancel', 'Cancelar')}
            </Button>
            <Button size="sm" isLoading={isInviting} onClick={handleInvite}>
              {t('usuarios.dialog.submit', 'Enviar invitación')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
