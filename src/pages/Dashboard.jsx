import { useEffect, useState } from 'react';

import EmptyState from '../components/EmptyState';
import Loader from '../components/Loader';
import StatCard from '../components/StatCard';
import { COLORS } from '../lib/theme';
import { supabase } from '../lib/supabase';

export default function Dashboard({ orgId }) {
  const [stats, setStats] = useState(null);
  const [models, setModels] = useState([]);

  useEffect(() => {
    const load = async () => {
      const [players, sessions, videos, latestModels] = await Promise.all([
        supabase.from('players').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
        supabase.from('gps_sessions').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
        supabase.from('video_analyses').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
        supabase
          .from('ml_models')
          .select('name, version, task, metrics, trained_at')
          .eq('org_id', orgId)
          .order('trained_at', { ascending: false })
          .limit(6),
      ]);
      setStats({
        players: players.count ?? 0,
        sessions: sessions.count ?? 0,
        videos: videos.count ?? 0,
      });
      setModels(latestModels.data ?? []);
    };
    load();
  }, [orgId]);

  if (!stats) return <Loader />;

  return (
    <>
      <h1>Panel general</h1>
      <p className="page-subtitle">Resumen de la organización</p>

      <div className="grid grid-3 mb">
        <StatCard label="Jugadores" value={stats.players} />
        <StatCard label="Sesiones GPS" value={stats.sessions} accent={COLORS.blue} />
        <StatCard label="Videos analizados" value={stats.videos} accent={COLORS.gold} />
      </div>

      <div className="card">
        <h2>Últimos modelos entrenados</h2>
        {models.length === 0 ? (
          <EmptyState>Sin modelos aún — corre <code>run_training.py</code> en el backend.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Tarea</th>
                <th>Versión</th>
                <th>Métricas clave</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr key={`${model.name}-${model.version}`}>
                  <td>{model.name}</td>
                  <td><span className="badge badge-blue">{model.task}</span></td>
                  <td>{model.version}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>
                    {Object.entries(model.metrics || {})
                      .slice(0, 3)
                      .map(([key, value]) => `${key}: ${typeof value === 'number' ? value.toFixed(3) : JSON.stringify(value)}`)
                      .join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
