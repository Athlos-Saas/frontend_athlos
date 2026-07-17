import { useEffect, useState } from 'react';

import EmptyState from '../components/EmptyState';
import Loader from '../components/Loader';
import { supabase } from '../lib/supabase';

const TODAY = new Date().toISOString().slice(0, 10);

const INITIAL_FORM = {
  entry_date: TODAY,
  rpe: 5,
  sleep_hours: 7.5,
  sleep_quality: 3,
  soreness: 2,
  mood: 4,
  notes: '',
};

function SliderField({ id, label, min, max, step = 1, value, onChange }) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}: <strong style={{ color: 'var(--green)' }}>{value}</strong>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
}

export default function Wellness({ orgId }) {
  const [players, setPlayers] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [form, setForm] = useState(INITIAL_FORM);
  const [message, setMessage] = useState(null);
  const [entries, setEntries] = useState([]);

  const setField = (key) => (value) => setForm((previous) => ({ ...previous, [key]: value }));

  const loadEntries = () => {
    supabase
      .from('wellness_entries')
      .select('entry_date, player_id, rpe, sleep_hours, soreness, mood')
      .eq('org_id', orgId)
      .order('entry_date', { ascending: false })
      .limit(60)
      .then(({ data }) => setEntries(data ?? []));
  };

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
    loadEntries();
  }, [orgId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);
    const { error } = await supabase.from('wellness_entries').upsert(
      {
        org_id: orgId,
        player_id: selectedPlayerId,
        entry_date: form.entry_date,
        rpe: form.rpe,
        sleep_hours: form.sleep_hours,
        sleep_quality: form.sleep_quality,
        soreness: form.soreness,
        mood: form.mood,
        notes: form.notes || null,
      },
      { onConflict: 'player_id,entry_date' },
    );
    setMessage(
      error
        ? { kind: 'alert-error', text: `Error: ${error.message}` }
        : { kind: 'alert-success', text: 'Wellness guardado.' },
    );
    if (!error) loadEntries();
  };

  if (players === null) return <Loader />;
  if (players.length === 0) {
    return (
      <>
        <h1>Wellness diario</h1>
        <EmptyState>Aún no hay jugadores registrados.</EmptyState>
      </>
    );
  }

  const idToName = Object.fromEntries(players.map((player) => [player.id, player.full_name]));

  return (
    <>
      <h1>Wellness diario</h1>
      <p className="page-subtitle">RPE, sueño y dolor — la variable que falta para modelar riesgo de lesión</p>

      <div className="grid grid-2">
        <div className="card">
          <h2>Registrar</h2>
          {message && <div className={`alert ${message.kind}`}>{message.text}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
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
            <div className="field">
              <label htmlFor="entry_date">Fecha</label>
              <input
                id="entry_date"
                type="date"
                className="input"
                value={form.entry_date}
                onChange={(event) => setField('entry_date')(event.target.value)}
              />
            </div>
            <SliderField id="rpe" label="RPE (esfuerzo percibido)" min={0} max={10} value={form.rpe} onChange={setField('rpe')} />
            <SliderField id="sleep_hours" label="Horas de sueño" min={0} max={14} step={0.5} value={form.sleep_hours} onChange={setField('sleep_hours')} />
            <SliderField id="sleep_quality" label="Calidad de sueño" min={1} max={5} value={form.sleep_quality} onChange={setField('sleep_quality')} />
            <SliderField id="soreness" label="Dolor muscular" min={0} max={10} value={form.soreness} onChange={setField('soreness')} />
            <SliderField id="mood" label="Ánimo" min={1} max={5} value={form.mood} onChange={setField('mood')} />
            <div className="field">
              <label htmlFor="notes">Notas</label>
              <textarea
                id="notes"
                className="textarea"
                rows={2}
                value={form.notes}
                onChange={(event) => setField('notes')(event.target.value)}
              />
            </div>
            <button className="btn" type="submit">Guardar</button>
          </form>
        </div>

        <div className="card">
          <h2>Últimos registros</h2>
          {entries.length === 0 ? (
            <EmptyState>Todavía no hay registros de wellness.</EmptyState>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Fecha</th><th>Jugador</th><th>RPE</th><th>Sueño</th><th>Dolor</th><th>Ánimo</th></tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={index}>
                    <td>{entry.entry_date}</td>
                    <td>{idToName[entry.player_id] ?? '—'}</td>
                    <td>{entry.rpe}</td>
                    <td>{entry.sleep_hours}h</td>
                    <td>
                      <span className={`badge ${entry.soreness >= 6 ? 'badge-red' : 'badge-green'}`}>
                        {entry.soreness}
                      </span>
                    </td>
                    <td>{entry.mood}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
