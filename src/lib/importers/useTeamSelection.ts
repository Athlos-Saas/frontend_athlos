import { useEffect, useState } from 'react';

import { fetchTeams, type TeamOption } from '@/lib/importers/playerLookup';

/**
 * Resuelve a qué `team_id` deben atarse los jugadores nuevos al importar
 * roster/GPS. Con un solo equipo (el caso normal) lo elige solo; con más de
 * uno, el caller debe mostrar un selector con `teams`.
 */
export function useTeamSelection(orgId: string) {
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamId, setTeamId] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    fetchTeams(orgId)
      .then((result) => {
        if (!isMounted) return;
        setTeams(result);
        if (result.length === 1) setTeamId(result[0].id);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [orgId]);

  return { teams, teamId, setTeamId, isLoading };
}
