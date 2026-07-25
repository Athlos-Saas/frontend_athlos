import { NAV_ITEMS_FLAT } from '@/constants/navigation';
import { ALL_ROLES } from '@/constants/roles';
import type { OrgUserRole } from '@/lib/backendApi';

export interface PermissionRow {
  /** Clave estable, se guarda en permission_settings.permission_key / nav_access_settings.nav_key. */
  key: string;
  label: string;
  /** Roles que HOY pueden hacerlo de verdad (RLS/backend) — el default si no hay override guardado. */
  defaultRoles: OrgUserRole[];
  comoSeGatea: string;
  /** Discrepancia conocida entre lo que muestra la UI y lo que permite la base. */
  gap?: string;
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
        comoSeGatea: 'UI: botón oculto si !canWrite(role). RLS: update players / insert injuries exige can_write().',
      },
      {
        key: 'atletas.roster.editar_jugador',
        label: 'Roster físico: editar jugador (posición, altura, peso, fecha de nacimiento)',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea: 'UI: ícono lápiz oculto si !canWrite(role). RLS: update players exige can_write().',
      },
      {
        key: 'atletas.roster.activar_desactivar',
        label: 'Roster físico: desactivar / reactivar jugador (soft delete)',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea: 'UI: botón oculto si !canWrite(role). Es un update (players.is_active), no un delete — exige can_write().',
      },
      {
        key: 'atletas.roster.marcar_recuperada',
        label: 'Roster físico: marcar lesión como recuperada',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea: 'UI: acción oculta si !canWrite(role). RLS: update injuries exige can_write().',
      },
      {
        key: 'atletas.roster.eliminar_lesion',
        label: 'Roster físico: eliminar registro de lesión',
        defaultRoles: ['admin'],
        comoSeGatea: 'RLS: delete injuries exige literalmente current_role() = \'admin\'.',
        gap: 'La UI muestra el botón a cualquier canWrite (coach/medical/analyst también) — al confirmar, la base rechaza el borrado.',
      },
      {
        key: 'atletas.wellness.registrar',
        label: 'Wellness diario: registrar entrada de wellness',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea: 'RLS: insert/update (upsert) en wellness_entries exige can_write().',
        gap: 'El formulario no tiene ningún gate visual — lo ve y puede intentar enviarlo cualquier rol autenticado, incluido viewer.',
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
        comoSeGatea: 'UI: botón oculto si !canWrite(role). RLS: upsert gps_sessions exige can_write().',
      },
      {
        key: 'analisis.gps.eliminar',
        label: 'Cargas GPS: eliminar sesión',
        defaultRoles: ['admin'],
        comoSeGatea: 'RLS: delete gps_sessions exige current_role() = \'admin\'.',
        gap: 'La UI muestra el ícono de papelera a cualquier canWrite — la base rechaza el borrado si no es admin.',
      },
      {
        key: 'analisis.video.subir',
        label: 'Video análisis: subir video',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea: 'RLS/Storage: insert video_analyses y bucket videos exigen can_write().',
        gap: 'El botón "Subir y registrar" no tiene gate visual — cualquier rol autenticado lo ve, incluido viewer.',
      },
      {
        key: 'analisis.video.analizar',
        label: 'Video análisis: analizar video (computer vision)',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea: 'UI: botón oculto si !canWrite(role). Backend: POST /v1/videos/{id}/process con require_api_key_or_user_write.',
      },
      {
        key: 'analisis.video.editar',
        label: 'Video análisis: renombrar / editar fecha de partido',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea: 'UI: ícono lápiz oculto si !canWrite(role). RLS: update video_analyses exige can_write().',
      },
      {
        key: 'analisis.video.eliminar',
        label: 'Video análisis: eliminar video (fila + storage)',
        defaultRoles: ['admin'],
        comoSeGatea: 'RLS: delete video_analyses y storage_org_delete exigen current_role() = \'admin\'.',
        gap: 'La UI muestra la papelera a cualquier canWrite — la base rechaza el borrado del registro si no es admin.',
      },
      {
        key: 'analisis.video.asignar_track',
        label: 'Video análisis: asignar/liberar track a un jugador',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea: 'UI: tablero táctico recibe canEdit={canWrite(role)}. RLS: hereda el permiso del video_analyses padre + can_write().',
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
        comoSeGatea: 'UI: botón "Editar jugador" oculto si !canWrite(role). RLS: update players exige can_write().',
      },
      {
        key: 'ficha_jugador.multimedia.subir',
        label: 'Multimedia: subir foto de perfil / modelo 3D',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea: 'UI: recibe canEdit={canWrite(role)}. RLS/Storage: bucket player-media y update players exigen can_write().',
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
        comoSeGatea: 'UI: botón oculto si !canWrite(role). RLS: upsert league_*_stats exige can_write().',
      },
      {
        key: 'competiciones.editar_fila',
        label: 'Editar fila de stats (goles, GAA, % atajadas)',
        defaultRoles: ALL_WRITE_ROLES,
        comoSeGatea: 'UI: acción condicionada a canWrite(role). RLS: update exige can_write().',
      },
      {
        key: 'competiciones.eliminar_fila',
        label: 'Eliminar fila de stats de liga',
        defaultRoles: ['admin'],
        comoSeGatea: 'RLS: delete exige current_role() = \'admin\'.',
        gap: 'La UI condiciona la acción a canWrite (sin distinguir admin) — la base rechaza el borrado si no es admin.',
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
        comoSeGatea: 'UI: botón oculto si !canWrite(role). Backend: POST /v1/ml/train/{kind} con require_api_key_or_user_write.',
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
      },
      {
        key: 'usuarios.cambiar_rol',
        label: 'Cambiar rol de un usuario',
        defaultRoles: ['admin'],
        comoSeGatea: 'Igual que invitar, y nunca sobre uno mismo. Backend: PATCH /v1/users/{id}/role con require_admin.',
      },
      {
        key: 'usuarios.eliminar',
        label: 'Eliminar usuario (revoca acceso)',
        defaultRoles: ['admin'],
        comoSeGatea: 'Igual que invitar, y nunca sobre uno mismo. Backend: DELETE /v1/users/{id} con require_admin.',
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
        comoSeGatea: 'UI: inputs deshabilitados y botón oculto si !isAdmin. RLS: update organizations exige current_role() = \'admin\'.',
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
 * Carpeta especial de navegación: un checkbox acá SÍ controla en vivo qué
 * ítems del menú ve cada rol (Sidebar.tsx + App.tsx), a diferencia de las
 * demás carpetas que todavía son solo configuración objetivo. Dashboard
 * ('/') queda afuera a propósito — es la página de fallback, no puede
 * quedar bloqueada.
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
