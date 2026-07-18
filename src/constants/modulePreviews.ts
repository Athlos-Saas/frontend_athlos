export interface ModulePreview {
  description: string;
  bullets: string[];
  kpis: string[];
}

/**
 * Contenido de los módulos que todavía no tienen tabla propia en Supabase.
 * No se inventan datos — solo se describe qué va a mostrar cada módulo una
 * vez que el backend exponga la fuente correspondiente (ver Fase 1 de la
 * auditoría en docs/DESIGN_SYSTEM.md).
 */
export const MODULE_PREVIEWS: Record<string, ModulePreview> = {
  '/equipos': {
    description: 'Plantillas, cuerpo técnico y roster por equipo.',
    bullets: [
      'Roster completo por equipo con posición y estado físico',
      'Cuerpo técnico y staff asignado',
      'Historial de resultados y racha reciente',
    ],
    kpis: ['Equipos activos', 'Jugadores por plantilla', 'Staff registrado'],
  },
  '/temporadas': {
    description: 'Calendario de competición y ciclos de temporada.',
    bullets: [
      'Fechas de inicio y cierre por temporada',
      'Comparación de métricas entre temporadas',
      'Vínculo directo con Competiciones y Modelos IA',
    ],
    kpis: ['Temporadas registradas', 'Temporada activa', 'Jornadas jugadas'],
  },
  '/pronosticos': {
    description: 'Proyecciones de rendimiento futuro basadas en los modelos entrenados.',
    bullets: [
      'Proyección de riesgo de lesión para las próximas sesiones',
      'Probabilidad de rendimiento por jugador y por partido',
      'Comparación entre lo pronosticado y lo ocurrido',
    ],
    kpis: ['Pronósticos generados', 'Precisión histórica', 'Horizonte de proyección'],
  },
  '/scouting': {
    description: 'Fichas de prospectos y comparativas de scouting.',
    bullets: [
      'Ficha de jugador externo con métricas comparables',
      'Comparación lado a lado contra la plantilla actual',
      'Lista de seguimiento con notas del cuerpo técnico',
    ],
    kpis: ['Prospectos en seguimiento', 'Comparaciones activas', 'Fichas actualizadas'],
  },
  '/reportes': {
    description: 'Reportes personalizados por atleta, equipo o competición.',
    bullets: [
      'Exportación a PDF/Excel de cualquier dashboard',
      'Reportes programados por correo',
      'Plantillas por rol (cuerpo técnico, dirección, médico)',
    ],
    kpis: ['Reportes generados', 'Programados activos', 'Plantillas disponibles'],
  },
  '/dispositivos': {
    description: 'Sensores GPS, wearables y su estado de sincronización.',
    bullets: [
      'Estado de batería y última sincronización por dispositivo',
      'Asignación de dispositivo a jugador',
      'Historial de fallas o desconexiones',
    ],
    kpis: ['Dispositivos activos', 'Sincronizados hoy', 'Con alerta'],
  },
  '/integraciones': {
    description: 'Conexiones con otras plataformas y proveedores.',
    bullets: [
      'Calendarios, wearables y plataformas de video externas',
      'Estado de la conexión y última sincronización',
      'Webhooks y API keys por integración',
    ],
    kpis: ['Integraciones conectadas', 'Disponibles', 'Con error'],
  },
  '/alertas': {
    description: 'Centro unificado de alertas de fatiga, lesión y anomalías.',
    bullets: [
      'Todas las alertas de ml_predictions en un solo feed',
      'Reglas de notificación por severidad',
      'Historial y resolución de alertas por jugador',
    ],
    kpis: ['Alertas activas', 'Resueltas (30d)', 'Reglas configuradas'],
  },
  '/clientes': {
    description: 'Organizaciones (multi-tenant) que usan la plataforma.',
    bullets: [
      'Listado de organizaciones cliente y su plan',
      'Uso y límites por organización',
      'Facturación y estado de la cuenta',
    ],
    kpis: ['Organizaciones activas', 'En prueba', 'Plan promedio'],
  },
  '/usuarios': {
    description: 'Miembros del equipo, roles y permisos.',
    bullets: [
      'Invitar y remover usuarios de la organización',
      'Roles y permisos por módulo',
      'Actividad reciente por usuario',
    ],
    kpis: ['Usuarios activos', 'Invitaciones pendientes', 'Roles definidos'],
  },
  '/configuracion': {
    description: 'Preferencias de la organización, notificaciones y seguridad.',
    bullets: [
      'Datos de la organización y marca',
      'Preferencias de notificaciones por canal',
      'Seguridad: sesiones activas y autenticación',
    ],
    kpis: ['Notificaciones activas', 'Sesiones abiertas', 'Última actualización'],
  },
};
