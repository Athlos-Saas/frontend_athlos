/**
 * Historial de reportes de la organización (PDF del módulo + Excel de
 * AthlosBot). Lectura directa con RLS; el archivo se baja como Blob en el
 * momento de pulsar "Descargar" (ver `downloadReportFile`), sin pestañas
 * nuevas ni URLs firmadas que caduquen con el historial abierto.
 */
import { Download, FileSpreadsheet, FileText, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useDeleteReport, useDownloadReport, useReportsList } from '@/hooks/useReports';
import { toast } from '@/store/toastStore';
import { isAdmin } from '@/utils/permissions';
import type { ReportListItem } from './api';

type LoadState = 'loading' | 'error' | 'ready';

const TYPE_VARIANT: Record<string, NonNullable<BadgeProps['variant']>> = {
  squad_weekly: 'ai',
  post_match: 'purple',
  rival_scouting: 'warning',
  player_individual: 'ai',
  monthly_load: 'purple',
  injury_risk: 'danger',
  market_shortlist: 'success',
  season_summary: 'warning',
  team_readiness: 'success',
  watchlist: 'danger',
  match_report: 'neutral',
};

function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes == null) return null;
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ReportHistory({ orgId, role }: { orgId: string; role: string | null }) {
  const { t, i18n } = useTranslation();
  const reports = useReportsList(orgId);
  const remove = useDeleteReport(orgId);
  const download = useDownloadReport();
  const downloadingId = download.isPending ? (download.variables?.id ?? null) : null;
  const admin = isAdmin(role);

  const state: LoadState = reports.isLoading ? 'loading' : reports.error ? 'error' : 'ready';

  const typeLabel = (type: string) => t(`reportsModule.types.${type}`, type);
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === 'en' ? 'en-US' : 'es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const handleDownload = async (report: ReportListItem) => {
    try {
      await download.mutateAsync(report);
    } catch (error) {
      toast({
        title: t('reportsModule.history.downloadError', 'No se pudo descargar el reporte'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'danger',
      });
    }
  };

  const handleDelete = async (report: ReportListItem) => {
    try {
      await remove.mutateAsync(report);
      toast({ title: t('reportsModule.history.deleted', 'Reporte eliminado'), variant: 'success' });
    } catch (error) {
      toast({
        title: t('reportsModule.history.deleteError', 'No se pudo eliminar el reporte'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'danger',
      });
    }
  };

  const columns: DataTableColumn<ReportListItem>[] = [
    {
      id: 'created_at',
      header: t('reportsModule.history.columns.date', 'Fecha'),
      accessor: (row) => row.created_at,
      cell: (row) => <span className="whitespace-nowrap tabular-nums">{formatDate(row.created_at)}</span>,
      sortable: true,
    },
    {
      id: 'title',
      header: t('reportsModule.history.columns.title', 'Reporte'),
      accessor: (row) => row.title,
      cell: (row) => (
        <span className="flex items-center gap-2 font-medium text-foreground">
          {row.file_format === 'xlsx' ? (
            <FileSpreadsheet className="size-4 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <FileText className="size-4 shrink-0 text-ai" aria-hidden="true" />
          )}
          {row.title}
        </span>
      ),
      sortable: true,
    },
    {
      id: 'report_type',
      header: t('reportsModule.history.columns.type', 'Tipo'),
      accessor: (row) => typeLabel(row.report_type),
      cell: (row) => <Badge variant={TYPE_VARIANT[row.report_type] ?? 'neutral'}>{typeLabel(row.report_type)}</Badge>,
      sortable: true,
    },
    {
      id: 'format',
      header: t('reportsModule.history.columns.format', 'Formato'),
      accessor: (row) => row.file_format.toUpperCase(),
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.file_format === 'xlsx' ? 'Excel' : row.file_format.toUpperCase()}
          {formatBytes(row.file_size_bytes) ? ` · ${formatBytes(row.file_size_bytes)}` : ''}
        </span>
      ),
    },
    {
      id: 'author',
      header: t('reportsModule.history.columns.author', 'Autor'),
      accessor: (row) => row.author_name ?? '',
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.created_by
            ? (row.author_name ?? t('reportsModule.history.unnamedAuthor', 'Usuario sin nombre'))
            : t('reportsModule.history.systemAuthor', 'Sistema')}
        </span>
      ),
      sortable: true,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('reportsModule.history.title', 'Historial de reportes')}</CardTitle>
        <CardDescription>
          {t(
            'reportsModule.history.subtitle',
            'Todos los reportes de tu organización, incluidos los Excel que genera AthlosBot. Los enlaces de descarga duran una hora.',
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state === 'error' ? (
          <ErrorState
            title={t('reportsModule.history.loadError', 'No se pudo cargar el historial')}
            description={reports.error instanceof Error ? reports.error.message : String(reports.error)}
            onRetry={() => void reports.refetch()}
          />
        ) : (
          <DataTable
            columns={columns}
            data={reports.data ?? []}
            getRowId={(row) => row.id}
            isLoading={state === 'loading'}
            searchPlaceholder={t('reportsModule.history.search', 'Buscar por título o autor…')}
            pageSize={15}
            persistKey={`reports-history-${orgId}`}
            filters={[
              {
                columnId: 'report_type',
                label: t('reportsModule.history.columns.type', 'Tipo'),
                options: [...new Set((reports.data ?? []).map((row) => typeLabel(row.report_type)))],
                accessor: (row) => typeLabel(row.report_type),
              },
            ]}
            emptyState={
              <EmptyState
                icon={FileText}
                title={t('reportsModule.history.emptyTitle', 'Todavía no hay reportes')}
                description={t(
                  'reportsModule.history.emptyDescription',
                  'Genera el primero desde el panel de arriba: semanal del plantel, post-partido o rival.',
                )}
              />
            }
            rowActions={(row) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDownload(row)}
                  isLoading={downloadingId === row.id}
                  disabled={download.isPending && downloadingId !== row.id}
                  aria-label={t('reportsModule.history.downloadAria', 'Descargar {{title}}', { title: row.title })}
                >
                  {downloadingId !== row.id && <Download className="size-4" aria-hidden="true" />}
                  {t('reportsModule.history.download', 'Descargar')}
                </Button>
                {admin && (
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('reportsModule.history.deleteAria', 'Eliminar {{title}}', { title: row.title })}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    }
                    title={t('reportsModule.history.deleteTitle', '¿Eliminar este reporte?')}
                    description={t(
                      'reportsModule.history.deleteDescription',
                      'Se borra el archivo y su entrada del historial para toda la organización. No se puede deshacer.',
                    )}
                    confirmLabel={t('reportsModule.history.deleteConfirm', 'Eliminar')}
                    onConfirm={() => handleDelete(row)}
                  />
                )}
              </div>
            )}
          />
        )}
      </CardContent>
    </Card>
  );
}
