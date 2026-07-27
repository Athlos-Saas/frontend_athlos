import { BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { usePagedRows } from '@/hooks/usePagedRows';
import { usePlayerLeagueStats } from '../queries';

export default function TabEstadisticas({ orgId, playerId }: { orgId: string; playerId: string }) {
  const { t } = useTranslation();
  const { data, isLoading } = usePlayerLeagueStats(orgId, playerId);

  const attacker = data?.attacker ?? [];
  const goalkeeper = data?.goalkeeper ?? [];
  const attackerPager = usePagedRows(attacker, 10);
  const goalkeeperPager = usePagedRows(goalkeeper, 10);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (attacker.length === 0 && goalkeeper.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title={t('tabEstadisticas.empty.title', 'Sin estadísticas de liga')}
        description={t(
          'tabEstadisticas.empty.description',
          'Este jugador no está reconciliado con ninguna fila de league_attacker_stats/league_goalkeeper_stats todavía (se vincula por nombre al importar stats de conferencia).',
        )}
      />
    );
  }

  return (
    <div className="space-y-5">
      {attacker.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('tabEstadisticas.offensive.title', 'Stats ofensivas')}</CardTitle>
              <CardDescription className="mt-1">{t('tabEstadisticas.bySeasonCompetition', 'Por temporada/competición')}</CardDescription>
            </div>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tabEstadisticas.col.season', 'Temporada')}</TableHead>
                <TableHead>{t('tabEstadisticas.col.competition', 'Competición')}</TableHead>
                <TableHead className="text-right">{t('tabEstadisticas.col.gp', 'PJ')}</TableHead>
                <TableHead className="text-right">{t('tabEstadisticas.col.goals', 'Goles')}</TableHead>
                <TableHead className="text-right">{t('tabEstadisticas.col.assists', 'Asist.')}</TableHead>
                <TableHead className="text-right">{t('tabEstadisticas.col.points', 'Puntos')}</TableHead>
                <TableHead>{t('tabEstadisticas.col.role', 'Rol')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attackerPager.paged.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.season ?? '--'}</TableCell>
                  <TableCell>{row.competition ?? '--'}</TableCell>
                  <TableCell className="text-right">{row.gp ?? '--'}</TableCell>
                  <TableCell className="text-right">{row.goals}</TableCell>
                  <TableCell className="text-right">{row.assists ?? '--'}</TableCell>
                  <TableCell className="text-right">{row.points ?? '--'}</TableCell>
                  <TableCell>{row.role_name ?? '--'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={attackerPager.page} pageCount={attackerPager.pageCount} onPageChange={attackerPager.setPage} className="mt-4" />
        </Card>
      )}

      {goalkeeper.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('tabEstadisticas.goalkeeper.title', 'Stats de portero')}</CardTitle>
              <CardDescription className="mt-1">{t('tabEstadisticas.bySeasonCompetition', 'Por temporada/competición')}</CardDescription>
            </div>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tabEstadisticas.col.season', 'Temporada')}</TableHead>
                <TableHead>{t('tabEstadisticas.col.competition', 'Competición')}</TableHead>
                <TableHead className="text-right">{t('tabEstadisticas.col.gp', 'PJ')}</TableHead>
                <TableHead className="text-right">{t('tabEstadisticas.col.gaa', 'GAA')}</TableHead>
                <TableHead className="text-right">{t('tabEstadisticas.col.saves', 'Atajadas')}</TableHead>
                <TableHead className="text-right">{t('tabEstadisticas.col.savePct', '% atajadas')}</TableHead>
                <TableHead>{t('tabEstadisticas.col.role', 'Rol')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goalkeeperPager.paged.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.season ?? '--'}</TableCell>
                  <TableCell>{row.competition ?? '--'}</TableCell>
                  <TableCell className="text-right">{row.gp ?? '--'}</TableCell>
                  <TableCell className="text-right">{row.gaa?.toFixed(2) ?? '--'}</TableCell>
                  <TableCell className="text-right">{row.saves ?? '--'}</TableCell>
                  <TableCell className="text-right">{row.save_pct !== null && row.save_pct !== undefined ? `${(row.save_pct * 100).toFixed(1)}%` : '--'}</TableCell>
                  <TableCell>{row.gk_role ?? '--'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={goalkeeperPager.page} pageCount={goalkeeperPager.pageCount} onPageChange={goalkeeperPager.setPage} className="mt-4" />
        </Card>
      )}
    </div>
  );
}
