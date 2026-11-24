import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteReport,
  downloadReportFile,
  fetchReportMarketLeagues,
  fetchReportPlayers,
  fetchReportRivals,
  fetchReports,
  fetchReportTeams,
  fetchReportVideos,
  generateModuleReport,
  type GenerateModuleReportRequest,
  type ReportRow,
} from '@/features/reports/api';

/**
 * Hooks de datos del módulo Reportes. Un query por fuente: el historial se
 * refresca tras generar/borrar sin volver a pedir equipos, videos y rivales,
 * que cambian mucho menos.
 */

const reportsKey = (orgId: string) => ['reports', 'list', orgId] as const;

export function useReportsList(orgId: string) {
  return useQuery({
    queryKey: reportsKey(orgId),
    queryFn: () => fetchReports(orgId),
    staleTime: 30_000,
  });
}

export function useReportTeams(orgId: string) {
  return useQuery({
    queryKey: ['reports', 'teams', orgId],
    queryFn: () => fetchReportTeams(orgId),
    staleTime: 5 * 60_000,
  });
}

export function useReportVideos(orgId: string) {
  return useQuery({
    queryKey: ['reports', 'videos', orgId],
    queryFn: () => fetchReportVideos(orgId),
    staleTime: 60_000,
  });
}

export function useReportRivals(orgId: string) {
  return useQuery({
    queryKey: ['reports', 'rivals', orgId],
    queryFn: () => fetchReportRivals(orgId),
    staleTime: 60_000,
  });
}

export function useReportPlayers(orgId: string) {
  return useQuery({
    queryKey: ['reports', 'players', orgId],
    queryFn: () => fetchReportPlayers(orgId),
    staleTime: 5 * 60_000,
  });
}

/**
 * Ligas de Mercado actual: solo se piden cuando se abre la pestaña de
 * shortlist (`enabled`), porque van al backend y en el plan free de Render
 * pueden costar el despertar del servicio a quien solo vino a ver el historial.
 */
export function useReportMarketLeagues(orgId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'market-leagues', orgId],
    queryFn: () => fetchReportMarketLeagues(orgId),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Descarga como Blob (ver `downloadReportFile`); expone isPending/variables
 * para el spinner de la fila que se está bajando. */
export function useDownloadReport() {
  return useMutation({
    mutationFn: (report: { id?: string; storage_path: string; title: string }) => downloadReportFile(report),
  });
}

export function useGenerateReport(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GenerateModuleReportRequest) => generateModuleReport(orgId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reportsKey(orgId) }),
  });
}

export function useDeleteReport(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (report: Pick<ReportRow, 'id' | 'storage_path'>) => deleteReport(report),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reportsKey(orgId) }),
  });
}
