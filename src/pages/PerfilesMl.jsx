import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

import EmptyState from '../components/EmptyState';
import Loader from '../components/Loader';
import { COLORS, PROFILE_COLORS } from '../lib/theme';
import { supabase } from '../lib/supabase';

export default function PerfilesMl({ orgId }) {
  const [profiles, setProfiles] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [predictions, players] = await Promise.all([
        supabase
          .from('ml_predictions')
          .select('player_id, label, features')
          .eq('org_id', orgId)
          .eq('prediction_type', 'physical_profile'),
        supabase.from('players').select('id, full_name').eq('org_id', orgId),
      ]);

      const idToName = Object.fromEntries(
        (players.data ?? []).map((player) => [player.id, player.full_name]),
      );
      const rows = (predictions.data ?? []).map((prediction) => ({
        jugador: idToName[prediction.player_id] ?? prediction.player_id,
        perfil: prediction.label,
        ...(prediction.features || {}),
      }));
      setProfiles(rows);
    };
    load();
  }, [orgId]);

  if (profiles === null) return <Loader />;

  const profileNames = [...new Set(profiles.map((row) => row.perfil))];

  return (
    <>
      <h1>Perfiles físicos</h1>
      <p className="page-subtitle">
        Clusters K-Means sobre medias por jugador (distancia, sprint, velocidad, Player Load)
      </p>

      {profiles.length === 0 ? (
        <EmptyState>Sin perfiles todavía — corre <code>run_training.py</code> en el backend.</EmptyState>
      ) : (
        <>
          <div className="card mb">
            <h2>Sprint vs Player Load</h2>
            <ResponsiveContainer width="100%" height={340}>
              <ScatterChart>
                <CartesianGrid stroke="#1e3252" />
                <XAxis
                  type="number"
                  dataKey="sprint_distance_m"
                  name="Sprint (m)"
                  stroke={COLORS.muted}
                  fontSize={12}
                />
                <YAxis
                  type="number"
                  dataKey="player_load"
                  name="Player Load"
                  stroke={COLORS.muted}
                  fontSize={12}
                />
                <ZAxis type="number" dataKey="top_speed_kmh" range={[60, 260]} name="Vel. máx" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{
                    backgroundColor: COLORS.card,
                    border: '1px solid #2a4066',
                    borderRadius: 8,
                    color: COLORS.white,
                  }}
                  formatter={(value, name) => [Number(value).toFixed(1), name]}
                  labelFormatter={() => ''}
                />
                <Legend />
                {profileNames.map((name) => (
                  <Scatter
                    key={name}
                    name={name}
                    data={profiles.filter((row) => row.perfil === name)}
                    fill={PROFILE_COLORS[name] || COLORS.blue}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h2>Jugadores por perfil</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th>Perfil</th>
                  <th>Dist. media (km)</th>
                  <th>Sprint medio (m)</th>
                  <th>Vel. máx media</th>
                  <th>Player Load medio</th>
                </tr>
              </thead>
              <tbody>
                {[...profiles]
                  .sort((a, b) => (a.perfil > b.perfil ? 1 : -1))
                  .map((row) => (
                    <tr key={row.jugador}>
                      <td>{row.jugador}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: `${PROFILE_COLORS[row.perfil] || COLORS.blue}26`,
                            color: PROFILE_COLORS[row.perfil] || COLORS.blue,
                          }}
                        >
                          {row.perfil}
                        </span>
                      </td>
                      <td>{Number(row.distance_km ?? 0).toFixed(2)}</td>
                      <td>{Number(row.sprint_distance_m ?? 0).toFixed(0)}</td>
                      <td>{Number(row.top_speed_kmh ?? 0).toFixed(1)}</td>
                      <td>{Number(row.player_load ?? 0).toFixed(0)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
