import { NAV_ITEMS_FLAT } from '@/constants/navigation';
import { ALL_ROLES } from '@/constants/roles';
import type { OrgUserRole } from '@/lib/backendApi';

export interface PermissionRow {
  /** Clave estable, se guarda en permission_settings.permission_key / nav_access_settings.nav_key (rows sin enforcementKeys). */
  key: string;
  label: string;
  /** Roles que HOY pueden hacerlo de verdad (RLS/backend) — el default si no hay override guardado. */
  defaultRoles: OrgUserRole[];
  comoSeGatea: string;
  /** Discrepancia conocida entre lo que muestra la UI y lo que permite la base. */
  gap?: string;
  /**
   * true cuando el checkbox de esta fila cambia comportamiento real (RLS o
   * backend), no solo configuración objetivo. El checkbox del rol "admin"
   * se bloquea en filas `enforced` para evitar que un admin se quite a sí
   * mismo (y a todos los admins de la org) el acceso sin forma de revertirlo.
   */
  enforced?: boolean;
  /**
   * Claves canónicas de policy que esta fila realmente controla en RLS
   * (`public.has_permission`, ver 016_permission_enforcement.sql). Varias
   * filas pueden apuntar a la MISMA clave (comparten una única policy de
   * update/insert a nivel de tabla) —
   * en ese caso el checkbox queda sincronizado entre todas: no se puede
   * mostrar "permitido" en una fila y "bloqueado" en otra si ambas son,
   * en los hechos, el mismo candado en la base. Si no está seteado, esta
   * fila no está conectada a RLS (puede estar conectada a un check de
   * backend vía `key` directamente, o ser solo configuración objetivo).
   */
  enforcementKeys?: string[];
}

export interface PermissionGroup {
  key: string;
  label: string;
  rows: PermissionRow[];
}

const ALL_WRITE_ROLES: OrgUserRole[] = ['admin', 'coach', 'medical', 'analyst'];

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: 'atletas',
    label: 'Atletas',
    rows: [
      {
        key: 'atletas.roster.importar',
        label: 'Roster físico: importar roster (Excel)',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea: 'UI: botón oculto si !canWrite(role). RLS: update players / insert injuries — conectado a este checkbox.',
        enforced: true,
        enforcementKeys: ['players.update', 'injuries.insert'],
      },
      {
        key: 'atletas.roster.editar_jugador',
        label: 'Roster físico: editar jugador (posición, altura, peso, fecha de nacimiento)',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea:
          'UI: ícono lápiz oculto si !canWrite(role). RLS: update players — conectado a este checkbox (comparte candado con "Activar/desactivar", "Editar jugador" en Ficha de jugador y "Importar roster").',
        enforced: true,
        enforcementKeys: ['players.update'],
      },
      {
        key: 'atletas.roster.activar_desactivar',
        label: 'Roster físico: desactivar / reactivar jugador (soft delete)',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea:
          'UI: botón oculto si !canWrite(role). Es un update (players.is_active) — conectado a este checkbox (mismo candado que "Editar jugador").',
        enforced: true,
        enforcementKeys: ['players.update'],
      },
      {
        key: 'atletas.roster.marcar_recuperada',
        label: 'Roster físico: marcar lesión como recuperada',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea: 'UI: acción oculta si !canWrite(role). RLS: update injuries — conectado a este checkbox.',
        enforced: true,
        enforcementKeys: ['injuries.update'],
      },
      {
        key: 'atletas.roster.eliminar_lesion',
        label: 'Roster físico: eliminar registro de lesión',
        defaultRoles: ['admin'],
        comoSeGatea:
          'RLS: delete injuries — conectado a este checkbox. El checkbox de "admin" queda bloqueado en true (siempre puede borrar) para que la org nunca se quede sin nadie que pueda hacerlo.',
        gap: 'La UI muestra el botón a cualquier canWrite (coach/medical/analyst también) — al confirmar, la base rechaza el borrado salvo que un admin habilite ese rol acá.',
        enforced: true,
        enforcementKeys: ['injuries.delete'],
      },
      {
        key: 'atletas.wellness.registrar',
        label: 'Wellness diario: registrar entrada de wellness',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea: 'RLS: insert/update (upsert) en wellness_entries — conectado a este checkbox.',
        gap: 'El formulario no tiene ningún gate visual — lo ve y puede intentar enviarlo cualquier rol autenticado, incluido viewer.',
        enforced: true,
        enforcementKeys: ['wellness_entries.write'],
      },
    ],
  },
  {
    key: 'analisis',
    label: 'Análisis',
    rows: [
      {
        key: 'analisis.gps.importar',
        label: 'Cargas GPS: importar sesiones (CSV Catapult)',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea: 'UI: botón oculto si !canWrite(role). RLS: upsert gps_sessions — conectado a este checkbox.',
        enforced: true,
        enforcementKeys: ['gps_sessions.write'],
      },
      {
        key: 'analisis.gps.eliminar',
        label: 'Cargas GPS: eliminar sesión',
        defaultRoles: ['admin'],
        comoSeGatea: 'RLS: delete gps_sessions — conectado a este checkbox (admin queda bloqueado en true).',
        gap: 'La UI muestra el ícono de papelera a cualquier canWrite — la base rechaza el borrado salvo que un admin habilite ese rol acá.',
        enforced: true,
        enforcementKeys: ['gps_sessions.delete'],
      },
      {
        key: 'analisis.video.subir',
        label: 'Video análisis: subir video',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea: 'RLS: insert video_analyses — conectado a este checkbox (el bucket de Storage sigue gateado solo por can_write(), no por este checkbox).',
        gap: 'El botón "Subir y registrar" no tiene gate visual — cualquier rol autenticado lo ve, incluido viewer.',
        enforced: true,
        enforcementKeys: ['video_analyses.insert'],
      },
      {
        key: 'analisis.video.analizar',
        label: 'Video análisis: analizar video (computer vision)',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea:
          'UI: botón oculto si !canWrite(role). Backend: POST /v1/videos/{id}/process con require_api_key_or_user_write — el endpoint ahora también consulta permission_settings para este checkbox antes de encolar el análisis.',
        enforced: true,
      },
      {
        key: 'analisis.video.editar',
        label: 'Video análisis: renombrar / editar fecha de partido',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea: 'UI: ícono lápiz oculto si !canWrite(role). RLS: update video_analyses — conectado a este checkbox.',
        enforced: true,
        enforcementKeys: ['video_analyses.update'],
      },
      {
        key: 'analisis.video.eliminar',
        label: 'Video análisis: eliminar video (fila + storage)',
        defaultRoles: ['admin'],
        comoSeGatea:
          'RLS: delete video_analyses — conectado a este checkbox (admin queda bloqueado en true). storage_org_delete sigue exigiendo admin siempre, no lo gobierna este checkbox.',
        gap: 'La UI muestra la papelera a cualquier canWrite — la base rechaza el borrado del registro salvo que un admin habilite ese rol acá.',
        enforced: true,
        enforcementKeys: ['video_analyses.delete'],
      },
      {
        key: 'analisis.video.asignar_track',
        label: 'Video análisis: asignar/liberar track a un jugador',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea:
          'UI: tablero táctico recibe canEdit={canWrite(role)}. RLS: hereda el permiso del video_analyses padre — conectado a este checkbox.',
        enforced: true,
        enforcementKeys: ['video_player_tracks.write'],
      },
    ],
  },
  {
    key: 'ficha-jugador',
    label: 'Ficha de jugador',
    rows: [
      {
        key: 'ficha_jugador.editar',
        label: 'Editar datos del jugador',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea:
          'UI: botón "Editar jugador" oculto si !canWrite(role). RLS: update players — mismo candado que "Roster físico: editar jugador".',
        enforced: true,
        enforcementKeys: ['players.update'],
      },
      {
        key: 'ficha_jugador.multimedia.subir',
        label: 'Multimedia: subir foto de perfil / modelo 3D',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea:
          'UI: recibe canEdit={canWrite(role)}. RLS: update players conectado a este checkbox (el bucket player-media sigue gateado solo por can_write(), no por este checkbox).',
        enforced: true,
        enforcementKeys: ['players.update'],
      },
    ],
  },
  {
    key: 'competiciones',
    label: 'Competiciones',
    rows: [
      {
        key: 'competiciones.importar',
        label: 'Importar estadísticas de conferencia (Excel liga)',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea:
          'UI: botón oculto si !canWrite(role). RLS: upsert league_*_stats — conectado a este checkbox (comparte candado con "Editar fila").',
        enforced: true,
        enforcementKeys: ['league_stats.write'],
      },
      {
        key: 'competiciones.editar_fila',
        label: 'Editar fila de stats (goles, GAA, % atajadas)',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea: 'UI: acción condicionada a canWrite(role). RLS: update league_*_stats — mismo candado que "Importar".',
        enforced: true,
        enforcementKeys: ['league_stats.write'],
      },
      {
        key: 'competiciones.eliminar_fila',
        label: 'Eliminar fila de stats de liga',
        defaultRoles: ['admin'],
        comoSeGatea: 'RLS: delete league_*_stats — conectado a este checkbox (admin queda bloqueado en true).',
        gap: 'La UI condiciona la acción a canWrite (sin distinguir admin) — la base rechaza el borrado salvo que un admin habilite ese rol acá.',
        enforced: true,
        enforcementKeys: ['league_stats.delete'],
      },
    ],
  },
  {
    key: 'modelos-ia',
    label: 'Modelos IA',
    rows: [
      {
        key: 'modelos_ia.reentrenar',
        label: 'Disparar reentrenamiento (físico + técnico)',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea:
          'UI: botón oculto si !canWrite(role). Backend: POST /v1/ml/train/{kind} — el endpoint consulta permission_settings para este checkbox antes de entrenar.',
        enforced: true,
      },
    ],
  },
  {
    key: 'usuarios',
    label: 'Usuarios',
    rows: [
      {
        key: 'usuarios.invitar',
        label: 'Invitar usuario',
        defaultRoles: ['admin'],
        comoSeGatea: 'UI: página completa reemplazada por EmptyState si role !== admin. Backend: POST /v1/users/invite con require_admin.',
        gap: 'Deliberadamente NO conectado a este checkbox: require_admin también protege el chat de AthlosBot (assistant.py) — flexibilizarlo acá tendría el efecto colateral de abrir el asistente a otros roles.',
      },
      {
        key: 'usuarios.cambiar_rol',
        label: 'Cambiar rol de un usuario',
        defaultRoles: ['admin'],
        comoSeGatea: 'Igual que invitar, y nunca sobre uno mismo. Backend: PATCH /v1/users/{id}/role con require_admin.',
        gap: 'Mismo motivo que "Invitar usuario": require_admin es compartido con AthlosBot.',
      },
      {
        key: 'usuarios.eliminar',
        label: 'Eliminar usuario (revoca acceso)',
        defaultRoles: ['admin'],
        comoSeGatea: 'Igual que invitar, y nunca sobre uno mismo. Backend: DELETE /v1/users/{id} con require_admin.',
        gap: 'Mismo motivo que "Invitar usuario": require_admin es compartido con AthlosBot.',
      },
    ],
  },
  {
    key: 'configuracion',
    label: 'Configuración',
    rows: [
      {
        key: 'configuracion.organizacion',
        label: 'Editar organización (nombre, país)',
        defaultRoles: ['admin'],
        comoSeGatea:
          'UI: inputs deshabilitados y botón oculto si !isAdmin. RLS: update organizations — conectado a este checkbox (admin queda bloqueado en true).',
        enforced: true,
        enforcementKeys: ['organizations.update'],
      },
      {
        key: 'configuracion.perfil_propio',
        label: 'Editar perfil propio (nombre completo)',
        defaultRoles: ALL_ROLES,
        comoSeGatea: 'RLS: profiles_update_own solo exige user_id = auth.uid() — no depende del rol.',
      },
    ],
  },
];

/**
 * Carpeta especial de navegación: un checkbox acá controla en vivo qué
 * ítems del menú ve cada rol (Sidebar.tsx + App.tsx) — mecanismo aparte de
 * `enforced`/`enforcementKeys` (esto no toca permission_settings ni RLS,
 * solo nav_access_settings). Dashboard ('/') queda afuera a propósito — es
 * la página de fallback, no puede quedar bloqueada.
 */
export const NAV_PERMISSION_GROUP: PermissionGroup = {
  key: 'navegacion',
  label: 'Navegación (menú)',
  rows: NAV_ITEMS_FLAT.filter((item) => item.to !== '/').map((item) => ({
    key: item.to,
    label: item.label,
    defaultRoles: ALL_ROLES,
    comoSeGatea: 'Visibilidad del ítem en el menú lateral y acceso directo por URL.',
  })),
};
