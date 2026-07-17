import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import EmptyState from '../components/EmptyState';
import Loader from '../components/Loader';
import { COLORS } from '../lib/theme';
import { supabase } from '../lib/supabase';

const TOOLTIP_STYLE = {
  backgroundColor: COLORS.card,
  border: '1px solid #2a4066',
  borderRadius: 8,
  color: COLORS.white,
};

export default function CargasGps({ orgId }) {
  const [players, setPlayers] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    supabase
      .from('players')
      .select('id, full_name')
      .eq('org_id', orgId)
      .order('full_name')
      .then(({ data }) => {
        setPlayers(data ?? []);
        if (data?.length) setSelectedPlayerId(data[0].id);
      });
  }, [orgId]);

  useEffect(() => {
    if (!selectedPlayerId) return;
    supabase
      .from('gps_sessions')
      .select('session_date, distance_km, sprint_distance_m, top_speed_kmh, player_load')
      .eq('player_id', selectedPlayerId)
      .order('session_date')
      .then(({ data }) => setSessions(data ?? []));

    supabase
      .from('ml_predictions')
      .select('prediction_type, label, score, created_at')
      .eq('player_id', selectedPlayerId)
      .in('prediction_type', ['fatigue_risk', 'anomaly'])
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setAlerts(data ?? []));
  }, [selectedPlayerId]);

  if (players === null) return <Loader />;
  if (players.length === 0) {
    return (
      <>
        <h1>Cargas GPS</h1>
        <EmptyState>Aún no hay jugadores. Corre el seed del backend.</EmptyState>
      </>
    );
  }

  const activeAlerts = alerts.filter((alert) => ['alto', 'anomala'].includes(alert.label));

  return (
    <>
      <h1>Cargas GPS</h1>
      <p className="page-subtitle">Monitoreo físico por sesión con alertas del modelo</p>

      <div className="field" style={{ maxWidth: 320 }}>
        <label htmlFor="player">Jugador</label>
        <select
          id="player"
          className="select"
          value={selectedPlayerId}
          onChange={(event) => setSelectedPlayerId(event.target.value)}
        >
          {players.map((player) => (
            <option key={player.id} value={player.id}>{player.full_name}</option>
          ))}
        </select>
      </div>

      {sessions.length === 0 ? (
        <EmptyState>Este jugador no tiene sesiones registradas.</EmptyState>
      ) : (
        <div className="grid grid-2 mb">
          <div className="card">
            <h2>Player Load por sesión</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={sessions}>
                <CartesianGrid stroke="#1e3252" />
                <XAxis dataKey="session_date" stroke={COLORS.muted} fontSize={12} />
                <YAxis stroke={COLORS.muted} fontSize={12} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line
                  type="monotone"
                  dataKey="player_load"
                  name="Player Load"
                  stroke={COLORS.green}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h2>Velocidad máxima (km/h)</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={sessions}>
                <CartesianGrid stroke="#1e3252" />
                <XAxis dataKey="session_date" stroke={COLORS.muted} fontSize={12} />
                <YAxis stroke={COLORS.muted} fontSize={12} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="top_speed_kmh" name="Vel. máx" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Alertas del modelo</h2>
        {alerts.length === 0 && (
          <EmptyState>Sin predicciones aún — corre <code>run_training.py</code>.</EmptyState>
        )}
        {alerts.length > 0 && activeAlerts.length === 0 && (
          <div className="alert alert-success">Sin alertas de fatiga ni sesiones anómalas recientes.</div>
        )}
        {activeAlerts.length > 0 && (
          <>
            <div className="alert alert-warn">{activeAlerts.length} alertas activas para este jugador.</div>
            <table className="table">
              <thead>
                <tr><th>Tipo</th><th>Etiqueta</th><th>Score</th><th>Fecha</th></tr>
              </thead>
              <tbody>
                {activeAlerts.map((alert, index) => (
                  <tr key={index}>
                    <td>{alert.prediction_type === 'fatigue_risk' ? 'Fatiga' : 'Anomalía'}</td>
                    <td>
                      <span className={`badge ${alert.label === 'alto' ? 'badge-red' : 'badge-gold'}`}>
                        {alert.label}
                      </span>
                    </td>
                    <td>{Number(alert.score).toFixed(3)}</td>
                    <td style={{ color: 'var(--muted)' }}>{new Date(alert.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}
