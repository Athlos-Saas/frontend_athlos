/**
 * Generador de reportes PDF (semanal del plantel, post-partido, rival).
 *
 * El PDF lo arma el backend con datos reales; aquí solo se eligen los
 * parámetros. Tras generar se muestra un enlace de descarga en vez de abrir
 * una pestaña sola: `window.open` después de un `await` lo bloquean los
 * bloqueadores de ventanas emergentes.
 */
import { useMemo, useState } from 'react';
import { CalendarRange, Download, FileText, Shield, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { DatePicker } from '@/components/ui/DatePicker';
import { Field } from '@/components/ui/Field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useGenerateReport, useReportRivals, useReportTeams, useReportVideos } from '@/hooks/useReports';
import { toast } from '@/store/toastStore';
import { canWrite } from '@/utils/permissions';
import type { GenerateModuleReportResult, ModuleReportType } from './api';

/** Radix Select no admite `value=""`: centinela para "sin equipo propio". */
const NO_TEAM = '__none__';

/** Fecha local AAAA-MM-DD (toISOString usaría UTC y podría correr un día). */
function toIsoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ReportGenerator({ orgId, role }: { orgId: string; role: string | null }) {
  const { t } = useTranslation();
  const writable = canWrite(role);

  const teams = useReportTeams(orgId);
  const videos = useReportVideos(orgId);
  const rivals = useReportRivals(orgId);
  const generate = useGenerateReport(orgId);

  const [kind, setKind] = useState<ModuleReportType>('squad_weekly');
  const [teamId, setTeamId] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<Date | undefined>(() => new Date());
  const [videoId, setVideoId] = useState<string>('');
  const [rivalId, setRivalId] = useState<string>('');
  const [rivalTeamId, setRivalTeamId] = useState<string>(NO_TEAM);
  const [lastResult, setLastResult] = useState<GenerateModuleReportResult | null>(null);

  // Equipo por defecto: el primero (temporada más reciente), igual que el
  // backend cuando no recibe team_id.
  const effectiveTeamId = teamId || teams.data?.[0]?.id || '';

  const canSubmit = useMemo(() => {
    if (!writable || generate.isPending) return false;
    if (kind === 'squad_weekly') return !!effectiveTeamId && !!periodEnd;
    if (kind === 'post_match') return !!videoId;
    return !!rivalId;
  }, [writable, generate.isPending, kind, effectiveTeamId, periodEnd, videoId, rivalId]);

  const handleGenerate = async () => {
    const payload =
      kind === 'squad_weekly'
        ? { report_type: kind, team_id: effectiveTeamId, period_end: periodEnd ? toIsoDay(periodEnd) : undefined }
        : kind === 'post_match'
          ? { report_type: kind, video_id: videoId }
          : { report_type: kind, rival_id: rivalId, team_id: rivalTeamId === NO_TEAM ? undefined : rivalTeamId };
    try {
      const result = await generate.mutateAsync(payload);
      setLastResult(result);
      toast({ title: t('reportsModule.generator.success', 'Reporte generado'), description: result.title, variant: 'success' });
    } catch (error) {
      toast({
        title: t('reportsModule.generator.error', 'No se pudo generar el reporte'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'danger',
      });
    }
  };

  const loadingOptions = teams.isLoading || videos.isLoading || rivals.isLoading;
  const optionsError = teams.error ?? videos.error ?? rivals.error;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-5 text-ai" aria-hidden="true" />
          {t('reportsModule.generator.title', 'Generar reporte')}
        </CardTitle>
        <CardDescription>
          {t(
            'reportsModule.generator.subtitle',
            'PDF con marca ATHLOS y datos reales. Si falta un dato, el reporte lo dice: nunca se rellena.',
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!writable && (
          <p className="rounded-md border border-border bg-panel px-3 py-2 text-sm text-muted-foreground">
            {t(
              'reportsModule.generator.readOnly',
              'Tu rol puede ver y descargar reportes, pero generarlos requiere un rol con escritura (admin, entrenador, médico o analista).',
            )}
          </p>
        )}
        {optionsError && (
          <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {t('reportsModule.generator.optionsError', 'No se pudieron cargar las opciones')}:{' '}
            {optionsError instanceof Error ? optionsError.message : String(optionsError)}
          </p>
        )}

        <Tabs value={kind} onValueChange={(value) => setKind(value as ModuleReportType)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="squad_weekly" className="gap-1.5">
              <CalendarRange className="size-4" aria-hidden="true" />
              {t('reportsModule.types.squad_weekly', 'Semanal del plantel')}
            </TabsTrigger>
            <TabsTrigger value="post_match" className="gap-1.5">
              <Video className="size-4" aria-hidden="true" />
              {t('reportsModule.types.post_match', 'Post-partido')}
            </TabsTrigger>
            <TabsTrigger value="rival_scouting" className="gap-1.5">
              <Shield className="size-4" aria-hidden="true" />
              {t('reportsModule.types.rival_scouting', 'Rival')}
            </TabsTrigger>
          </TabsList>

          {loadingOptions ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : (
            <>
              <TabsContent value="squad_weekly" className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t(
                    'reportsModule.generator.squadWeeklyHelp',
                    'Carga GPS y ACWR por atleta, alertas y wellness del equipo solo agregado (sin datos médicos individuales).',
                  )}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t('reportsModule.fields.team', 'Equipo')}>
                    <Select value={effectiveTeamId} onValueChange={setTeamId} disabled={!teams.data?.length}>
                      <SelectTrigger aria-label={t('reportsModule.fields.team', 'Equipo')}>
                        <SelectValue placeholder={t('reportsModule.fields.noTeams', 'Sin equipos')} />
                      </SelectTrigger>
                      <SelectContent>
                        {(teams.data ?? []).map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                            {team.season ? ` (${team.season})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field
                    label={t('reportsModule.fields.periodEnd', 'Último día de la semana')}
                    hint={t('reportsModule.fields.periodEndHint', 'El reporte cubre los 7 días que terminan en esta fecha.')}
                  >
                    <DatePicker
                      value={periodEnd}
                      onChange={setPeriodEnd}
                      placeholder={t('reportsModule.fields.pickDate', 'Elige una fecha')}
                    />
                  </Field>
                </div>
              </TabsContent>

              <TabsContent value="post_match" className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t(
                    'reportsModule.generator.postMatchHelp',
                    'Métricas por equipo, eventos, velocidades, jugadores y mapas de calor de un análisis de video terminado.',
                  )}
                </p>
                <Field label={t('reportsModule.fields.video', 'Análisis de video')}>
                  <Select value={videoId} onValueChange={setVideoId} disabled={!videos.data?.length}>
                    <SelectTrigger aria-label={t('reportsModule.fields.video', 'Análisis de video')}>
                      <SelectValue
                        placeholder={
                          videos.data?.length
                            ? t('reportsModule.fields.pickVideo', 'Elige un análisis terminado')
                            : t('reportsModule.fields.noVideos', 'No hay análisis terminados')
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(videos.data ?? []).map((video) => (
                        <SelectItem key={video.id} value={video.id}>
                          {video.title}
                          {video.match_date ? ` · ${video.match_date}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </TabsContent>

              <TabsContent value="rival_scouting" className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t(
                    'reportsModule.generator.rivalHelp',
                    'Perfil, plantel scouteado y, si eliges un equipo propio, la simulación del enfrentamiento.',
                  )}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t('reportsModule.fields.rival', 'Rival')}>
                    <Select value={rivalId} onValueChange={setRivalId} disabled={!rivals.data?.length}>
                      <SelectTrigger aria-label={t('reportsModule.fields.rival', 'Rival')}>
                        <SelectValue
                          placeholder={
                            rivals.data?.length
                              ? t('reportsModule.fields.pickRival', 'Elige un rival')
                              : t('reportsModule.fields.noRivals', 'No hay rivales: cárgalos en el módulo Rivales')
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {(rivals.data ?? []).map((rival) => (
                          <SelectItem key={rival.id} value={rival.id}>
                            {rival.name}
                            {rival.competition ? ` · ${rival.competition}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field
                    label={t('reportsModule.fields.ownTeam', 'Simular contra (opcional)')}
                    hint={t('reportsModule.fields.ownTeamHint', 'Sin equipo propio, el reporte no incluye simulación.')}
                  >
                    <Select value={rivalTeamId} onValueChange={setRivalTeamId}>
                      <SelectTrigger aria-label={t('reportsModule.fields.ownTeam', 'Simular contra (opcional)')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_TEAM}>{t('reportsModule.fields.noSimulation', 'Sin simulación')}</SelectItem>
                        {(teams.data ?? []).map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                            {team.season ? ` (${team.season})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleGenerate} disabled={!canSubmit} isLoading={generate.isPending}>
            {/* Mientras carga, Button ya pinta su spinner: sin esto salían dos íconos. */}
            {!generate.isPending && <FileText className="size-4" aria-hidden="true" />}
            {generate.isPending
              ? t('reportsModule.generator.generating', 'Generando…')
              : t('reportsModule.generator.submit', 'Generar PDF')}
          </Button>
          {lastResult?.download_url && (
            <Button variant="secondary" asChild>
              <a href={lastResult.download_url} target="_blank" rel="noopener noreferrer">
                <Download className="size-4" aria-hidden="true" />
                {t('reportsModule.generator.downloadLast', 'Descargar "{{title}}" ({{size}})', {
                  title: lastResult.title,
                  size: formatBytes(lastResult.file_size_bytes),
                })}
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
