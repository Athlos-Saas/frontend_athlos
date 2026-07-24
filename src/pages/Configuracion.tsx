import { useEffect, useState } from 'react';
import { Building2, UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { supabase } from '@/lib/supabase';
import { toast } from '@/store/toastStore';
import type { Organization } from '@/types/domain';

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
  const [org, setOrg] = useState<Organization | null>(null);
  const [orgForm, setOrgForm] = useState({ name: '', country: '' });
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const isAdmin = role === 'admin';

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
      toast({ title: 'El nombre no puede quedar vacío', variant: 'warning' });
      return;
    }
    setIsSavingOrg(true);
    const { error } = await supabase
      .from('organizations')
      .update({ name: orgForm.name.trim(), country: orgForm.country.trim() || null })
      .eq('id', orgId);
    setIsSavingOrg(false);
    if (error) {
      toast({ title: 'No se pudo guardar', description: error.message, variant: 'danger' });
      return;
    }
    toast({ title: 'Organización actualizada', variant: 'success' });
  };

  const handleSaveProfile = async () => {
    if (!userId) return;
    setIsSavingProfile(true);
    const { error } = await supabase.from('profiles').update({ full_name: profileName.trim() || null }).eq('user_id', userId);
    setIsSavingProfile(false);
    if (error) {
      toast({ title: 'No se pudo guardar tu perfil', description: error.message, variant: 'danger' });
      return;
    }
    toast({ title: 'Perfil actualizado', description: 'Se verá reflejado al recargar.', variant: 'success' });
  };

  if (!isLoaded) return <Skeleton className="h-96 w-full" />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">Datos de tu organización y de tu cuenta</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="animate-slide-up" style={{ animationFillMode: 'backwards' }}>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-4 text-ai" aria-hidden="true" /> Organización
              </CardTitle>
              <CardDescription className="mt-1">
                {isAdmin ? 'Solo los administradores pueden editar estos datos.' : 'Solo lectura — requiere rol de administrador para editar.'}
              </CardDescription>
            </div>
            {org?.plan && <Badge variant="purple">Plan {org.plan}</Badge>}
          </CardHeader>
          <Field label="Nombre" htmlFor="org-name">
            <Input
              id="org-name"
              value={orgForm.name}
              disabled={!isAdmin}
              onChange={(event) => setOrgForm((form) => ({ ...form, name: event.target.value }))}
            />
          </Field>
          <Field label="País" htmlFor="org-country">
            <Input
              id="org-country"
              value={orgForm.country}
              disabled={!isAdmin}
              placeholder="--"
              onChange={(event) => setOrgForm((form) => ({ ...form, country: event.target.value }))}
            />
          </Field>
          {isAdmin && (
            <Button size="sm" isLoading={isSavingOrg} onClick={handleSaveOrg}>
              Guardar organización
            </Button>
          )}
        </Card>

        <Card className="animate-slide-up" style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-4 text-ai" aria-hidden="true" /> Mi cuenta
              </CardTitle>
              <CardDescription className="mt-1">{email ?? '--'}</CardDescription>
            </div>
            {role && <Badge variant="ai">{ROLE_LABEL[role] ?? role}</Badge>}
          </CardHeader>
          <Field label="Nombre completo" htmlFor="profile-name">
            <Input id="profile-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} />
          </Field>
          <Button size="sm" isLoading={isSavingProfile} onClick={handleSaveProfile}>
            Guardar perfil
          </Button>
        </Card>
      </div>
    </div>
  );
}
