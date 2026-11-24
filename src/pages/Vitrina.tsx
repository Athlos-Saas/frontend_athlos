import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, ChevronLeft, ChevronRight, Gauge, Mail, Route, UserRound, Users } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { SHOWCASE_MAX_PAGE, type ShowcaseCard, type ShowcaseFilters } from '@/features/athleteProfile/api';
import { ShowcaseRosterPanel } from '@/features/athleteProfile/components/ShowcaseRosterPanel';
import { VerifiedAthleteCard } from '@/features/athleteProfile/components/VerifiedAthleteCard';
import {
  POSITION_GROUPS,
  SHOWCASE_AGE_OPTIONS,
  SHOWCASE_DISTANCE_OPTIONS,
  SHOWCASE_SPEED_OPTIONS,
  canManageVerifiedProfile,
  countryName,
  sortedCountries,
} from '@/features/athleteProfile/constants';
import { useShowcaseAthlete, useShowcaseSearch } from '@/features/athleteProfile/queries';

/** Deportes ofrecidos en el filtro. Mismo conjunto que SPORT_LABEL del Header. */
const SPORTS = ['soccer', 'basketball', 'rugby'] as const;

/** Valor de "Todos/Cualquiera" en cada desplegable (Radix no admite value=""). */
const ANY = 'all';

/**
 * Todos los filtros son desplegables (regla de producto: el usuario nunca
 * escribe un filtro). Cada valor coincide exactamente con lo que el backend
 * compara: deporte y país por igualdad (país = código ISO), posición por
 * grupo GK/DEF/MID/FWD y los numéricos como umbral mínimo (gte).
 */
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
  sport: ANY,
  country: ANY,
  position: ANY,
  ageMin: ANY,
  ageMax: ANY,
  minTopSpeedKmh: ANY,
  minDistancePerMatchKm: ANY,
};

const pick = (value: string) => (value === ANY ? undefined : value);
const pickNum = (value: string) => (value === ANY ? undefined : Number(value));

function formToFilters(form: FilterForm): ShowcaseFilters {
  return {
    sport: pick(form.sport),
    country: pick(form.country),
    position: pick(form.position),
    ageMin: pickNum(form.ageMin),
    ageMax: pickNum(form.ageMax),
    minTopSpeedKmh: pickNum(form.minTopSpeedKmh),
    minDistancePerMatchKm: pickNum(form.minDistancePerMatchKm),
  };
}

/** Desplegable de filtro con la opción "Cualquiera/Todos" primero. */
function FilterSelect({
  id,
  label,
  value,
  anyLabel,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  anyLabel: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={ANY}>{anyLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function TalentCard({ card, onOpen }: { card: ShowcaseCard; onOpen: () => void }) {
  const { t, i18n } = useTranslation();
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
            {card.country && ` · ${countryName(card.country, i18n.language)}`}
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
 * perfiles publicados (con consentimiento) y que su club marcó "Aparecer en
 * la vitrina". Las tarjetas no traen el enlace público (el backend no lo
 * envía): el detalle se abre aquí, autenticado.
 *
 * Los filtros son desplegables y se aplican al elegir: sin teclear no hay
 * ráfagas de solicitudes, así que el límite por minuto del backend no exige
 * un botón "Buscar".
 *
 * `orgId` + `role`: la búsqueda es entre orgs y no filtra por la propia, pero
 * admin/coach ven además "Tus atletas en la vitrina" para publicar a su
 * plantel (la causa real de una vitrina vacía era que nadie sabía que había
 * que publicar).
 */
export default function Vitrina({ orgId, role }: { orgId: string; role: string | null }) {
  const { t, i18n } = useTranslation();
  const canManage = canManageVerifiedProfile(role);
  const [form, setForm] = useState<FilterForm>(EMPTY_FORM);
  const [page, setPage] = useState(1);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const rosterRef = useRef<HTMLElement>(null);
  const filters = useMemo(() => formToFilters(form), [form]);
  const search = useShowcaseSearch({ ...filters, page });
  const hasFilters = Object.values(form).some((value) => value !== ANY);

  const countries = useMemo(() => sortedCountries(i18n.language), [i18n.language]);
  const anyLabel = t('vitrina.filters.any', 'Cualquiera');

  const update = (key: keyof FilterForm, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Rango de edad coherente: si el mínimo supera al máximo se suelta el
      // otro extremo, en vez de mandar una búsqueda que nunca devuelve nada.
      if (next.ageMin !== ANY && next.ageMax !== ANY && Number(next.ageMin) > Number(next.ageMax)) {
        if (key === 'ageMin') next.ageMax = ANY;
        else next.ageMin = ANY;
      }
      return next;
    });
    setPage(1);
  };

  const handleReset = () => {
    setForm(EMPTY_FORM);
    setPage(1);
  };

  const scrollToRoster = () => rosterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const ageOptions = SHOWCASE_AGE_OPTIONS.map((age) => ({
    value: String(age),
    label: t('vitrina.filters.ageValue', '{{age}} años', { age }),
  }));

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

      <div className="rounded-lg border border-border bg-card p-4 shadow-subtle">
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            id="vt-sport"
            label={t('vitrina.filters.sport', 'Deporte')}
            value={form.sport}
            anyLabel={t('vitrina.filters.allSports', 'Todos')}
            options={SPORTS.map((sport) => ({ value: sport, label: t(`verifiedProfile.sport.${sport}`, sport) }))}
            onChange={(v) => update('sport', v)}
          />
          <FilterSelect
            id="vt-position"
            label={t('vitrina.filters.position', 'Posición')}
            value={form.position}
            anyLabel={t('vitrina.filters.allPositions', 'Todas')}
            options={POSITION_GROUPS.map((group) => ({ value: group, label: t(`vitrina.positionGroup.${group}`, group) }))}
            onChange={(v) => update('position', v)}
          />
          <FilterSelect
            id="vt-country"
            label={t('vitrina.filters.country', 'País')}
            value={form.country}
            anyLabel={t('vitrina.filters.allCountries', 'Todos')}
            options={countries.map((c) => ({ value: c.code, label: c.name }))}
            onChange={(v) => update('country', v)}
          />
          <div className="grid grid-cols-2 gap-2">
            <FilterSelect
              id="vt-age-min"
              label={t('vitrina.filters.ageMin', 'Edad mín.')}
              value={form.ageMin}
              anyLabel={anyLabel}
              options={ageOptions}
              onChange={(v) => update('ageMin', v)}
            />
            <FilterSelect
              id="vt-age-max"
              label={t('vitrina.filters.ageMax', 'Edad máx.')}
              value={form.ageMax}
              anyLabel={anyLabel}
              options={ageOptions}
              onChange={(v) => update('ageMax', v)}
            />
          </div>
          <FilterSelect
            id="vt-speed"
            label={t('vitrina.filters.minSpeed', 'Velocidad p95 mín. (km/h)')}
            value={form.minTopSpeedKmh}
            anyLabel={anyLabel}
            options={SHOWCASE_SPEED_OPTIONS.map((kmh) => ({
              value: String(kmh),
              label: t('vitrina.filters.speedValue', '≥ {{value}} km/h', { value: kmh }),
            }))}
            onChange={(v) => update('minTopSpeedKmh', v)}
          />
          <FilterSelect
            id="vt-distance"
            label={t('vitrina.filters.minDistance', 'Distancia mín. por partido (km)')}
            value={form.minDistancePerMatchKm}
            anyLabel={anyLabel}
            options={SHOWCASE_DISTANCE_OPTIONS.map((km) => ({
              value: String(km),
              label: t('vitrina.filters.distanceValue', '≥ {{value}} km', { value: km }),
            }))}
            onChange={(v) => update('minDistancePerMatchKm', v)}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {t('vitrina.filters.note', 'Los filtros solo aplican a los datos que cada club decidió mostrar.')}
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={!hasFilters}>
            {t('vitrina.filters.reset', 'Limpiar')}
          </Button>
        </div>
      </div>

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
        hasFilters ? (
          <EmptyState
            icon={Users}
            title={t('vitrina.emptyTitle', 'Sin perfiles para estos filtros')}
            description={t('vitrina.emptyBody', 'Prueba a ampliar la búsqueda. Solo aparecen perfiles publicados y listados por su club.')}
            action={
              <Button variant="secondary" size="sm" onClick={handleReset}>
                {t('vitrina.filters.reset', 'Limpiar')}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={BadgeCheck}
            title={t('vitrina.emptyAllTitle', 'La vitrina todavía no tiene perfiles')}
            description={
              canManage
                ? t(
                    'vitrina.emptyAllBodyManager',
                    'Solo aparecen atletas cuyo club publicó su perfil verificado, con consentimiento, y activó "Aparecer en la vitrina". Empieza por los tuyos: publícalos desde la lista de abajo.',
                  )
                : t(
                    'vitrina.emptyAllBody',
                    'Solo aparecen atletas cuyo club publicó su perfil verificado, con consentimiento, y activó "Aparecer en la vitrina". Pide a un admin o entrenador de tu organización que publique a sus atletas.',
                  )
            }
            action={
              canManage ? (
                <Button size="sm" onClick={scrollToRoster}>
                  {t('vitrina.emptyAllCta', 'Publicar a mis atletas')}
                </Button>
              ) : undefined
            }
          />
        )
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

      {canManage && <ShowcaseRosterPanel ref={rosterRef} orgId={orgId} />}

      <ShowcaseDetailDialog cardId={openCard} onClose={() => setOpenCard(null)} />
    </div>
  );
}
