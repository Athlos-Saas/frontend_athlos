import { forwardRef, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Users } from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { ProfileRosterItem, ProfileRosterStatus } from '../api';
import { useProfileRoster } from '../queries';
import { VerifiedProfileDialog } from './VerifiedProfileDialog';

const STATUS_ORDER: ProfileRosterStatus[] = ['listed', 'published', 'draft', 'none'];

const STATUS_VARIANT: Record<ProfileRosterStatus, 'success' | 'ai' | 'warning' | 'neutral'> = {
  listed: 'success',
  published: 'ai',
  draft: 'warning',
  none: 'neutral',
};

/**
 * "Tus atletas en la vitrina" (solo admin/coach; el backend lo revalida con
 * require_public_profile_manager). Existe porque la vitrina vacía no le decía
 * a nadie qué hacer: un admin con todo su plantel cargado veía "sin
 * resultados" sin saber que hay que publicar —con consentimiento— y marcar
 * "Aparecer en la vitrina". Desde aquí se abre el mismo diálogo de la ficha
 * del jugador, con "Aparecer en la vitrina" activado por defecto.
 *
 * Sin buscador de texto a propósito (regla: el usuario no escribe filtros);
 * se filtra por estado con un desplegable y se ordena por columna.
 */
export const ShowcaseRosterPanel = forwardRef<HTMLElement, { orgId: string }>(function ShowcaseRosterPanel(
  { orgId },
  ref,
) {
  const { t } = useTranslation();
  const roster = useProfileRoster(orgId, true);
  const [selected, setSelected] = useState<ProfileRosterItem | null>(null);

  const statusLabel = (status: ProfileRosterStatus) => t(`vitrina.roster.status.${status}`);

  const columns = useMemo<DataTableColumn<ProfileRosterItem>[]>(
    () => [
      {
        id: 'name',
        header: t('vitrina.roster.colName', 'Atleta'),
        accessor: (row) => row.full_name,
        sortable: true,
      },
      {
        id: 'position',
        header: t('vitrina.roster.colPosition', 'Posición'),
        accessor: (row) => row.position ?? '--',
        sortable: true,
      },
      {
        id: 'status',
        header: t('vitrina.roster.colStatus', 'Estado'),
        // Orden por avance (en vitrina → sin perfil), no alfabético.
        accessor: (row) => STATUS_ORDER.indexOf(row.status),
        cell: (row) => <Badge variant={STATUS_VARIANT[row.status]}>{statusLabel(row.status)}</Badge>,
        sortable: true,
      },
    ],
    // statusLabel solo depende de t.
    [t],
  );

  const counts = roster.data?.counts;

  return (
    <section ref={ref} id="vitrina-mis-atletas" className="scroll-mt-20">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="size-5 text-success" aria-hidden="true" />
            {t('vitrina.roster.title', 'Tus atletas en la vitrina')}
          </CardTitle>
          <CardDescription>
            {t(
              'vitrina.roster.description',
              'Un atleta aparece en la vitrina solo cuando publicas su perfil verificado con consentimiento y marcas "Aparecer en la vitrina".',
            )}
          </CardDescription>
          {counts && (
            <div className="flex flex-wrap gap-2 pt-2">
              {STATUS_ORDER.map((status) => (
                <Badge key={status} variant={STATUS_VARIANT[status]}>
                  {statusLabel(status)}: {counts[status]}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {roster.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : roster.isError ? (
            <ErrorState
              title={t('vitrina.roster.loadError', 'No se pudo cargar tu plantel')}
              description={roster.error instanceof Error ? roster.error.message : undefined}
              onRetry={() => roster.refetch()}
            />
          ) : !roster.data || roster.data.items.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t('vitrina.roster.emptyTitle', 'Tu organización aún no tiene atletas')}
              description={t('vitrina.roster.emptyBody', 'Carga el plantel en Atletas para poder publicar sus perfiles.')}
            />
          ) : (
            <DataTable
              columns={columns}
              data={roster.data.items}
              getRowId={(row) => row.player_id}
              searchable={false}
              pageSize={10}
              filters={[
                {
                  columnId: 'status',
                  label: t('vitrina.roster.filterStatus', 'Estado'),
                  allLabel: t('vitrina.roster.filterAll', 'Todos los estados'),
                  options: STATUS_ORDER.map(statusLabel),
                  accessor: (row) => statusLabel(row.status),
                },
              ]}
              rowActions={(row) => (
                <Button
                  size="sm"
                  variant={row.status === 'none' || row.status === 'draft' ? 'primary' : 'secondary'}
                  onClick={() => setSelected(row)}
                >
                  {row.status === 'none' || row.status === 'draft'
                    ? t('vitrina.roster.publish', 'Publicar')
                    : t('vitrina.roster.manage', 'Gestionar')}
                </Button>
              )}
            />
          )}
        </CardContent>
      </Card>

      {selected && (
        <VerifiedProfileDialog
          orgId={orgId}
          playerId={selected.player_id}
          playerName={selected.full_name}
          open={!!selected}
          onOpenChange={(open) => !open && setSelected(null)}
          defaultListed
        />
      )}
    </section>
  );
});
