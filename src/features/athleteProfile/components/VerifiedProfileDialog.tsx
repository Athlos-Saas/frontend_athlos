import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Copy, ExternalLink, Info, RefreshCw, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { supabase } from '@/lib/supabase';
import { toast } from '@/store/toastStore';
import {
  PROFILE_SECTIONS,
  publishAthleteProfile,
  regenerateAthleteProfileLink,
  saveAthleteProfile,
  unpublishAthleteProfile,
  type AthleteProfileManageView,
  type AthleteProfileSettings,
  type ProfileSection,
} from '../api';
import {
  CONSENT_EVIDENCE_CODES,
  CONTACT_LABEL_CODES,
  PROFILE_COUNTRIES,
  classYearOptions,
  publicProfileUrl,
  sortedCountries,
} from '../constants';
import { useAthleteProfileManage } from '../queries';

/** Valor de "sin especificar" en los desplegables (Radix no admite value=""). */
const NONE = '__none__';

/** Solo valores de la lista cerrada: uno fuera de ella daría 422 al guardar. */
const inList = (list: readonly string[], value: string | null): string | null =>
  value && list.includes(value) ? value : null;

const EMPTY_SETTINGS: AthleteProfileSettings = {
  visible_sections: ['bio'],
  headline: null,
  bio: null,
  class_year: null,
  country: null,
  open_to_contact: false,
  contact_label: null,
  contact_email: null,
  listed_in_showcase: false,
  athlete_consent: false,
  guardian_consent: false,
  consent_evidence_ref: null,
};

function settingsFromView(view: AthleteProfileManageView | undefined, defaultListed: boolean): AthleteProfileSettings {
  const p = view?.profile;
  if (!p) return { ...EMPTY_SETTINGS, listed_in_showcase: defaultListed };
  return {
    visible_sections: p.visible_sections,
    headline: p.headline,
    bio: p.bio,
    class_year: p.class_year,
    country: inList(PROFILE_COUNTRIES, p.country),
    open_to_contact: p.open_to_contact,
    contact_label: inList(CONTACT_LABEL_CODES, p.contact_label),
    contact_email: p.contact_email,
    // Un borrador siempre vuelve del backend con listed=false (029 exige
    // publicar antes de listar), así que ese valor no expresa intención: se
    // usa el default para que "Guardar" y luego "Publicar" no lo pierda.
    listed_in_showcase: p.is_published ? p.listed_in_showcase : defaultListed,
    athlete_consent: p.athlete_consent,
    guardian_consent: p.guardian_consent,
    consent_evidence_ref: inList(CONSENT_EVIDENCE_CODES, p.consent_evidence_ref),
  };
}

const nullIfEmpty = (value: string) => (value.trim() === '' ? null : value);

export interface VerifiedProfileDialogProps {
  orgId: string;
  playerId: string;
  playerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Valor inicial de "Aparecer en la vitrina" cuando el atleta aún no tiene
   * perfil. Desde la Vitrina se abre en `true`: quien publica desde ahí quiere
   * que aparezca, y publicar sin listar era otra forma de ver la vitrina vacía.
   */
  defaultListed?: boolean;
}

/**
 * Gestión del perfil verificado desde la ficha del jugador o la Vitrina (solo
 * admin/coach; el backend lo revalida). Publicar es un acto explícito y
 * separado de guardar: guardar nunca expone nada nuevo por sí solo.
 *
 * Todo campo estructurado es un desplegable (regla de producto: el usuario no
 * escribe valores que luego hay que buscar o mostrar). Solo quedan como texto
 * el titular y la biografía, que son narrativa sin lista razonable posible.
 */
export function VerifiedProfileDialog({
  orgId,
  playerId,
  playerName,
  open,
  onOpenChange,
  defaultListed = false,
}: VerifiedProfileDialogProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const manage = useAthleteProfileManage(orgId, playerId, open);
  const [form, setForm] = useState<AthleteProfileSettings>(EMPTY_SETTINGS);
  const [busy, setBusy] = useState<'save' | 'publish' | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    if (manage.data) setForm(settingsFromView(manage.data, defaultListed));
  }, [manage.data, defaultListed]);

  // El email de contacto se ELIGE, no se escribe: el de la cuenta de quien
  // publica (staff con login en la org, o sea institucional) o el ya
  // guardado. Abrir un campo libre era la vía para que terminara ahí el email
  // personal del atleta.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setSessionEmail(data.session?.user.email?.toLowerCase() ?? null);
      })
      .catch(() => {
        if (alive) setSessionEmail(null);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  const countries = useMemo(() => sortedCountries(i18n.language), [i18n.language]);
  const classYears = useMemo(() => classYearOptions(form.class_year), [form.class_year]);
  const emailOptions = useMemo(
    () => Array.from(new Set([sessionEmail, form.contact_email].filter((e): e is string => !!e))),
    [sessionEmail, form.contact_email],
  );

  const profile = manage.data?.profile ?? null;
  const athlete = manage.data?.athlete;
  const requiresGuardian = athlete?.requires_guardian_consent ?? true;
  const isPublished = !!profile?.is_published;
  const link = profile ? publicProfileUrl(profile.slug) : null;

  const contactInvalid = form.open_to_contact && !form.contact_email;
  const canPublish = useMemo(
    () =>
      form.athlete_consent &&
      (!requiresGuardian || form.guardian_consent) &&
      form.visible_sections.length > 0 &&
      !contactInvalid,
    [form, requiresGuardian, contactInvalid],
  );

  const update = <K extends keyof AthleteProfileSettings>(key: K, value: AthleteProfileSettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleSection = (section: ProfileSection, checked: boolean) =>
    setForm((prev) => ({
      ...prev,
      visible_sections: checked
        ? PROFILE_SECTIONS.filter((s) => s === section || prev.visible_sections.includes(s))
        : prev.visible_sections.filter((s) => s !== section),
    }));

  const applyView = (view: AthleteProfileManageView) => {
    queryClient.setQueryData(['athleteProfile', 'manage', orgId, playerId], view);
    // El estado cambió: la lista "Tus atletas en la vitrina" y la búsqueda
    // tienen que reflejarlo sin esperar al staleTime.
    void queryClient.invalidateQueries({ queryKey: ['athleteProfile', 'roster', orgId] });
    void queryClient.invalidateQueries({ queryKey: ['athleteProfile', 'showcase'] });
  };

  const setOpenToContact = (value: boolean) =>
    setForm((prev) => ({
      ...prev,
      open_to_contact: value,
      // Prellenado: sin esto el switch dejaba un campo obligatorio vacío.
      contact_email: value && !prev.contact_email ? sessionEmail : prev.contact_email,
    }));

  const fail = (error: unknown) =>
    toast({
      title: t('verifiedProfile.manage.actionError', 'No se pudo completar la acción'),
      description: error instanceof Error ? error.message : String(error),
      variant: 'danger',
    });

  const handleSave = async () => {
    setBusy('save');
    try {
      const view = await saveAthleteProfile(orgId, playerId, form);
      applyView(view);
      if (view.unpublished_due_to_consent) {
        toast({
          title: t('verifiedProfile.manage.unpublishedByConsent', 'Perfil despublicado'),
          description: t('verifiedProfile.manage.unpublishedByConsentBody', 'Se retiró un consentimiento obligatorio, así que el enlace dejó de funcionar.'),
          variant: 'warning',
        });
      } else {
        toast({ title: t('verifiedProfile.manage.saved', 'Configuración guardada'), variant: 'success' });
      }
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  };

  const handlePublish = async () => {
    setBusy('publish');
    try {
      await saveAthleteProfile(orgId, playerId, form);
      const view = await publishAthleteProfile(orgId, playerId, form.listed_in_showcase);
      applyView(view);
      toast({ title: t('verifiedProfile.manage.published', 'Perfil publicado'), variant: 'success' });
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  };

  const handleUnpublish = async () => {
    try {
      applyView(await unpublishAthleteProfile(orgId, playerId));
      toast({ title: t('verifiedProfile.manage.unpublished', 'Perfil despublicado'), variant: 'success' });
    } catch (error) {
      fail(error);
    }
  };

  const handleRegenerate = async () => {
    try {
      applyView(await regenerateAthleteProfileLink(orgId, playerId));
      toast({ title: t('verifiedProfile.manage.linkRegenerated', 'Enlace regenerado: el anterior ya no funciona'), variant: 'success' });
    } catch (error) {
      fail(error);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: t('verifiedProfile.manage.linkCopied', 'Enlace copiado'), variant: 'success' });
    } catch {
      toast({ title: t('verifiedProfile.manage.copyError', 'No se pudo copiar: selecciona el enlace y cópialo a mano'), variant: 'warning' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {t('verifiedProfile.manage.title', 'Perfil verificado · {{name}}', { name: playerName })}
            {profile && (
              <Badge variant={isPublished ? 'success' : 'neutral'}>
                {isPublished ? t('verifiedProfile.manage.statusPublished', 'Publicado') : t('verifiedProfile.manage.statusDraft', 'Sin publicar')}
              </Badge>
            )}
            {isPublished && profile?.listed_in_showcase && (
              <Badge variant="ai">{t('verifiedProfile.manage.statusListed', 'En la vitrina')}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {t(
              'verifiedProfile.manage.description',
              'Ficha compartible con datos medidos por ATHLOS (video/GPS). Solo se publica lo que marques y con consentimiento registrado.',
            )}
          </DialogDescription>
        </DialogHeader>

        {manage.isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : manage.isError ? (
          <ErrorState
            title={t('verifiedProfile.manage.loadError', 'No se pudo cargar el perfil verificado')}
            description={manage.error instanceof Error ? manage.error.message : undefined}
            onRetry={() => manage.refetch()}
          />
        ) : (
          <div className="space-y-6">
            {/* Enlace */}
            {isPublished && link && (
              <div className="space-y-2 rounded-lg border border-success/30 bg-success/5 p-4">
                <Label htmlFor="vp-link">{t('verifiedProfile.manage.linkLabel', 'Enlace público')}</Label>
                <div className="flex gap-2">
                  <Input id="vp-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                  <Button variant="secondary" size="icon" onClick={handleCopy} aria-label={t('verifiedProfile.manage.copyLink', 'Copiar enlace')}>
                    <Copy className="size-4" aria-hidden="true" />
                  </Button>
                  <Button variant="secondary" size="icon" asChild>
                    <a href={link} target="_blank" rel="noopener noreferrer" aria-label={t('verifiedProfile.manage.openLink', 'Abrir ficha')}>
                      <ExternalLink className="size-4" aria-hidden="true" />
                    </a>
                  </Button>
                </div>
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="sm">
                      <RefreshCw className="size-4" aria-hidden="true" /> {t('verifiedProfile.manage.regenerate', 'Regenerar enlace')}
                    </Button>
                  }
                  title={t('verifiedProfile.manage.regenerateTitle', '¿Regenerar el enlace?')}
                  description={t('verifiedProfile.manage.regenerateBody', 'El enlace actual dejará de funcionar para todos los que lo tengan.')}
                  confirmLabel={t('verifiedProfile.manage.regenerate', 'Regenerar enlace')}
                  onConfirm={handleRegenerate}
                />
              </div>
            )}

            {/* Frontera de salud */}
            <div className="flex gap-3 rounded-lg border border-border bg-panel p-3 text-xs text-muted-foreground">
              <ShieldAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
              <p>
                {t(
                  'verifiedProfile.manage.healthBoundary',
                  'Nunca se publican datos de salud: bienestar, lesiones, riesgo de lesión o fatiga, frecuencia cardiaca, peso ni notas internas. No los escribas tampoco en los textos libres.',
                )}
              </p>
            </div>

            {/* Secciones */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-foreground">{t('verifiedProfile.manage.sectionsTitle', 'Secciones visibles')}</legend>
              {PROFILE_SECTIONS.map((section) => (
                <label key={section} className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={form.visible_sections.includes(section)}
                    onCheckedChange={(checked) => toggleSection(section, checked === true)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{t(`verifiedProfile.section.${section}`, section)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`verifiedProfile.sectionHint.${section}`, '')}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {/* Bio */}
            {form.visible_sections.includes('bio') && (
              <div>
                <Field label={t('verifiedProfile.manage.headline', 'Titular')} htmlFor="vp-headline" hint={t('verifiedProfile.manage.headlineHint', 'Máx. 140 caracteres')}>
                  <Input id="vp-headline" maxLength={140} value={form.headline ?? ''} onChange={(e) => update('headline', nullIfEmpty(e.target.value))} />
                </Field>
                <Field label={t('verifiedProfile.manage.bio', 'Biografía')} htmlFor="vp-bio" hint={t('verifiedProfile.manage.bioHint', 'Máx. 600 caracteres. Sin datos de salud ni de contacto personal.')}>
                  <Textarea id="vp-bio" maxLength={600} value={form.bio ?? ''} onChange={(e) => update('bio', nullIfEmpty(e.target.value))} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('verifiedProfile.manage.classYear', 'Promoción (año de egreso)')} htmlFor="vp-class">
                    <Select
                      value={form.class_year != null ? String(form.class_year) : NONE}
                      onValueChange={(v) => update('class_year', v === NONE ? null : Number(v))}
                    >
                      <SelectTrigger id="vp-class">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value={NONE}>{t('verifiedProfile.manage.notSpecified', 'Sin especificar')}</SelectItem>
                        {classYears.map((year) => (
                          <SelectItem key={year} value={String(year)}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t('verifiedProfile.manage.country', 'País')} htmlFor="vp-country">
                    <Select value={form.country ?? NONE} onValueChange={(v) => update('country', v === NONE ? null : v)}>
                      <SelectTrigger id="vp-country">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value={NONE}>{t('verifiedProfile.manage.notSpecified', 'Sin especificar')}</SelectItem>
                        {countries.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>
            )}

            {/* Contacto */}
            <div className="space-y-3">
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-foreground">{t('verifiedProfile.manage.openToContact', 'Disponible para ser contactado')}</span>
                <Switch checked={form.open_to_contact} onCheckedChange={setOpenToContact} />
              </label>
              {form.open_to_contact && (
                <div>
                  <p className="mb-3 flex gap-2 text-xs text-muted-foreground">
                    <Info className="size-4 shrink-0" aria-hidden="true" />
                    {t('verifiedProfile.manage.contactWarning', 'Usa un contacto institucional del club (p. ej. dirección deportiva). Nunca el email o teléfono personal del atleta, sobre todo si es menor.')}
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label={t('verifiedProfile.manage.contactLabel', 'Área o cargo')} htmlFor="vp-contact-label">
                      <Select value={form.contact_label ?? NONE} onValueChange={(v) => update('contact_label', v === NONE ? null : v)}>
                        <SelectTrigger id="vp-contact-label">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>{t('verifiedProfile.manage.notSpecified', 'Sin especificar')}</SelectItem>
                          {CONTACT_LABEL_CODES.map((code) => (
                            <SelectItem key={code} value={code}>
                              {t(`verifiedProfile.contactLabel.${code}`, code)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field
                      label={t('verifiedProfile.manage.contactEmail', 'Email institucional')}
                      htmlFor="vp-contact-email"
                      required
                      hint={t('verifiedProfile.manage.contactEmailHint', 'Se usa el email de tu cuenta ATHLOS. Si otra persona del staff debe recibir los contactos, que publique ella el perfil.')}
                      error={contactInvalid ? t('verifiedProfile.manage.contactEmailRequired', 'Obligatorio para aceptar contacto') : undefined}
                    >
                      <Select value={form.contact_email ?? NONE} onValueChange={(v) => update('contact_email', v === NONE ? null : v)}>
                        <SelectTrigger id="vp-contact-email">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>{t('verifiedProfile.manage.chooseEmail', 'Elige un email')}</SelectItem>
                          {emailOptions.map((email) => (
                            <SelectItem key={email} value={email}>
                              {email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </div>
              )}
            </div>

            {/* Consentimiento */}
            <fieldset className="space-y-3 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-semibold text-foreground">{t('verifiedProfile.manage.consentTitle', 'Consentimiento')}</legend>
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox checked={form.athlete_consent} onCheckedChange={(v) => update('athlete_consent', v === true)} />
                <span className="text-sm text-foreground">
                  {t('verifiedProfile.manage.athleteConsent', 'El atleta aceptó explícitamente publicar este perfil.')}
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox checked={form.guardian_consent} onCheckedChange={(v) => update('guardian_consent', v === true)} />
                <span className="text-sm text-foreground">
                  {t('verifiedProfile.manage.guardianConsent', 'Su tutor legal dio consentimiento.')}
                  {requiresGuardian && (
                    <Badge variant="warning" className="ml-2">
                      {t('verifiedProfile.manage.required', 'Obligatorio')}
                    </Badge>
                  )}
                </span>
              </label>
              {requiresGuardian && (
                <p className="text-xs text-warning">
                  {athlete?.has_birthdate
                    ? t('verifiedProfile.manage.minorNotice', 'El atleta es menor de edad: sin consentimiento del tutor no se puede publicar.')
                    : t('verifiedProfile.manage.noBirthdateNotice', 'No hay fecha de nacimiento cargada: se trata como menor y hace falta el consentimiento del tutor.')}
                </p>
              )}
              <Field
                label={t('verifiedProfile.manage.evidence', 'Referencia del respaldo (interna)')}
                htmlFor="vp-evidence"
                hint={t('verifiedProfile.manage.evidenceHint', 'Dónde está archivado el formulario firmado. Sin datos personales del tutor. Nunca se publica.')}
                className="mb-0"
              >
                <Select
                  value={form.consent_evidence_ref ?? NONE}
                  onValueChange={(v) => update('consent_evidence_ref', v === NONE ? null : v)}
                >
                  <SelectTrigger id="vp-evidence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t('verifiedProfile.manage.notSpecified', 'Sin especificar')}</SelectItem>
                    {CONSENT_EVIDENCE_CODES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {t(`verifiedProfile.evidence.${code}`, code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {profile?.consent_recorded_at && (
                <p className="text-xs text-muted-foreground">
                  {t('verifiedProfile.manage.consentRecorded', 'Registrado por {{name}} el {{date}}', {
                    name: profile.consent_recorded_by_name ?? '--',
                    date: new Date(profile.consent_recorded_at).toLocaleString(),
                  })}
                </p>
              )}
            </fieldset>

            {/* Vitrina */}
            <label className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold text-foreground">{t('verifiedProfile.manage.listed', 'Aparecer en la vitrina')}</span>
                <span className="block text-xs text-muted-foreground">
                  {t('verifiedProfile.manage.listedHint', 'Scouts y clubes de otras organizaciones ATHLOS podrán encontrarlo en la búsqueda. Sin esto, solo lo ve quien tenga el enlace.')}
                </span>
              </span>
              <Switch checked={form.listed_in_showcase} onCheckedChange={(v) => update('listed_in_showcase', v)} />
            </label>
          </div>
        )}

        {!manage.isLoading && !manage.isError && (
          <DialogFooter className="flex-wrap">
            {isPublished && (
              <ConfirmDialog
                trigger={<Button variant="danger" size="sm">{t('verifiedProfile.manage.unpublish', 'Despublicar')}</Button>}
                title={t('verifiedProfile.manage.unpublishTitle', '¿Despublicar el perfil?')}
                description={t('verifiedProfile.manage.unpublishBody', 'El enlace dejará de funcionar y el perfil saldrá de la vitrina de inmediato.')}
                confirmLabel={t('verifiedProfile.manage.unpublish', 'Despublicar')}
                onConfirm={handleUnpublish}
              />
            )}
            <Button variant="secondary" size="sm" onClick={handleSave} isLoading={busy === 'save'} disabled={busy !== null || contactInvalid}>
              {t('verifiedProfile.manage.save', 'Guardar')}
            </Button>
            <Button size="sm" onClick={handlePublish} isLoading={busy === 'publish'} disabled={busy !== null || !canPublish}>
              {isPublished ? t('verifiedProfile.manage.saveAndUpdate', 'Guardar y actualizar') : t('verifiedProfile.manage.publish', 'Publicar')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
