import type { ReactNode } from 'react';
import { BadgeCheck, Gauge, Mail, Route, Satellite, ShieldCheck, Trophy, UserRound, Video, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';
import type { PublicAthleteProfile } from '../api';

const ATTRIBUTE_CODES = ['RIT', 'RES', 'ACE', 'TIR', 'CRE'] as const;

function fmt(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '--';
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function MetricTile({
  icon: Icon,
  label,
  value,
  unit,
  hint,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-panel/60 p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4 text-ai" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground">
        {value}
        {unit && value !== '--' && <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Tarjeta "verificada ATHLOS". Renderiza SOLO lo que trae el payload de lista
 * blanca del backend (build_public_payload); las secciones ausentes no se
 * muestran ni con placeholder, para no insinuar que hay datos ocultos.
 */
export function VerifiedAthleteCard({ profile, className }: { profile: PublicAthleteProfile; className?: string }) {
  const { t } = useTranslation();
  const { athlete, club, attributes, physical, media, competition, contact } = profile;
  const photo = media?.action_photo_url ?? media?.photo_url ?? null;
  const sportLabel = t(`verifiedProfile.sport.${profile.sport}`, profile.sport);

  return (
    <article className={cn('overflow-hidden rounded-2xl border border-border bg-card shadow-elevated', className)}>
      {/* Cabecera */}
      <div className="relative bg-gradient-to-br from-ai/25 via-purple/15 to-transparent p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative mx-auto shrink-0 sm:mx-0">
            <div className="flex size-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-ai/60 bg-panel shadow-elevated sm:size-36">
              {photo ? (
                <img src={photo} alt={athlete.display_name} className="size-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserRound className="size-14 text-muted-foreground" aria-hidden="true" />
              )}
            </div>
            {attributes && (
              <div className="absolute -bottom-3 -right-3 flex size-14 flex-col items-center justify-center rounded-xl bg-ai text-white shadow-elevated">
                <span className="text-xl font-black leading-none">{attributes.overall}</span>
                <span className="text-[10px] font-semibold uppercase leading-none">{t('verifiedProfile.card.overall', 'OVR')}</span>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
              <BadgeCheck className="size-4" aria-hidden="true" />
              {t('verifiedProfile.card.verifiedBadge', 'Perfil verificado ATHLOS')}
            </div>
            <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">{athlete.display_name}</h1>
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground sm:justify-start">
              {athlete.position && <Badge variant="ai">{athlete.position}</Badge>}
              <span>{sportLabel}</span>
              {club.name && <span>· {club.name}</span>}
              {club.team && <span>· {club.team}</span>}
              {profile.country && <span>· {profile.country}</span>}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-foreground sm:justify-start">
              {athlete.age != null && <span>{t('verifiedProfile.card.age', '{{age}} años', { age: athlete.age })}</span>}
              {athlete.height_cm != null && <span>{fmt(athlete.height_cm, 0)} cm</span>}
              {athlete.class_year != null && (
                <span>{t('verifiedProfile.card.classYear', 'Promoción {{year}}', { year: athlete.class_year })}</span>
              )}
            </div>
            {athlete.headline && <p className="text-base font-medium text-foreground">{athlete.headline}</p>}
          </div>
        </div>
      </div>

      {/* Sello */}
      <div className="flex items-start gap-3 border-y border-border bg-panel/70 px-6 py-3 sm:px-8">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {t('verifiedProfile.card.sealTitle', 'Datos verificados por ATHLOS a partir de video/GPS.')}
          </span>{' '}
          {t(
            'verifiedProfile.card.sealBody',
            'Las métricas físicas y la ficha de atributos se calculan desde sesiones GPS y video de partido procesados por ATHLOS, no son autodeclaradas.',
          )}
        </p>
      </div>

      <div className="space-y-8 p-6 sm:p-8">
        {athlete.bio && (
          <Section title={t('verifiedProfile.card.bioTitle', 'Sobre el atleta')}>
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{athlete.bio}</p>
          </Section>
        )}

        {attributes && (
          <Section title={t('verifiedProfile.card.attributesTitle', 'Ficha de atributos')}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              {ATTRIBUTE_CODES.map((code) => {
                const value = attributes.values[code];
                return (
                  <div key={code} className="rounded-lg border border-border bg-panel/60 p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">{t(`verifiedProfile.attr.${code}`, code)}</span>
                      <span className="text-xl font-black text-foreground">{value}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/60">
                      <div className="h-full rounded-full bg-gradient-to-r from-ai to-purple" style={{ width: `${value}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {t(
                'verifiedProfile.card.attributesNote',
                'Escala 40-99: percentil del atleta dentro de su propio plantel, no contra la élite mundial.',
              )}
            </p>
          </Section>
        )}

        {physical && (physical.gps || physical.video) && (
          <Section title={t('verifiedProfile.card.physicalTitle', 'Métricas físicas (último año)')}>
            {physical.gps && (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Satellite className="size-4" aria-hidden="true" />
                  {t('verifiedProfile.card.gpsSource', 'GPS · {{count}} sesiones ({{matches}} de partido)', {
                    count: physical.gps.sessions,
                    matches: physical.gps.matches_tracked,
                  })}
                </p>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricTile icon={Gauge} label={t('verifiedProfile.card.topSpeed', 'Velocidad p95')} value={fmt(physical.gps.top_speed_p95_kmh)} unit="km/h" />
                  <MetricTile icon={Route} label={t('verifiedProfile.card.distanceMatch', 'Distancia / partido')} value={fmt(physical.gps.distance_per_match_km, 2)} unit="km" />
                  <MetricTile icon={Route} label={t('verifiedProfile.card.distanceSession', 'Distancia / sesión')} value={fmt(physical.gps.distance_per_session_km, 2)} unit="km" />
                  <MetricTile icon={Zap} label={t('verifiedProfile.card.sprint', 'Sprint / sesión')} value={fmt(physical.gps.sprint_distance_per_session_m, 0)} unit="m" />
                </div>
              </div>
            )}
            {physical.video && (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Video className="size-4" aria-hidden="true" />
                  {t('verifiedProfile.card.videoSource', 'Video · {{count}} partidos analizados', { count: physical.video.matches_analyzed })}
                </p>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <MetricTile icon={Gauge} label={t('verifiedProfile.card.topSpeed', 'Velocidad p95')} value={fmt(physical.video.top_speed_p95_kmh)} unit="km/h" />
                  <MetricTile
                    icon={Route}
                    label={t('verifiedProfile.card.distanceVisible', 'Distancia visible / partido')}
                    value={fmt(physical.video.distance_per_match_km, 2)}
                    unit="km"
                    hint={t('verifiedProfile.card.visibleMinutes', '{{minutes}} min en cámara', {
                      minutes: fmt(physical.video.visible_minutes_per_match, 0),
                    })}
                  />
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {t(
                'verifiedProfile.card.physicalNote',
                'p95 = el 5 % más alto de las mediciones, para que un pico aislado no defina el perfil.',
              )}
            </p>
          </Section>
        )}

        {competition && competition.length > 0 && (
          <Section title={t('verifiedProfile.card.competitionTitle', 'Estadísticas de competición')}>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-panel text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">{t('verifiedProfile.card.colSeason', 'Temporada')}</th>
                    <th className="px-3 py-2 text-left">{t('verifiedProfile.card.colCompetition', 'Competición')}</th>
                    <th className="px-3 py-2 text-right">{t('verifiedProfile.card.colApps', 'PJ')}</th>
                    <th className="px-3 py-2 text-right">{t('verifiedProfile.card.colMinutes', 'Min')}</th>
                    <th className="px-3 py-2 text-right">{t('verifiedProfile.card.colGoals', 'G')}</th>
                    <th className="px-3 py-2 text-right">{t('verifiedProfile.card.colAssists', 'A')}</th>
                  </tr>
                </thead>
                <tbody>
                  {competition.map((row, index) => (
                    <tr key={`${row.season}-${row.competition}-${index}`} className="border-t border-border">
                      <td className="px-3 py-2 text-foreground">{row.season ?? '--'}</td>
                      <td className="px-3 py-2 text-foreground">
                        {row.competition ?? '--'}
                        {row.team_name && <span className="block text-xs text-muted-foreground">{row.team_name}</span>}
                      </td>
                      <td className="px-3 py-2 text-right">{fmt(row.appearances, 0)}</td>
                      <td className="px-3 py-2 text-right">{fmt(row.minutes, 0)}</td>
                      <td className="px-3 py-2 text-right">{fmt(row.goals, 0)}</td>
                      <td className="px-3 py-2 text-right">{fmt(row.assists, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Trophy className="size-4" aria-hidden="true" />
              {t('verifiedProfile.card.competitionSource', 'Fuente: proveedor de la competición ({{providers}}), no medido por ATHLOS.', {
                providers: Array.from(new Set(competition.map((r) => r.provider).filter(Boolean))).join(', ') || '--',
              })}
            </p>
          </Section>
        )}

        {contact && (
          <Section title={t('verifiedProfile.card.contactTitle', 'Contacto institucional')}>
            <a
              href={`mailto:${contact.email}`}
              className="focus-ring inline-flex items-center gap-2 rounded-md border border-border bg-panel px-4 py-2 text-sm font-medium text-foreground hover:bg-card"
            >
              <Mail className="size-4 text-ai" aria-hidden="true" />
              {contact.label ? `${contact.label} · ${contact.email}` : contact.email}
            </a>
            <p className="text-xs text-muted-foreground">
              {t('verifiedProfile.card.contactNote', 'El contacto se gestiona a través del club, nunca directamente con el atleta.')}
            </p>
          </Section>
        )}
      </div>
    </article>
  );
}
