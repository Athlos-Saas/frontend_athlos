import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { ErrorState } from '@/components/ui/ErrorState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { NAV_PERMISSION_GROUP, PERMISSION_GROUPS, type PermissionGroup, type PermissionRow } from '@/constants/permissionCatalog';
import { ALL_ROLES, ROLE_LABEL } from '@/constants/roles';
import type { OrgUserRole } from '@/lib/backendApi';
import {
  fetchNavAccessSettings,
  fetchPermissionSettings,
  upsertNavAccessSetting,
  upsertPermissionSetting,
} from '@/lib/permissionSettings';
import { useNavAccessStore } from '@/store/navAccessStore';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

const ADMIN_LOCKED_NAV_KEY = '/administracion';

function cellKey(rowKey: string, role: OrgUserRole): string {
  return `${rowKey}|${role}`;
}

interface FolderProps {
  group: PermissionGroup;
  isOpen: boolean;
  onToggle: () => void;
  isNavGroup: boolean;
  overrides: Map<string, boolean>;
  savingKeys: Set<string>;
  onCheck: (row: PermissionRow, role: OrgUserRole, checked: boolean) => void;
}

function PermissionFolder({ group, isOpen, onToggle, isNavGroup, overrides, savingKeys, onCheck }: FolderProps) {
  const { t } = useTranslation();
  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="focus-ring flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-panel/60"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-90')} aria-hidden="true" />
          {group.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {group.rows.length} {group.rows.length === 1 ? t('matrizPermisos.optionSingular', 'opción') : t('matrizPermisos.optionPlural', 'opciones')}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('matrizPermisos.col.option', 'Opción')}</TableHead>
                {ALL_ROLES.map((role) => (
                  <TableHead key={role} className="text-center">
                    {t(`roles.label.${role}`, ROLE_LABEL[role])}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.rows.map((row) => {
                const keys = row.enforcementKeys?.length ? row.enforcementKeys : [row.key];
                return (
                  <TableRow key={row.key}>
                    <TableCell className="align-top">
                      <p className="font-medium">{row.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{row.comoSeGatea}</p>
                      {row.gap && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-warning">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                          <span>{row.gap}</span>
                        </p>
                      )}
                    </TableCell>
                    {ALL_ROLES.map((role) => {
                      // Cuando varias filas comparten enforcementKeys (misma policy real en
                      // la base), el checkbox refleja el AND de esas claves — no puede
                      // mostrarse "permitido" acá y "bloqueado" en la fila hermana si
                      // ambas son, en los hechos, el mismo candado.
                      const checked = keys.every((k) => overrides.get(cellKey(k, role)) ?? row.defaultRoles.includes(role));
                      const savingKey = keys.find((k) => savingKeys.has(cellKey(k, role)));
                      const navLocked = isNavGroup && row.key === ADMIN_LOCKED_NAV_KEY && role === 'admin';
                      const enforcedAdminLocked = !isNavGroup && row.enforced && role === 'admin';
                      const locked = navLocked || enforcedAdminLocked;
                      const box = (
                        <Checkbox
                          checked={checked}
                          disabled={locked || Boolean(savingKey)}
                          onCheckedChange={(value) => onCheck(row, role, value === true)}
                        />
                      );
                      return (
                        <TableCell key={role} className="text-center align-top">
                          {navLocked ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">{box}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t('matrizPermisos.tooltip.navAdminLocked', 'Los administradores siempre pueden acceder a Administración.')}
                              </TooltipContent>
                            </Tooltip>
                          ) : enforcedAdminLocked ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">{box}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t(
                                  'matrizPermisos.tooltip.enforcedAdminLocked',
                                  'Un admin siempre puede hacer esto — evita que la org se quede sin nadie que pueda.'
                                )}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            box
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

export default function MatrizPermisos({ orgId, viewerRole }: { orgId: string; viewerRole: string | null }) {
  const { t } = useTranslation();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [permOverrides, setPermOverrides] = useState<Map<string, boolean>>(new Map());
  const [navOverrides, setNavOverrides] = useState<Map<string, boolean>>(new Map());
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = () => {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([fetchPermissionSettings(orgId), fetchNavAccessSettings(orgId)])
      .then(([permRows, navRows]) => {
        setPermOverrides(new Map(permRows.map((r) => [cellKey(r.permission_key, r.role), r.allowed])));
        setNavOverrides(new Map(navRows.map((r) => [cellKey(r.nav_key, r.role), r.allowed])));
      })
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCheckPermission = async (row: PermissionRow, role: OrgUserRole, checked: boolean) => {
    // Filas con enforcementKeys controlan más de una policy real a la vez
    // (ej. "Importar roster" toca players.update E injuries.insert) — se
    // escriben todas juntas para que el checkbox nunca quede a mitad de camino.
    const keys = row.enforcementKeys?.length ? row.enforcementKeys : [row.key];
    const cellKeys = keys.map((k) => cellKey(k, role));
    setSavingKeys((prev) => {
      const next = new Set(prev);
      cellKeys.forEach((k) => next.add(k));
      return next;
    });
    setPermOverrides((prev) => {
      const next = new Map(prev);
      cellKeys.forEach((k) => next.set(k, checked));
      return next;
    });
    try {
      await Promise.all(keys.map((k) => upsertPermissionSetting(orgId, k, role, checked)));
    } catch (error) {
      setPermOverrides((prev) => {
        const next = new Map(prev);
        cellKeys.forEach((k) => next.set(k, !checked));
        return next;
      });
      toast({
        title: t('matrizPermisos.toast.permissionSaveError', 'No se pudo guardar el permiso'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'danger',
      });
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        cellKeys.forEach((k) => next.delete(k));
        return next;
      });
    }
  };

  const handleCheckNav = async (row: PermissionRow, role: OrgUserRole, checked: boolean) => {
    const key = cellKey(row.key, role);
    setSavingKeys((prev) => new Set(prev).add(key));
    setNavOverrides((prev) => new Map(prev).set(key, checked));
    try {
      await upsertNavAccessSetting(orgId, row.key, role, checked);
      if (role === viewerRole) {
        const denied = new Set(useNavAccessStore.getState().deniedKeys);
        if (checked) denied.delete(row.key);
        else denied.add(row.key);
        useNavAccessStore.getState().setDeniedKeys(denied);
      }
    } catch (error) {
      setNavOverrides((prev) => new Map(prev).set(key, !checked));
      toast({
        title: t('matrizPermisos.toast.navSaveError', 'No se pudo guardar el acceso'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'danger',
      });
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  if (loadError) {
    return (
      <ErrorState
        title={t('matrizPermisos.error.title', 'No se pudo cargar la matriz de permisos')}
        description={loadError}
        onRetry={loadSettings}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t('matrizPermisos.title', 'Matriz de permisos')}</CardTitle>
            <CardDescription className="mt-1.5 space-y-1">
              <span className="block">
                <strong className="text-foreground">{t('matrizPermisos.legend.navigationLabel', 'Navegación:')}</strong>{' '}
                {t(
                  'matrizPermisos.legend.navigation',
                  'el checkbox controla en vivo qué módulos del menú ve cada rol y bloquea el acceso directo por URL.'
                )}
              </span>
              <span className="block">
                <strong className="text-foreground">{t('matrizPermisos.legend.restLabel', 'Resto de carpetas:')}</strong>{' '}
                {t(
                  'matrizPermisos.legend.rest',
                  'la mayoría de los checkboxes ya cambian el comportamiento real (RLS o backend) — se marcan con su propia nota en "cómo se gatea". Las pocas filas que todavía son solo configuración objetivo lo dicen explícitamente (perfil propio, invitar/cambiar rol/eliminar usuario).'
                )}
              </span>
              <span className="block">
                <strong className="text-foreground">{t('matrizPermisos.legend.adminColumnLabel', 'Columna "Administrador":')}</strong>{' '}
                {t(
                  'matrizPermisos.legend.adminColumn',
                  'queda bloqueada en las filas conectadas, para que ningún admin pueda dejar a su propia organización sin nadie que pueda ejercer esa acción.'
                )}
              </span>
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('matrizPermisos.loading', 'Cargando…')}</p>
      ) : (
        <div className="space-y-2">
          <PermissionFolder
            group={NAV_PERMISSION_GROUP}
            isOpen={openGroups.has(NAV_PERMISSION_GROUP.key)}
            onToggle={() => toggleGroup(NAV_PERMISSION_GROUP.key)}
            isNavGroup
            overrides={navOverrides}
            savingKeys={savingKeys}
            onCheck={handleCheckNav}
          />
          {PERMISSION_GROUPS.map((group) => (
            <PermissionFolder
              key={group.key}
              group={group}
              isOpen={openGroups.has(group.key)}
              onToggle={() => toggleGroup(group.key)}
              isNavGroup={false}
              overrides={permOverrides}
              savingKeys={savingKeys}
              onCheck={handleCheckPermission}
            />
          ))}
        </div>
      )}
    </div>
  );
}
