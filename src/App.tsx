import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { AppShell } from '@/components/layout/AppShell';
import { ModulePlaceholder } from '@/components/dashboard/ModulePlaceholder';
import { NavGate } from '@/components/layout/NavGate';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useModulePreviews } from '@/constants/modulePreviews';
import { NAV_ITEMS_FLAT } from '@/constants/navigation';
import { fetchNavAccessSettings } from '@/lib/permissionSettings';
import { useNavAccessStore } from '@/store/navAccessStore';

import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';

const Administracion = lazy(() => import('./pages/Administracion'));
const AiIntelligenceCenter = lazy(() => import('./pages/AiIntelligenceCenter'));
const Alertas = lazy(() => import('./pages/Alertas'));
const Analisis = lazy(() => import('./pages/Analisis'));
const Atletas = lazy(() => import('./pages/Atletas'));
const Competiciones = lazy(() => import('./pages/Competiciones'));
const Configuracion = lazy(() => import('./pages/Configuracion'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Equipos = lazy(() => import('./pages/Equipos'));
const ModuloEntrenador = lazy(() => import('./pages/ModuloEntrenador'));
const ModelosIa = lazy(() => import('./pages/ModelosIa'));
const PlayerProfile = lazy(() => import('./pages/PlayerProfile'));
const Scouting = lazy(() => import('./pages/Scouting'));
const Temporadas = lazy(() => import('./pages/Temporadas'));

const PLACEHOLDER_ROUTES = new Set(['/pronosticos']);

export default function App() {
  const { t } = useTranslation();
  const { session, profile, isLoading, signIn, signOut } = useAuth();
  const orgId = profile?.org_id;
  const role = profile?.role ?? null;
  const modulePreviews = useModulePreviews();

  useEffect(() => {
    if (!orgId) return;
    let isMounted = true;
    fetchNavAccessSettings(orgId)
      .then((rows) => {
        if (!isMounted) return;
        const denied = new Set(
          rows.filter((r) => r.role === role && !r.allowed).map((r) => r.nav_key),
        );
        useNavAccessStore.getState().setDeniedKeys(denied);
      })
      .catch(() => {
        // Si falla la carga, no se restringe nada — mismo criterio que "ausencia
        // de fila = visible" (nunca bloquear por un error de red).
      });
    return () => {
      isMounted = false;
    };
  }, [orgId, role]);

  if (isLoading) return <Spinner label="Iniciando ATHLOS…" className="min-h-screen" />;
  if (!session) return <Login onSignIn={signIn} />;

  if (!orgId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-elevated">
          <h2 className="text-lg font-semibold text-foreground">Cuenta sin organización</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu usuario existe pero aún no pertenece a una organización. Pide a un administrador que
            te invite o corre el seed del backend.
          </p>
          <Button className="mt-4 w-full" variant="secondary" onClick={signOut}>
            Salir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<Spinner label="Cargando módulo…" className="min-h-[60vh]" />}>
      <Routes>
        <Route element={<AppShell profile={profile} onSignOut={signOut} />}>
          <Route index element={<Dashboard orgId={orgId} />} />
          <Route path="/entrenador" element={<NavGate navKey="/entrenador"><ModuloEntrenador orgId={orgId} /></NavGate>} />
          <Route path="/analisis" element={<NavGate navKey="/analisis"><Analisis orgId={orgId} role={role} /></NavGate>} />
          <Route path="/atletas" element={<NavGate navKey="/atletas"><Atletas orgId={orgId} role={role} /></NavGate>} />
          <Route path="/atletas/:playerId" element={<NavGate navKey="/atletas"><PlayerProfile orgId={orgId} role={role} /></NavGate>} />
          <Route path="/competiciones" element={<NavGate navKey="/competiciones"><Competiciones orgId={orgId} role={role} /></NavGate>} />
          <Route path="/modelos" element={<NavGate navKey="/modelos"><ModelosIa orgId={orgId} role={role} /></NavGate>} />
          <Route path="/ai" element={<NavGate navKey="/ai"><AiIntelligenceCenter orgId={orgId} /></NavGate>} />
          <Route path="/equipos" element={<NavGate navKey="/equipos"><Equipos orgId={orgId} /></NavGate>} />
          <Route path="/temporadas" element={<NavGate navKey="/temporadas"><Temporadas orgId={orgId} /></NavGate>} />
          <Route path="/scouting" element={<NavGate navKey="/scouting"><Scouting orgId={orgId} /></NavGate>} />
          <Route path="/alertas" element={<NavGate navKey="/alertas"><Alertas orgId={orgId} /></NavGate>} />
          <Route path="/configuracion" element={<NavGate navKey="/configuracion"><Configuracion orgId={orgId} role={role} /></NavGate>} />
          <Route
            path="/administracion"
            element={
              <NavGate navKey="/administracion">
                <Administracion orgId={orgId} role={role} currentUserId={profile.user_id} />
              </NavGate>
            }
          />

          {NAV_ITEMS_FLAT.filter((item) => item.comingSoon || PLACEHOLDER_ROUTES.has(item.to)).map((item) => {
            const preview = modulePreviews[item.to];
            const label = t(item.labelKey, item.label);
            return (
              <Route
                key={item.to}
                path={item.to}
                element={
                  <ModulePlaceholder
                    title={label}
                    icon={item.icon}
                    description={preview?.description || t('modulePreviews.fallbackDescription', 'Vista de {{label}} para tu organización.', { label: label.toLowerCase() })}
                    bullets={preview?.bullets}
                    kpis={preview?.kpis}
                  />
                }
              />
            );
          })}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
