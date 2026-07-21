import { supabase } from '@/lib/supabase';

/**
 * Espejo de SupabaseRepository.get_or_create_players (atlos-backend): busca
 * jugadores existentes del equipo por nombre y crea los que falten.
 * Devuelve `{nombre: player_id}`.
 */
export async function getOrCreatePlayers(
  orgId: string,
  teamId: string,
  fullNames: string[],
): Promise<Record<string, string>> {
  const { data: existing, error: fetchError } = await supabase
    .from('players')
    .select('id, full_name')
    .eq('team_id', teamId);
  if (fetchError) throw fetchError;

  const nameToId: Record<string, string> = {};
  for (const row of existing ?? []) nameToId[row.full_name] = row.id;

  const missing = [...new Set(fullNames)].filter((name) => !(name in nameToId));
  if (missing.length > 0) {
    const { data: created, error: insertError } = await supabase
      .from('players')
      .insert(missing.map((full_name) => ({ org_id: orgId, team_id: teamId, full_name })))
      .select('id, full_name');
    if (insertError) throw insertError;
    for (const row of created ?? []) nameToId[row.full_name] = row.id;
  }

  return nameToId;
}

export interface TeamOption {
  id: string;
  name: string;
  season: string;
}

export async function fetchTeams(orgId: string): Promise<TeamOption[]> {
  const { data, error } = await supabase.from('teams').select('id, name, season').eq('org_id', orgId);
  if (error) throw error;
  return data ?? [];
}
