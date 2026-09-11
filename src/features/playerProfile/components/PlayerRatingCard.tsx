/**
 * PlayerRatingCard — tarjeta de rating tipo FIFA del jugador PROPIO, con
 * desglose transparente de cómo se calculó cada número.
 *
 * Muestra el overall grande, los 6 atributos (RIT/RES/ACE/TIR/CRE/DIS) y, al
 * expandir, para cada atributo: las estadísticas fuente con sus valores reales,
 * el percentil/ranking del jugador dentro del plantel y la fórmula. Más la
 * fórmula del overall. Así el número nunca es una caja negra: se ve de dónde
 * sale ese "90" y qué datos alimentan cada RIT/RES/ACE/TIR/CRE/DIS.
 *
 * Consume /v1/player-ratings/{id} (OwnPlayerRatingService).
 */
import { useEffect, useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { RadarComparisonChart } from '@/components/charts/RadarComparisonChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { colors } from '@/constants/tokens';
import { getOwnPlayerRating, type OwnPlayerRatingProfile } from '@/lib/backendApi';

function ratingColor(value: number): string {
  if (value >= 85) return '#22c55e';
  if (value >= 75) return '#84cc16';
  if (value >= 65) return '#eab308';
  if (value >= 50) return '#f97316';
  return '#94a3b8';
}

export function PlayerRatingCard({
  orgId,
  playerId,
  size = 'md',
}: {
  orgId: string;
  playerId: string;
  size?: 'md' | 'lg';
}) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<OwnPlayerRatingProfile | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [expanded, setExpanded] = useState<string | null>(null);
  const lg = size === 'lg';

  useEffect(() => {
    let mounted = true;
    setState('loading');
    getOwnPlayerRating(orgId, playerId)
      .then((data) => {
        if (!mounted) return;
        setProfile(data);
        setState('ready');
      })
      .catch(() => {
        if (!mounted) return;
        setState('error');
      });
    return () => {
      mounted = false;
    };
  }, [orgId, playerId]);

  if (state === 'loading') return <Skeleton className="h-64 w-full" />;
  // Si no hay rating (sin backend o sin datos), no rompemos la ficha: no mostramos nada.
  if (state === 'error' || !profile) return null;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            {t('playerRating.title', 'Rating del jugador')}
            <span className="text-xs font-normal text-muted-foreground">
              {t('playerRating.subtitle', '(nivel dentro de tu plantel)')}
            </span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className={`grid grid-cols-1 gap-5 ${lg ? 'lg:grid-cols-[340px_1fr]' : 'lg:grid-cols-[auto_1fr]'}`}>
          {/* Overall + radar */}
          <div className={`flex items-center gap-4 ${lg ? 'flex-col sm:flex-row' : ''}`}>
            <div
              className={`flex flex-col items-center justify-center rounded-xl text-white ${lg ? 'size-32' : 'size-24'}`}
              style={{ background: `linear-gradient(135deg, ${ratingColor(profile.overall)}, #0f172a)` }}
            >
              <span className={`font-black leading-none ${lg ? 'text-6xl' : 'text-4xl'}`}>{profile.overall}</span>
              <span className="mt-1 text-[10px] uppercase tracking-wider opacity-80">Overall</span>
            </div>
            <div className={lg ? 'h-56 w-56' : 'h-40 w-40'}>
              <RadarComparisonChart
                data={profile.radar}
                dataKey="value"
                angleKey="attribute"
                name={profile.name}
                color={colors.purple}
              />
            </div>
          </div>

          {/* Desglose por atributo (expandible) */}
          <div className="space-y-1.5">
            {profile.explanation.attributes.map((attr) => {
              const isOpen = expanded === attr.code;
              return (
                <div key={attr.code} className="rounded-md border border-border bg-panel/40">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : attr.code)}
                    className={`flex w-full items-center justify-between gap-3 px-3 text-left ${lg ? 'py-3' : 'py-2'}`}
                  >
                    <span className={`flex items-center gap-2 ${lg ? 'text-base' : 'text-sm'}`}>
                      <span className={`font-black ${lg ? 'w-10 text-lg' : 'w-8 text-xs'}`} style={{ color: ratingColor(attr.rating) }}>
                        {attr.rating}
                      </span>
                      <span className="text-foreground">{attr.label}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {t('playerRating.rankInSquad', '#{{rank}} de {{total}}', {
                        rank: attr.rank_in_squad,
                        total: attr.squad_size,
                      })}
                      <ChevronDown className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="space-y-2 border-t border-border/60 px-3 py-2 text-xs">
                      <p className="text-muted-foreground">
                        {t('playerRating.percentile', 'Percentil {{pct}} del plantel', { pct: attr.percentile })}
                        {' · '}
                        {t('playerRating.formulaLabel', 'Fórmula')}: <span className="italic">{attr.formula}</span>
                      </p>
                      <div className="space-y-1">
                        {attr.sources.map((s) => (
                          <div key={s.label} className="flex items-center justify-between">
                            <span className="text-muted-foreground">{s.label}</span>
                            <span className="font-mono font-medium text-foreground">
                              {s.value !== null ? `${s.value}${s.unit ? ` ${s.unit}` : ''}` : '--'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cómo se calcula el overall */}
        <div className="mt-4 flex items-start gap-2 rounded-md bg-panel/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-ai" aria-hidden="true" />
          <div>
            <p>
              <span className="font-medium text-foreground">{t('playerRating.overallHow', 'Cómo se calcula el overall')}:</span>{' '}
              {profile.explanation.overall_formula}
            </p>
            <p className="mt-1">{profile.explanation.note}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
