import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import { FIELDS, type BoardObject, type Drill } from './engine';

/**
 * Plantel de la organización para las fichas del equipo propio (equipo A) de
 * la pizarra. Lectura directa a Supabase con la key ANON: el aislamiento por
 * org lo da RLS, igual que Equipos o el Módulo entrenador (mismas columnas).
 *
 * Solo se piden id, nombre y posición — nada de salud ni biométrico: la pizarra
 * guarda el `playerId` y el nombre corto dentro del documento (`data` jsonb de
 * training_sessions), que cualquier miembro de la org puede leer.
 *
 * `players` no tiene columna de dorsal (001_schema.sql), así que el número de
 * la ficha sigue siendo el de la pizarra (lo pone la formación o el entrenador).
 */

export interface RosterTeam {
  id: string;
  name: string;
  season: string | null;
}

export interface RosterPlayer {
  id: string;
  full_name: string;
  position: string | null;
}

export function useRosterTeams(orgId: string) {
  return useQuery({
    queryKey: ['tacticalBoard', 'teams', orgId],
    queryFn: async (): Promise<RosterTeam[]> => {
      const { data, error } = await supabase.from('teams').select('id, name, season').eq('org_id', orgId).order('season', { ascending: false });
      if (error) throw error;
      return (data as RosterTeam[]) ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useRosterPlayers(orgId: string, teamId: string | null) {
  return useQuery({
    queryKey: ['tacticalBoard', 'players', orgId, teamId],
    enabled: !!teamId,
    queryFn: async (): Promise<RosterPlayer[]> => {
      const { data, error } = await supabase
        .from('players')
        .select('id, full_name, position')
        .eq('org_id', orgId)
        .eq('team_id', teamId as string)
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return (data as RosterPlayer[]) ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Nombre que cabe debajo de la ficha (el SVG no recorta texto): hasta 16
 * caracteres se deja completo; si no, inicial + resto ("J. Pérez García") y,
 * si aún no cabe, inicial + segunda palabra. No hay regla perfecta para
 * nombres compuestos vs. dos apellidos; el nombre completo se ve en el selector.
 */
export function shortName(full: string): string {
  const clean = full.trim().replace(/\s+/g, ' ');
  if (clean.length <= 16) return clean;
  const words = clean.split(' ');
  if (words.length < 2) return clean.slice(0, 16);
  const rest = `${words[0][0]}. ${words.slice(1).join(' ')}`;
  if (rest.length <= 18) return rest;
  return `${words[0][0]}. ${words[1]}`.slice(0, 18);
}

/* ---------- Auto-asignación por posición (frontera de deporte: FÚTBOL) ----------
 *
 * `players.position` es texto libre (importado de CSV en español o inglés), así
 * que se clasifica por palabras clave. Esto SOLO tiene sentido en fútbol
 * (campos f11/half/f7/sala/libre); en baloncesto u otro deporte las fichas se
 * rellenan en orden sin mirar la posición. Si ATHLOS suma un deporte con
 * posiciones propias, este es el único sitio a tocar.
 */

export type PositionGroup = 'gk' | 'def' | 'mid' | 'fwd';

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Orden de evaluación: portero → medio → defensa → ataque. "Defensive
// midfielder" debe ser medio y "wing back" defensa, por eso medio va antes que
// defensa y defensa antes que ataque.
const GROUP_WORDS: [PositionGroup, string[], string[]][] = [
  ['gk', ['goalkeeper', 'keeper', 'portero', 'arquero', 'guardameta', 'goleiro'], ['gk', 'por', 'pt']],
  ['mid', ['midfield', 'medio', 'volante', 'pivote', 'centrocampista', 'interior', 'enganche'], ['cm', 'dm', 'am', 'mc', 'mcd', 'mco', 'mf', 'cdm', 'cam', 'mi', 'md']],
  ['def', ['defen', 'central', 'lateral', 'back', 'carrilero', 'libero', 'zaguero'], ['cb', 'lb', 'rb', 'df', 'dfc', 'lwb', 'rwb', 'li', 'ld']],
  ['fwd', ['forward', 'delantero', 'attack', 'atacante', 'striker', 'extremo', 'wing', 'punta', 'ariete'], ['st', 'cf', 'fw', 'lw', 'rw', 'ed', 'ei', 'ss']],
];

export function positionGroup(position: string | null | undefined): PositionGroup | null {
  if (!position) return null;
  const p = norm(position);
  const tokens = p.split(/[^a-z]+/).filter(Boolean);
  for (const [group, words, abbr] of GROUP_WORDS) {
    if (words.some((w) => p.includes(w)) || tokens.some((tk) => abbr.includes(tk))) return group;
  }
  return null;
}

/**
 * Línea que ocupa una ficha del equipo A según su profundidad en el campo.
 * Umbrales sacados de FORMS (engine.ts): defensas en x≈0.16-0.19 del largo,
 * medios en 0.26-0.37 y delanteros en 0.42-0.44.
 */
function tokenGroup(d: Drill, o: BoardObject): PositionGroup | null {
  const f = FIELDS[d.field] ?? FIELDS.f11;
  if (f.kind === 'basket') return null;
  if (o.gk) return 'gk';
  const L = f.L * 10;
  const ax = f.half ? L / 2 : 0;
  const aw = f.half ? L / 2 : L;
  const fx = (o.x - ax) / aw;
  if (fx < 0.225) return 'def';
  if (fx < 0.385) return 'mid';
  return 'fwd';
}

export const isOwnPlayerToken = (o: BoardObject) => o.kind === 'player' && (o.team ?? 'a') === 'a';

/** Ids de jugador ya puestos en fichas de este ejercicio (opcionalmente excluyendo una ficha). */
export function usedPlayerIds(d: Drill, exceptObjectId?: string): Set<string> {
  const used = new Set<string>();
  d.objects.forEach((o) => {
    if (o.playerId && o.id !== exceptObjectId) used.add(o.playerId);
  });
  return used;
}

export function assignPlayer(o: BoardObject, p: RosterPlayer | null) {
  if (p) {
    o.playerId = p.id;
    o.name = shortName(p.full_name);
  } else {
    delete o.playerId;
    o.name = '';
  }
}

/**
 * Rellena las fichas libres del equipo A con jugadores aún no usados en el
 * ejercicio. Primero por posición (porteros primero, luego de atrás hacia
 * delante); lo que quede, en orden alfabético evitando poner un portero de
 * campo mientras haya jugadores de campo. Devuelve cuántas fichas asignó.
 */
export function autoAssign(d: Drill, players: RosterPlayer[]): number {
  const used = usedPlayerIds(d);
  const pool = players.filter((p) => !used.has(p.id));
  const tokens = d.objects
    .filter((o) => isOwnPlayerToken(o) && !o.playerId)
    .map((o) => ({ o, want: tokenGroup(d, o) }))
    .sort((a, b) => (a.want === 'gk' ? -1 : b.want === 'gk' ? 1 : a.o.x - b.o.x));
  const take = (pred: (p: RosterPlayer) => boolean): RosterPlayer | null => {
    const i = pool.findIndex(pred);
    return i < 0 ? null : pool.splice(i, 1)[0];
  };
  let n = 0;
  const pending: typeof tokens = [];
  for (const tk of tokens) {
    const p = tk.want ? take((x) => positionGroup(x.position) === tk.want) : null;
    if (p) {
      assignPlayer(tk.o, p);
      n++;
    } else pending.push(tk);
  }
  for (const tk of pending) {
    const p = tk.want === 'gk' ? take(() => true) : (take((x) => positionGroup(x.position) !== 'gk') ?? take(() => true));
    if (!p) break;
    assignPlayer(tk.o, p);
    n++;
  }
  return n;
}
