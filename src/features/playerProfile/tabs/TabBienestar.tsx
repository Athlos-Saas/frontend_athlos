/**
 * Bienestar psicológico del atleta (032_wellbeing_checkins.sql).
 *
 * Solo se monta para roles con acceso (PlayerProfile decide con
 * wellbeingAccessLevel); el backend vuelve a decidir con el rol real y
 * devuelve el nivel que corresponde:
 *   - 'detail' (admin, medical; coach solo si un admin lo habilitó): radar por
 *     dimensión contra SU línea base, tendencias 7/28 días, banderas.
 *   - 'flags' (coach por defecto): estado resumido y banderas, sin números.
 *
 * Monitoreo, no diagnóstico: el aviso es permanente y no se puede cerrar. No
 * hay comparación entre jugadores en ningún lado de esta pestaña.
 */
import { useMemo, useState } from 'react';
import { Brain, CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { RadarDualChart } from '@/components/charts/RadarDualChart';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { colors } from '@/constants/tokens';
import { WellbeingFlagList, WellbeingStatusBadge } from '@/features/wellbeing/components/WellbeingFlags';
import { WellbeingDisclaimer } from '@/features/wellbeing/components/WellbeingNotices';
import { usePlayerWellbeingProfile, type WellbeingProfile } from '@/features/wellbeing/queries';
import type { WellbeingAccessLevel } from '@/utils/permissions';

import { formatDate } from '../format';

function fmt(value: number | null | undefined, digits = 0): string {
  return value === null || value === undefined ? '--' : value.toFixed(digits);
}

function signed(value: number | null | undefined): string {
  if (value === null || value === undefined) return '--';
  return `${value > 0 ? '+' : ''}${value.toFixed(0)}`;
}

export default function TabBienestar({ orgId, playerId, level }: { orgId: string; playerId: string; level: WellbeingAccessLevel }) {
  const { t } = useTranslation();
  const profile = usePlayerWellbeingProfile(orgId, playerId, level !== 'none');

  return (
    <div className="space-y-5">
      <WellbeingDisclaimer />
      {profile.isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : profile.isError ? (
        <ErrorState
          title={t('wellbeing.profile.errorTitle')}
          description={profile.error instanceof Error ? profile.error.message : undefined}
          onRetry={() => profile.refetch()}
        />
      ) : profile.data ? (
        <ProfileContent profile={profile.data} />
      ) : null}
    </div>
  );
}

function ProfileContent({ profile }: { profile: WellbeingProfile }) {
  const { t } = useTranslation();
  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="size-4 text-purple" aria-hidden="true" />
              {t('wellbeing.profile.statusTitle')}
            </CardTitle>
            <CardDescription className="mt-1 flex items-center gap-1.5">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              {profile.last_checkin_date
                ? t('wellbeing.profile.lastCheckin', { date: formatDate(profile.last_checkin_date), n: profile.checkins_28d })
                : t('wellbeing.profile.noCheckins')}
            </CardDescription>
          </div>
          <WellbeingStatusBadge status={profile.status} />
        </CardHeader>
        <WellbeingFlagList flags={profile.flags} />
        {profile.access === 'flags' && <p className="mt-3 text-xs text-muted-foreground">{t('wellbeing.profile.flagsOnlyNote')}</p>}
      </Card>

      {profile.access === 'detail' && profile.daily && <DailySection profile={profile} />}
      {profile.access === 'detail' && profile.weekly && <WeeklySection weekly={profile.weekly} />}
    </>
  );
}

function DailySection({ profile }: { profile: WellbeingProfile }) {
  const { t } = useTranslation();
  const daily = profile.daily!;
  const params = profile.parameters;
  const [dimension, setDimension] = useState('mood');
  const selected = daily.dimensions.find((d) => d.key === dimension);
  const radar = useMemo(
    () =>
      daily.dimensions
        .filter((d) => d.mean_7d !== null && d.baseline !== null)
        .map((d) => ({ attribute: t(`wellbeing.dimensions.${d.key}`), a: d.mean_7d as number, b: d.baseline as number })),
    [daily.dimensions, t],
  );
  const series = useMemo(() => daily.series.map((point) => ({ date: point.date, value: point[dimension] ?? null })), [daily.series, dimension]);

  if (daily.series.length === 0) {
    return <EmptyState icon={Brain} title={t('wellbeing.profile.emptyDailyTitle')} description={t('wellbeing.profile.emptyDailyDescription')} />;
  }

  return (
    <>
      {radar.length >= 3 ? (
        <ChartCard title={t('wellbeing.profile.dailyRadarTitle')} description={t('wellbeing.profile.dailyRadarDescription')} height={300}>
          <RadarDualChart data={radar} nameA={t('wellbeing.profile.last7')} nameB={t('wellbeing.profile.baseline')} colorA={colors.purple} colorB={colors.textSecondary} />
        </ChartCard>
      ) : (
        <Card>
          <p className="text-sm text-muted-foreground">
            {t('wellbeing.profile.buildingBaseline', { min: params?.baseline_min_obs ?? 10, days: params?.baseline_window_days ?? 28 })}
          </p>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t('wellbeing.profile.dailyTableTitle')}</CardTitle>
            <CardDescription className="mt-1">{t('wellbeing.profile.dailyTableDescription')}</CardDescription>
          </div>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('wellbeing.profile.col.dimension')}</TableHead>
              <TableHead className="text-right">{t('wellbeing.profile.col.last7')}</TableHead>
              <TableHead className="text-right">{t('wellbeing.profile.col.last28')}</TableHead>
              <TableHead className="text-right">{t('wellbeing.profile.col.baseline')}</TableHead>
              <TableHead className="text-right">{t('wellbeing.profile.col.deviation')}</TableHead>
              <TableHead className="text-right">{t('wellbeing.profile.col.trend')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {daily.dimensions.map((d) => (
              <TableRow key={d.key}>
                <TableCell className="font-medium">{t(`wellbeing.dimensions.${d.key}`)}</TableCell>
                <TableCell className="text-right">{fmt(d.mean_7d)}</TableCell>
                <TableCell className="text-right">{fmt(d.mean_28d)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {d.baseline_ready ? fmt(d.baseline) : t('wellbeing.profile.baselinePending', { n: d.baseline_n, min: params?.baseline_min_obs ?? 10 })}
                </TableCell>
                <TableCell className="text-right">
                  {d.deviation === null ? '--' : <Badge variant={d.deviation <= -15 ? 'warning' : 'neutral'}>{signed(d.deviation)}</Badge>}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">{d.trend ? t(`wellbeing.trend.${d.trend}`) : '--'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-3 text-xs text-muted-foreground">{t('wellbeing.profile.scaleNote')}</p>
      </Card>

      <ChartCard
        title={t('wellbeing.profile.trendTitle')}
        description={t('wellbeing.profile.trendDescription')}
        height={240}
        actions={
          <Select value={dimension} onValueChange={setDimension}>
            <SelectTrigger className="h-8 w-48 text-xs" aria-label={t('wellbeing.profile.col.dimension')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {daily.dimensions.map((d) => (
                <SelectItem key={d.key} value={d.key}>
                  {t(`wellbeing.dimensions.${d.key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        <TrendLineChart
          data={series}
          xKey="date"
          yKey="value"
          name={t(`wellbeing.dimensions.${dimension}`)}
          color={colors.purple}
          yDomain={[0, 100]}
          referenceY={selected?.baseline ?? null}
          referenceLabel={t('wellbeing.profile.baseline')}
          connectNulls
        />
      </ChartCard>
    </>
  );
}

function WeeklySection({ weekly }: { weekly: NonNullable<WellbeingProfile['weekly']> }) {
  const { t } = useTranslation();
  const withBaseline = weekly.dimensions.filter((d) => d.current !== null && d.baseline !== null);
  if (!weekly.latest_date) {
    return <EmptyState icon={CalendarClock} title={t('wellbeing.profile.emptyWeeklyTitle')} description={t('wellbeing.profile.emptyWeeklyDescription')} />;
  }
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t('wellbeing.profile.weeklyTitle')}</CardTitle>
          <CardDescription className="mt-1">
            {t('wellbeing.profile.weeklyDescription', { date: formatDate(weekly.latest_date), n: weekly.count })}
            {!weekly.is_current && ` · ${t('wellbeing.profile.weeklyStale')}`}
          </CardDescription>
        </div>
      </CardHeader>
      {withBaseline.length >= 3 && (
        <div className="mb-4 h-[300px]">
          <RadarDualChart
            data={withBaseline.map((d) => ({ attribute: t(`wellbeing.dimensions.${d.key}`), a: d.current as number, b: d.baseline as number }))}
            nameA={t('wellbeing.profile.latestWeekly')}
            nameB={t('wellbeing.profile.baseline')}
            colorA={colors.blue}
            colorB={colors.textSecondary}
          />
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('wellbeing.profile.col.dimension')}</TableHead>
            <TableHead className="text-right">{t('wellbeing.profile.col.latest')}</TableHead>
            <TableHead className="text-right">{t('wellbeing.profile.col.baseline')}</TableHead>
            <TableHead className="text-right">{t('wellbeing.profile.col.deviation')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {weekly.dimensions.map((d) => (
            <TableRow key={d.key}>
              <TableCell className="font-medium">{t(`wellbeing.dimensions.${d.key}`)}</TableCell>
              <TableCell className="text-right">{fmt(d.current)}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {d.baseline_ready ? fmt(d.baseline) : t('wellbeing.profile.weeklyBaselinePending', { n: d.baseline_n })}
              </TableCell>
              <TableCell className="text-right">{signed(d.deviation)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
