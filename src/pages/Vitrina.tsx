import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, ChevronLeft, ChevronRight, Gauge, Mail, Route, Search, UserRound, Users } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { SHOWCASE_MAX_PAGE, type ShowcaseCard, type ShowcaseFilters } from '@/features/athleteProfile/api';
import { VerifiedAthleteCard } from '@/features/athleteProfile/components/VerifiedAthleteCard';
import { useShowcaseAthlete, useShowcaseSearch } from '@/features/athleteProfile/queries';

/** Deportes ofrecidos en el filtro. Mismo conjunto que SPORT_LABEL del Header. */
const SPORTS = ['soccer', 'basketball', 'rugby'] as const;

interface FilterForm {
  sport: string;
  country: string;
  position: string;
  ageMin: string;
  ageMax: string;
  minTopSpeedKmh: string;
  minDistancePerMatchKm: string;
}

const EMPTY_FORM: FilterForm = {
  sport: 'all',
  country: '',
  position: '',
  ageMin: '',
  ageMax: '',
  minTopSpeedKmh: '',
  minDistancePerMatchKm: '',
};

const toNum = (value: string) => (value.trim() === '' || Number.isNaN(Number(value)) ? undefined : Number(value));

function formToFilters(form: FilterForm): ShowcaseFilters {
  return {
    sport: form.sport === 'all' ? undefined : form.sport,
    country: form.country.trim() || undefined,
    position: form.position.trim() || undefined,
    ageMin: toNum(form.ageMin),
    ageMax: toNum(form.ageMax),
    minTopSpeedKmh: toNum(form.minTopSpeedKmh),
    minDistancePerMatchKm: toNum(form.minDistancePerMatchKm),
  };
}

function TalentCard({ card, onOpen }: { card: ShowcaseCard; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="focus-ring group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-subtle transition-colors hover:border-ai/60"
    >
      <div className="flex items-center gap-3 bg-gradient-to-br from-ai/20 via-purple/10 to-transparent p-4">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ai/40 bg-panel">
          {card.photo_url ? (
            <img src={card.photo_url} alt={card.display_name} className="size-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <UserRound className="size-7 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{card.display_name}</p>
          <p className="truncate text-xs text-muted-foreground">{card.club ?? '--'}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {card.position && <Badge variant="ai">{card.position}</Badge>}
            {card.age != null && <Badge>{t('vitrina.card.age', '{{age}} años', { age: card.age })}</Badge>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-4 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Gauge className="size-4 text-ai" aria-hidden="true" />
          <span className="font-semibold text-foreground">{card.top_speed_p95_kmh ?? '--'}</span>
          {card.top_speed_p95_kmh != null && <span className="text-xs">km/h</span>}
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Route className="size-4 text-ai" aria-hidden="true" />
          <span className="font-semibold text-foreground">{card.distance_per_match_km ?? '--'}</span>
          {card.distance_per_match_km != null && <span className="text-xs">{t('vitrina.card.kmPerMatch', 'km/partido')}</span>}
        </div>
        <div className="col-span-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t(`verifiedProfile.sport.${card.sport ?? 'soccer'}`, card.sport ?? '')}
            {card.country && ` · ${card.country}`}
          </span>
          {card.open_to_contact && (
            <span className="flex items-center gap-1 text-success">
              <Mail className="size-3.5" aria-hidden="true" /> {t('vitrina.card.openToContact', 'Acepta contacto')}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ShowcaseDetailDialog({ cardId, onClose }: { cardId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const detail = useShowcaseAthlete(cardId);
  return (
    <Dialog open={!!cardId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-0">
        <DialogTitle className="sr-only">{t('vitrina.detailTitle', 'Perfil verificado')}</DialogTitle>
        {detail.isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : detail.isError || !detail.data ? (
          <ErrorState
            className="m-6"
            title={t('vitrina.detailError', 'Este perfil ya no está disponible')}
            description={detail.error instanceof Error ? detail.error.message : undefined}
            onRetry={() => detail.refetch()}
          />
        ) : (
          <VerifiedAthleteCard profile={detail.data} className="rounded-none border-0 shadow-none" />
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Vitrina: búsqueda de talento verificado ENTRE organizaciones. Solo aparecen
 * perfiles publicados y que su club marcó "aparecer en la vitrina". Las
 * tarjetas no traen el enlace público (el backend no lo envía): el detalle se
 * abre aquí, autenticado. Se busca al pulsar "Buscar", no por tecla, porque el
 * backend limita solicitudes por minuto.
 *
 * `orgId` se recibe por convención de páginas; la búsqueda es entre orgs y no
 * filtra por la propia.
 */
export default function Vitrina(_props: { orgId: string }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FilterForm>(EMPTY_FORM);
  const [filters, setFilters] = useState<ShowcaseFilters>({});
  const [page, setPage] = useState(1);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const search = useShowcaseSearch({ ...filters, page });

  const update = (key: keyof FilterForm, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFilters(formToFilters(form));
    setPage(1);
  };

  const handleReset = () => {
    setForm(EMPTY_FORM);
    setFilters({});
    setPage(1);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <BadgeCheck className="size-6 text-success" aria-hidden="true" />
          {t('vitrina.title', 'Vitrina de talento verificado')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            'vitrina.subtitle',
            'Atletas de academias, universidades y ligas de ascenso medidos por ATHLOS con video y GPS. Solo perfiles que su club decidió publicar.',
          )}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-4 shadow-subtle">
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t('vitrina.filters.sport', 'Deporte')}>
            <Select value={form.sport} onValueChange={(v) => update('sport', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('vitrina.filters.allSports', 'Todos')}</SelectItem>
                {SPORTS.map((sport) => (
                  <SelectItem key={sport} value={sport}>
                    {t(`verifiedProfile.sport.${sport}`, sport)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('vitrina.filters.position', 'Posición')} htmlFor="vt-position">
            <Input id="vt-position" maxLength={40} value={form.position} onChange={(e) => update('position', e.target.value)} />
          </Field>
          <Field label={t('vitrina.filters.country', 'País')} htmlFor="vt-country">
            <Input id="vt-country" maxLength={56} value={form.country} onChange={(e) => update('country', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('vitrina.filters.ageMin', 'Edad mín.')} htmlFor="vt-age-min">
              <Input id="vt-age-min" type="number" min={8} max={60} value={form.ageMin} onChange={(e) => update('ageMin', e.target.value)} />
            </Field>
            <Field label={t('vitrina.filters.ageMax', 'Edad máx.')} htmlFor="vt-age-max">
              <Input id="vt-age-max" type="number" min={8} max={60} value={form.ageMax} onChange={(e) => update('ageMax', e.target.value)} />
            </Field>
          </div>
          <Field label={t('vitrina.filters.minSpeed', 'Velocidad p95 mín. (km/h)')} htmlFor="vt-speed">
            <Input id="vt-speed" type="number" min={0} max={45} step={0.5} value={form.minTopSpeedKmh} onChange={(e) => update('minTopSpeedKmh', e.target.value)} />
          </Field>
          <Field label={t('vitrina.filters.minDistance', 'Distancia mín. por partido (km)')} htmlFor="vt-distance">
            <Input id="vt-distance" type="number" min={0} max={20} step={0.1} value={form.minDistancePerMatchKm} onChange={(e) => update('minDistancePerMatchKm', e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {t('vitrina.filters.note', 'Los filtros solo aplican a los datos que cada club decidió mostrar.')}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
              {t('vitrina.filters.reset', 'Limpiar')}
            </Button>
            <Button type="submit" size="sm">
              <Search className="size-4" aria-hidden="true" /> {t('vitrina.filters.search', 'Buscar')}
            </Button>
          </div>
        </div>
      </form>

      {search.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : search.isError ? (
        <ErrorState
          title={t('vitrina.loadError', 'No se pudo cargar la vitrina')}
          description={search.error instanceof Error ? search.error.message : undefined}
          onRetry={() => search.refetch()}
        />
      ) : !search.data || search.data.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('vitrina.emptyTitle', 'Sin perfiles para estos filtros')}
          description={t('vitrina.emptyBody', 'Prueba a ampliar la búsqueda. Solo aparecen perfiles publicados y listados por su club.')}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {search.data.items.map((card) => (
              <TalentCard key={card.card_id} card={card} onOpen={() => setOpenCard(card.card_id)} />
            ))}
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button variant="secondary" size="sm" disabled={page <= 1 || search.isFetching} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="size-4" aria-hidden="true" /> {t('vitrina.prev', 'Anterior')}
            </Button>
            <span className="text-sm text-muted-foreground">{t('vitrina.page', 'Página {{page}}', { page })}</span>
            <Button
              variant="secondary"
              size="sm"
              disabled={!search.data.has_more || page >= SHOWCASE_MAX_PAGE || search.isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('vitrina.next', 'Siguiente')} <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
          {page >= SHOWCASE_MAX_PAGE && search.data.has_more && (
            <p className="text-center text-xs text-muted-foreground">
              {t('vitrina.refineHint', 'Hay más resultados: afina los filtros para verlos.')}
            </p>
          )}
        </>
      )}

      <ShowcaseDetailDialog cardId={openCard} onClose={() => setOpenCard(null)} />
    </div>
  );
}
