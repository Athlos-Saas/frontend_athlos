import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import EmptyState from '../components/EmptyState';
import Loader from '../components/Loader';
import { COLORS } from '../lib/theme';
import { supabase } from '../lib/supabase';

export default function Liga({ orgId }) {
  const [season, setSeason] = useState('2025');
  const [attackers, setAttackers] = useState(null);

  useEffect(() => {
    supabase
      .from('league_attacker_stats')
      .select('player_name, team_name, goals, proba_top_scorer, role_name')
      .eq('org_id', orgId)
      .eq('season', season)
      .order('proba_top_scorer', { ascending: false, nullsFirst: false })
      .limit(30)
      .then(({ data }) => setAttackers(data ?? []));
  }, [orgId, season]);

  if (attackers === null) return <Loader />;

  const roleCounts = Object.entries(
    attackers.reduce((accumulator, row) => {
      if (!row.role_name) return accumulator;
      accumulator[row.role_name] = (accumulator[row.role_name] || 0) + 1;
      return accumulator;
    }, {}),
  ).map(([rol, jugadores]) => ({ rol, jugadores }));

  return (
    <>
      <h1>Liga · goleadores y roles</h1>
      <p className="page-subtitle">
        Clasificador de goleador de élite (AUC 0.891) y clustering de roles ofensivos
      </p>

      <div className="field" style={{ maxWidth: 200 }}>
        <label htmlFor="season">Temporada</label>
        <input
          id="season"
          className="input"
          value={season}
          onChange={(event) => setSeason(event.target.value)}
        />
      </div>

      {attackers.length === 0 ? (
        <EmptyState>Sin estadísticas de liga para esa temporada.</EmptyState>
      ) : (
        <>
          <div className="card mb">
            <h2>Top 30 por probabilidad de goleador de élite</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jugador</th>
                  <th>Equipo</th>
                  <th>Goles</th>
                  <th>Prob. élite</th>
                  <th>Rol</th>
                </tr>
              </thead>
              <tbody>
                {attackers.map((row, index) => (
                  <tr key={`${row.player_name}-${row.team_name}`}>
                    <td style={{ color: 'var(--muted)' }}>{index + 1}</td>
                    <td>{row.player_name}</td>
                    <td style={{ color: 'var(--muted)' }}>{row.team_name}</td>
                    <td>{row.goals}</td>
                    <td>
                      <span className={`badge ${Number(row.proba_top_scorer) >= 0.5 ? 'badge-green' : 'badge-blue'}`}>
                        {(Number(row.proba_top_scorer) * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{row.role_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {roleCounts.length > 0 && (
            <div className="card">
              <h2>Distribución de roles (top 30)</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={roleCounts}>
                  <CartesianGrid stroke="#1e3252" />
                  <XAxis dataKey="rol" stroke={COLORS.muted} fontSize={12} />
                  <YAxis allowDecimals={false} stroke={COLORS.muted} fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: COLORS.card,
                      border: '1px solid #2a4066',
                      borderRadius: 8,
                      color: COLORS.white,
                    }}
                  />
                  <Bar dataKey="jugadores" fill={COLORS.green} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </>
  );
}
