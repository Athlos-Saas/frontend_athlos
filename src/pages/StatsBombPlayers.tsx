/**
 * StatsBombPlayers — perfiles tipo FIFA de los jugadores de StatsBomb.
 *
 * Misma familia visual que la ficha de Atletas (Card, Badge, radar de
 * recharts, StatCard), pero sobre datos de referencia pública de StatsBomb.
 * La grilla muestra tarjetas estilo videojuego (overall + 6 atributos) y al
 * abrir una tarjeta se ve la ficha completa (SbPlayerProfileDialog compartido).
 *
 * Los datos y el cálculo de atributos viven en el backend
 * (StatsBombProfileService); esta página solo consume /v1/statsbomb/profiles.
 */
import { useEffect, useMemo, useState } from 'react';
import { Search, ShieldHalf, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { SbPlayerProfileDialog, ratingColor } from '@/components/statsbomb/SbPlayerProfileDialog';
import { listSbProfiles, type SbPlayerCard } from '@/lib/backendApi';

type LoadState = 'loading' | 'error' | 'ready';

const PAGE_SIZE = 40;

const ATTR_LABELS: Record<string, string> = {
  RIT: 'RIT',
  TIR: 'TIR',
  PAS: 'PAS',
  REG: 'REG',
  DEF: 'DEF',
  FIS: 'FÍS',
};

function AttributePill({ code, value }: { code: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-panel px-2 py-1 text-xs">
      <span className="text-muted-foreground">{ATTR_LABELS[code] ?? code}</span>
      <span className="font-bold" style={{ color: ratingColor(value) }}>
        {value}
      </span>
    </div>
  );
}

function PlayerCardTile({ player, onOpen }: { player: SbPlayerCard; onOpen: () => void }) {
  return (
    <Card
      interactive
      className="cursor-pointer p-4"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen();
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex size-14 shrink-0 items-center justify-center rounded-lg text-lg font-black text-white"
          style={{ background: `linear-gradient(135deg, ${ratingColor(player.overall)}, #0f172a)` }}
        >
          {player.overall}
        </div>
        <div className="flex size-12 items-center justify-center overflow-hidden rounded-full border border-border bg-panel">
          <UserRound className="size-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{player.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {player.country ?? '—'} · {player.matches} PJ
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {(['RIT', 'TIR', 'PAS', 'REG', 'DEF', 'FIS'] as const).map((code) => (
          <AttributePill key={code} code={code} value={player.attributes[code]} />
        ))}
      </div>
    </Card>
  );
}

export default function StatsBombPlayers() {
  const { t } = useTranslation();
  const [state, setState] = useState<LoadState>('loading');
  const [players, setPlayers] = useState<SbPlayerCard[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('overall');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let mounted = true;
    setState('loading');
    listSbProfiles({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, search: debouncedSearch, sortBy })
      .then((data) => {
        if (!mounted) return;
        setPlayers(data.players);
        setTotal(data.total);
        setState('ready');
      })
      .catch(() => {
        if (!mounted) return;
        setState('error');
      });
    return () => {
      mounted = false;
    };
  }, [page, debouncedSearch, sortBy]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <ShieldHalf className="size-6 text-ai" aria-hidden="true" />
            {t('sbPlayers.title', 'Jugadores Benchmark')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('sbPlayers.subtitle', 'Perfiles de jugador con atributos y radar, sobre datos profesionales de referencia')}
          </p>
        </div>
        <Badge variant="ai" className="gap-1.5">
          {total.toLocaleString()} {t('sbPlayers.playersCount', 'jugadores')}
        </Badge>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('sbPlayers.searchPlaceholder', 'Buscar jugador…')}
            className="focus-ring h-9 w-full rounded-md border border-border bg-panel pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(0); }}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="overall">{t('sbPlayers.sort.overall', 'Overall')}</SelectItem>
            <SelectItem value="TIR">{t('sbPlayers.sort.shooting', 'Tiro')}</SelectItem>
            <SelectItem value="PAS">{t('sbPlayers.sort.passing', 'Pase')}</SelectItem>
            <SelectItem value="REG">{t('sbPlayers.sort.dribbling', 'Regate')}</SelectItem>
            <SelectItem value="DEF">{t('sbPlayers.sort.defending', 'Defensa')}</SelectItem>
            <SelectItem value="RIT">{t('sbPlayers.sort.pace', 'Ritmo')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {state === 'error' ? (
        <ErrorState
          title={t('sbPlayers.loadError', 'No se pudo cargar los jugadores')}
          description={t('sbPlayers.loadErrorDesc', '¿El backend está corriendo y hay datos de benchmark ingestados?')}
          onRetry={() => setPage((p) => p)}
        />
      ) : state === 'loading' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {players.map((p) => (
              <PlayerCardTile key={p.player_id} player={p} onOpen={() => setSelected(p.player_id)} />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-center gap-4 text-sm">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="focus-ring rounded-md border border-border bg-panel px-3 py-1.5 disabled:opacity-40"
            >
              {t('sbPlayers.prev', 'Anterior')}
            </button>
            <span className="text-muted-foreground">
              {t('sbPlayers.pageOf', 'Página {{page}} de {{total}}', { page: page + 1, total: totalPages })}
            </span>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="focus-ring rounded-md border border-border bg-panel px-3 py-1.5 disabled:opacity-40"
            >
              {t('sbPlayers.next', 'Siguiente')}
            </button>
          </div>
        </>
      )}

      <SbPlayerProfileDialog playerId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
