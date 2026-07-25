import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';

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
          {group.rows.length} {group.rows.length === 1 ? 'opción' : 'opciones'}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opción</TableHead>
                {ALL_ROLES.map((role) => (
                  <TableHead key={role} className="text-center">
                    {ROLE_LABEL[role]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.rows.map((row) => (
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
                    const key = cellKey(row.key, role);
                    const checked = overrides.get(key) ?? row.defaultRoles.includes(role);
                    const locked = isNavGroup && row.key === ADMIN_LOCKED_NAV_KEY && role === 'admin';
                    const box = (
                      <Checkbox
                        checked={checked}
                        disabled={locked || savingKeys.has(key)}
                        onCheckedChange={(value) => onCheck(row, role, value === true)}
                      />
                    );
                    return (
                      <TableCell key={role} className="text-center align-top">
                        {locked ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">{box}</span>
                            </TooltipTrigger>
                            <TooltipContent>Los administradores siempre pueden acceder a Administración.</TooltipContent>
                          </Tooltip>
                        ) : (
                          box
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

export default function MatrizPermisos({ orgId, viewerRole }: { orgId: string; viewerRole: string | null }) {
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
    const key = cellKey(row.key, role);
    setSavingKeys((prev) => new Set(prev).add(key));
    setPermOverrides((prev) => new Map(prev).set(key, checked));
    try {
      await upsertPermissionSetting(orgId, row.key, role, checked);
    } catch (error) {
      setPermOverrides((prev) => new Map(prev).set(key, !checked));
      toast({ title: 'No se pudo guardar el permiso', description: error instanceof Error ? error.message : undefined, variant: 'danger' });
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
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
      toast({ title: 'No se pudo guardar el acceso', description: error instanceof Error ? error.message : undefined, variant: 'danger' });
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  if (loadError) {
    return <ErrorState title="No se pudo cargar la matriz de permisos" description={loadError} onRetry={loadSettings} />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Matriz de permisos</CardTitle>
            <CardDescription className="mt-1.5 space-y-1">
              <span className="block">
                <strong className="text-foreground">Navegación:</strong> el checkbox sí controla en vivo qué módulos
                del menú ve cada rol y bloquea el acceso directo por URL.
              </span>
              <span className="block">
                <strong className="text-foreground">Resto de carpetas:</strong> guardan una configuración objetivo
                real (se persiste), pero todavía NO cambian el comportamiento de la base de datos — conectarlas a
                las políticas reales es una fase futura separada.
              </span>
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
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
