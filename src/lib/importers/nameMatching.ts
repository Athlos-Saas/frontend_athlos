import type { Player } from '@/types/domain';

/**
 * Puerto de match_player_id (league_stats_loader.py, atlos-backend). Empareja
 * el nombre abreviado de liga ("A Roper") con el nombre completo del roster
 * ("Atim Roper") por inicial + apellido. `players` debe ser el roster propio
 * de la organización (nunca incluye rivales/scouting), así que estos quedan
 * sin `player_id` a propósito: no hay con qué matchearlos.
 */

function nameKey(fullName: string): string | null {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const initial = parts[0][0]?.toLowerCase();
  const lastName = parts[parts.length - 1].toLowerCase();
  return `${initial}|${lastName}`;
}

export function matchPlayerId(playerName: string, players: Player[]): string | null {
  const key = nameKey(playerName);
  if (!key) return null;
  const match = players.find((player) => nameKey(player.full_name) === key);
  return match?.id ?? null;
}
