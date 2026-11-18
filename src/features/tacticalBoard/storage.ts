import { supabase } from '@/lib/supabase';

import type { TrainingSession } from './engine';

/**
 * Persistencia de la pizarra: Supabase (`training_sessions`, migración 026)
 * como fuente de verdad + localStorage como copia del dispositivo.
 *
 * Mismo modelo que el prototipo "Tiza" (nube de la cuenta + dispositivo):
 * cada guardado escribe primero en localStorage (nunca se pierde un cambio
 * aunque la red falle) y después en la nube. Al abrir, lo que exista solo en
 * este dispositivo se sube a la cuenta.
 *
 * Por qué Supabase directo y no un endpoint del backend FastAPI: la pizarra
 * autoguarda cada ~650 ms mientras se edita, y el backend en Render free se
 * duerme sin tráfico (30-50 s para despertar) — un guardado no puede depender
 * de eso. El aislamiento lo da RLS (cada usuario edita solo sus sesiones),
 * igual que video_analyses o players.
 */

const TABLE = 'training_sessions';

export type SaveStatus = 'cloud' | 'local' | 'saving' | 'error';

/** Error tipado para que la UI distinga "sin espacio" de "sin red". */
export class CloudSaveError extends Error {
  constructor(
    message: string,
    readonly kind: 'quota' | 'other',
  ) {
    super(message);
  }
}

export interface DeviceStore {
  get(): Record<string, TrainingSession>;
  put(s: TrainingSession): boolean;
  del(id: string): void;
  last(): string | null;
  setLast(id: string): void;
}

/** localStorage por usuario+org: dos cuentas en el mismo navegador no se mezclan. */
export function deviceStore(userId: string, orgId: string): DeviceStore {
  const key = `athlos:tacticalBoard:${orgId}:${userId}:sessions`;
  const lastKey = `athlos:tacticalBoard:${orgId}:${userId}:last`;
  const get = (): Record<string, TrainingSession> => {
    try {
      return (JSON.parse(localStorage.getItem(key) || '{}') as Record<string, TrainingSession>) || {};
    } catch {
      return {};
    }
  };
  return {
    get,
    put(s) {
      try {
        const m = get();
        m[s.id] = s;
        localStorage.setItem(key, JSON.stringify(m));
        localStorage.setItem(lastKey, s.id);
        return true;
      } catch {
        return false;
      }
    },
    del(id) {
      try {
        const m = get();
        delete m[id];
        localStorage.setItem(key, JSON.stringify(m));
      } catch {
        // storage bloqueado: la nube sigue siendo la fuente de verdad
      }
    },
    last() {
      try {
        return localStorage.getItem(lastKey);
      } catch {
        return null;
      }
    },
    setLast(id) {
      try {
        localStorage.setItem(lastKey, id);
      } catch {
        // idem
      }
    },
  };
}

interface Row {
  id: string;
  data: TrainingSession;
}

/** Sesiones del usuario en la nube ("Mis sesiones"). Lanza si la consulta falla. */
export async function fetchCloudSessions(userId: string, orgId: string): Promise<TrainingSession[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, data')
    .eq('org_id', orgId)
    .eq('created_by', userId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as Row[]) ?? []).map((r) => ({ ...r.data, id: r.id }));
}

export async function saveCloudSession(orgId: string, s: TrainingSession): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert(
    {
      id: s.id,
      org_id: orgId,
      title: s.title || '',
      session_date: s.date || null,
      team_label: s.team || null,
      data: s,
      updated_at: new Date(s.updatedAt).toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) {
    // 53100 = disk_full / 54000 = program_limit_exceeded (documento demasiado grande)
    const quota = error.code === '53100' || error.code === '54000';
    throw new CloudSaveError(error.message, quota ? 'quota' : 'other');
  }
}

export async function deleteCloudSession(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
