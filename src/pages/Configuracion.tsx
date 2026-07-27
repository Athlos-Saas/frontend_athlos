import { useEffect, useState } from 'react';
import { Building2, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { supabase } from '@/lib/supabase';
import { toast } from '@/store/toastStore';
import type { Organization } from '@/types/domain';
import { isAdmin } from '@/utils/permissions';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  coach: 'Entrenador',
  medical: 'Médico',
  analyst: 'Analista',
  viewer: 'Solo lectura',
};

/**
 * Configuración = lo único configurable HOY con el esquema real:
 * - Organización (name/country editables solo por admin, vía RLS existente;
 *   plan es de solo lectura — lo gestiona la plataforma, no el cliente).
 * - Perfil propio (full_name, vía profiles_update_own).
 * No se muestran secciones de notificaciones/apariencia/etc. porque no hay
 * ninguna tabla que las respalde.
 */
export default function Configuracion({ orgId, role }: { orgId: string; role: string | null }) {
  const { t } = useTranslation();
  const [org, setOrg] = useState<Organization | null>(null);
  const [orgForm, setOrgForm] = useState({ name: '', country: '' });
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const isAdminUser = isAdmin(role);

  useEffect(() => {
    Promise.all([
      supabase.from('organizations').select('id, name, plan, country').eq('id', orgId).maybeSingle(),
      supabase.auth.getUser(),
    ]).then(async ([orgRes, userRes]) => {
      const orgData = orgRes.data as Organization | null;
      setOrg(orgData);
      if (orgData) setOrgForm({ name: orgData.name, country: orgData.country ?? '' });

      const user = userRes.data.user;
      setEmail(user?.email ?? null);
      setUserId(user?.id ?? null);
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle();
        setProfileName(profile?.full_name ?? '');
      }
      setIsLoaded(true);
    });
  }, [orgId]);

  const handleSaveOrg = async () => {
    if (!orgForm.name.trim()) {
      toast({ title: t('configuracion.toast.nameRequired', 'El nombre no puede quedar vacío'), variant: 'warning' });
      return;
    }
    setIsSavingOrg(true);
    const { error } = await supabase
      .from('organizations')
      .update({ name: orgForm.name.trim(), country: orgForm.country.trim() || null })
      .eq('id', orgId);
    setIsSavingOrg(false);
    if (error) {
      toast({ title: t('configuracion.toast.saveOrgError', 'No se pudo guardar'), description: error.message, variant: 'danger' });
      return;
    }
    toast({ title: t('configuracion.toast.orgUpdated', 'Organización actualizada'), variant: 'success' });
  };

  const handleSaveProfile = async () => {
    if (!userId) return;
    setIsSavingProfile(true);
    const { error } = await supabase.from('profiles').update({ full_name: profileName.trim() || null }).eq('user_id', userId);
    setIsSavingProfile(false);
    if (error) {
      toast({ title: t('configuracion.toast.saveProfileError', 'No se pudo guardar tu perfil'), description: error.message, variant: 'danger' });
      return;
    }
    toast({
      title: t('configuracion.toast.profileUpdated', 'Perfil actualizado'),
      description: t('configuracion.toast.profileUpdatedDesc', 'Se verá reflejado al recargar.'),
      variant: 'success',
    });
  };

  if (!isLoaded) return <Skeleton className="h-96 w-full" />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('configuracion.title', 'Configuración')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('configuracion.subtitle', 'Datos de tu organización y de tu cuenta')}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="animate-slide-up" style={{ animationFillMode: 'backwards' }}>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-4 text-ai" aria-hidden="true" /> {t('configuracion.org.title', 'Organización')}
              </CardTitle>
              <CardDescription className="mt-1">
                {isAdminUser
                  ? t('configuracion.org.descriptionAdmin', 'Solo los administradores pueden editar estos datos.')
                  : t('configuracion.org.descriptionReadonly', 'Solo lectura — requiere rol de administrador para editar.')}
              </CardDescription>
            </div>
            {org?.plan && <Badge variant="purple">{t('configuracion.org.plan', 'Plan {{plan}}', { plan: org.plan })}</Badge>}
          </CardHeader>
          <Field label={t('configuracion.org.nameLabel', 'Nombre')} htmlFor="org-name">
            <Input
              id="org-name"
              value={orgForm.name}
              disabled={!isAdminUser}
              onChange={(event) => setOrgForm((form) => ({ ...form, name: event.target.value }))}
            />
          </Field>
          <Field label={t('configuracion.org.countryLabel', 'País')} htmlFor="org-country">
            <Input
              id="org-country"
              value={orgForm.country}
              disabled={!isAdminUser}
              placeholder={t('configuracion.org.countryPlaceholder', '--')}
              onChange={(event) => setOrgForm((form) => ({ ...form, country: event.target.value }))}
            />
          </Field>
          {isAdminUser && (
            <Button size="sm" isLoading={isSavingOrg} onClick={handleSaveOrg}>
              {t('configuracion.org.save', 'Guardar organización')}
            </Button>
          )}
        </Card>

        <Card className="animate-slide-up" style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-4 text-ai" aria-hidden="true" /> {t('configuracion.account.title', 'Mi cuenta')}
              </CardTitle>
              <CardDescription className="mt-1">{email ?? '--'}</CardDescription>
            </div>
            {role && <Badge variant="ai">{t(`roles.label.${role}`, ROLE_LABEL[role] ?? role)}</Badge>}
          </CardHeader>
          <Field label={t('configuracion.account.nameLabel', 'Nombre completo')} htmlFor="profile-name">
            <Input id="profile-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} />
          </Field>
          <Button size="sm" isLoading={isSavingProfile} onClick={handleSaveProfile}>
            {t('configuracion.account.save', 'Guardar perfil')}
          </Button>
        </Card>
      </div>
    </div>
  );
}
