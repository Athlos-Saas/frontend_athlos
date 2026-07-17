import { useEffect, useState } from 'react';

import EmptyState from '../components/EmptyState';
import Loader from '../components/Loader';
import { supabase } from '../lib/supabase';

const STATUS_BADGE = {
  uploaded: 'badge-blue',
  processing: 'badge-gold',
  done: 'badge-green',
  failed: 'badge-red',
};

export default function Videos({ orgId }) {
  const [videos, setVideos] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoTitle, setVideoTitle] = useState('Partido sin título');
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [tracks, setTracks] = useState([]);

  const loadVideos = () => {
    supabase
      .from('video_analyses')
      .select('id, title, status, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setVideos(data ?? []));
  };

  useEffect(loadVideos, [orgId]);

  useEffect(() => {
    if (!selectedVideoId) {
      setTracks([]);
      return;
    }
    supabase
      .from('video_player_tracks')
      .select('track_id, distance_m, time_visible_s, avg_speed_kmh, max_speed_kmh')
      .eq('video_id', selectedVideoId)
      .order('distance_m', { ascending: false })
      .then(({ data }) => setTracks(data ?? []));
  }, [selectedVideoId]);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setMessage(null);

    const storagePath = `${orgId}/raw/${Date.now()}-${selectedFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(storagePath, selectedFile, { contentType: selectedFile.type, upsert: true });

    if (uploadError) {
      setMessage({ kind: 'alert-error', text: `Error al subir: ${uploadError.message}` });
      setIsUploading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from('video_analyses')
      .insert({ org_id: orgId, title: videoTitle, storage_path: storagePath });

    setMessage(
      insertError
        ? { kind: 'alert-error', text: `Error al registrar: ${insertError.message}` }
        : {
            kind: 'alert-success',
            text: 'Video registrado. El worker del backend lo procesará (POST /v1/videos/{id}/process).',
          },
    );
    setSelectedFile(null);
    setIsUploading(false);
    loadVideos();
  };

  if (videos === null) return <Loader />;

  const doneVideos = videos.filter((video) => video.status === 'done');

  return (
    <>
      <h1>Video análisis</h1>
      <p className="page-subtitle">Computer vision: tracking de jugadores desde video convencional</p>

      <div className="card mb">
        <h2>Subir video</h2>
        {message && <div className={`alert ${message.kind}`}>{message.text}</div>}
        <div className="field">
          <label htmlFor="title">Título</label>
          <input
            id="title"
            className="input"
            value={videoTitle}
            onChange={(event) => setVideoTitle(event.target.value)}
          />
        </div>
        <div className="row">
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
          <button className="btn" onClick={handleUpload} disabled={!selectedFile || isUploading}>
            {isUploading ? 'Subiendo…' : 'Subir y registrar'}
          </button>
        </div>
      </div>

      <div className="card mb">
        <h2>Videos de la organización</h2>
        {videos.length === 0 ? (
          <EmptyState>Aún no hay videos.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Título</th><th>Estado</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr key={video.id}>
                  <td>{video.title}</td>
                  <td><span className={`badge ${STATUS_BADGE[video.status] || 'badge-blue'}`}>{video.status}</span></td>
                  <td style={{ color: 'var(--muted)' }}>{new Date(video.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {doneVideos.length > 0 && (
        <div className="card">
          <h2>Tracks por jugador</h2>
          <div className="field" style={{ maxWidth: 360 }}>
            <label htmlFor="video">Video procesado</label>
            <select
              id="video"
              className="select"
              value={selectedVideoId}
              onChange={(event) => setSelectedVideoId(event.target.value)}
            >
              <option value="">Selecciona…</option>
              {doneVideos.map((video) => (
                <option key={video.id} value={video.id}>{video.title}</option>
              ))}
            </select>
          </div>
          {selectedVideoId && tracks.length === 0 && (
            <EmptyState>Ese video no tiene tracks registrados.</EmptyState>
          )}
          {tracks.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>Track</th>
                  <th>Distancia (m)</th>
                  <th>Tiempo visible (s)</th>
                  <th>Vel. media (km/h)</th>
                  <th>Vel. máx (km/h)</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((track) => (
                  <tr key={track.track_id}>
                    <td>J{track.track_id}</td>
                    <td>{Number(track.distance_m).toFixed(1)}</td>
                    <td>{Number(track.time_visible_s).toFixed(1)}</td>
                    <td>{Number(track.avg_speed_kmh).toFixed(1)}</td>
                    <td>{Number(track.max_speed_kmh).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
