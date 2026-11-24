import { Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { AppShell } from '@/components/layout/AppShell';
import { ModulePlaceholder } from '@/components/dashboard/ModulePlaceholder';
import { NavGate } from '@/components/layout/NavGate';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useModulePreviews } from '@/constants/modulePreviews';
import { NAV_ITEMS_FLAT } from '@/constants/navigation';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { fetchNavAccessSettings } from '@/lib/permissionSettings';
import { useNavAccessStore } from '@/store/navAccessStore';
import { isAthlete } from '@/utils/permissions';

import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';

const Administracion = lazyWithRetry(() => import('./pages/Administracion'));
const AiIntelligenceCenter = lazyWithRetry(() => import('./pages/AiIntelligenceCenter'));
const Alertas = lazyWithRetry(() => import('./pages/Alertas'));
const Analisis = lazyWithRetry(() => import('./pages/Analisis'));
const AthletePortal = lazyWithRetry(() => import('./pages/AthletePortal'));
const Atletas = lazyWithRetry(() => import('./pages/Atletas'));
const Competiciones = lazyWithRetry(() => import('./pages/Competiciones'));
const Configuracion = lazyWithRetry(() => import('./pages/Configuracion'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const Equipos = lazyWithRetry(() => import('./pages/Equipos'));
const ModuloEntrenador = lazyWithRetry(() => import('./pages/ModuloEntrenador'));
const ModelosIa = lazyWithRetry(() => import('./pages/ModelosIa'));
const PlayerProfile = lazyWithRetry(() => import('./pages/PlayerProfile'));
const PizarraTactica = lazyWithRetry(() => import('./pages/PizarraTactica'));
const Scouting = lazyWithRetry(() => import('./pages/Scouting'));
const SimulacionIA = lazyWithRetry(() => import('./pages/SimulacionIA'));
const StatsBombAnalytics = lazyWithRetry(() => import('./pages/StatsBombAnalytics'));
const StatsBombPlayers = lazyWithRetry(() => import('./pages/StatsBombPlayers'));
const PronosticosIA = lazyWithRetry(() => import('./pages/PronosticosIA'));
const PublicAthleteProfile = lazyWithRetry(() => import('./pages/PublicAthleteProfile'));
const Reportes = lazyWithRetry(() => import('./pages/Reportes'));
const Rivales = lazyWithRetry(() => import('./pages/Rivales'));
const Temporadas = lazyWithRetry(() => import('./pages/Temporadas'));
const Vitrina = lazyWithRetry(() => import('./pages/Vitrina'));

const PLACEHOLDER_ROUTES = new Set<string>([]);

export default function App() {
  const { t } = useTranslation();
  const { session, profile, isLoading, signIn, signOut } = useAuth();
  const orgId = profile?.org_id;
  const role = profile?.role ?? null;
  const modulePreviews = useModulePreviews();
  const location = useLocation();

  useEffect(() => {
    // El atleta no usa el sidebar: sin matriz de navegación que cargar.
    if (!orgId || isAthlete(role)) return;
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

  // El perfil verificado (/p/:slug) es público: se resuelve ANTES del gate de
  // sesión para que un scout o una universidad lo abra sin cuenta. El backend
  // solo devuelve los campos de la lista blanca (ver public_athlete_profile_service).
  if (location.pathname.startsWith('/p/')) {
    return (
      <Suspense fallback={<Spinner label="Cargando perfil…" className="min-h-screen" />}>
        <Routes>
          <Route path="/p/:slug" element={<PublicAthleteProfile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    );
  }

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

  // El atleta vive en su propio portal (mobile-first): cualquier URL lo lleva
  // ahí, sin AppShell, sidebar ni AthlosBot. RLS (030) es lo que de verdad le
  // impide leer datos de compañeros; esto es solo la experiencia.
  if (isAthlete(role)) {
    return (
      <Suspense fallback={<Spinner label="Cargando…" className="min-h-screen" />}>
        <AthletePortal orgId={orgId} userId={profile.user_id} fullName={profile.full_name} onSignOut={signOut} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<Spinner label="Cargando módulo…" className="min-h-[60vh]" />}>
      <Routes>
        <Route element={<AppShell profile={profile} onSignOut={signOut} />}>
          <Route index element={<Dashboard orgId={orgId} />} />
          <Route path="/entrenador" element={<NavGate navKey="/entrenador"><ModuloEntrenador orgId={orgId} /></NavGate>} />
          <Route path="/pizarra" element={<NavGate navKey="/pizarra"><PizarraTactica orgId={orgId} userId={profile.user_id} /></NavGate>} />
          <Route path="/analisis" element={<NavGate navKey="/analisis"><Analisis orgId={orgId} role={role} /></NavGate>} />
          <Route path="/atletas" element={<NavGate navKey="/atletas"><Atletas orgId={orgId} role={role} /></NavGate>} />
          <Route path="/atletas/:playerId" element={<NavGate navKey="/atletas"><PlayerProfile orgId={orgId} role={role} /></NavGate>} />
          <Route path="/competiciones" element={<NavGate navKey="/competiciones"><Competiciones orgId={orgId} role={role} /></NavGate>} />
          <Route path="/modelos" element={<NavGate navKey="/modelos"><ModelosIa orgId={orgId} role={role} /></NavGate>} />
          <Route path="/ai" element={<NavGate navKey="/ai"><AiIntelligenceCenter orgId={orgId} /></NavGate>} />
          <Route path="/pronosticos" element={<NavGate navKey="/pronosticos"><PronosticosIA orgId={orgId} /></NavGate>} />
          <Route path="/equipos" element={<NavGate navKey="/equipos"><Equipos orgId={orgId} /></NavGate>} />
          <Route path="/temporadas" element={<NavGate navKey="/temporadas"><Temporadas orgId={orgId} /></NavGate>} />
          <Route path="/scouting" element={<NavGate navKey="/scouting"><Scouting orgId={orgId} /></NavGate>} />
          <Route path="/statsbomb" element={<NavGate navKey="/statsbomb"><StatsBombAnalytics orgId={orgId} /></NavGate>} />
          <Route path="/statsbomb-jugadores" element={<NavGate navKey="/statsbomb-jugadores"><StatsBombPlayers /></NavGate>} />
          <Route path="/simulacion" element={<NavGate navKey="/simulacion"><SimulacionIA orgId={orgId} role={role} /></NavGate>} />
          <Route path="/rivales" element={<NavGate navKey="/rivales"><Rivales orgId={orgId} role={role} /></NavGate>} />
          <Route path="/vitrina" element={<NavGate navKey="/vitrina"><Vitrina orgId={orgId} role={role} /></NavGate>} />
          <Route path="/reportes" element={<NavGate navKey="/reportes"><Reportes orgId={orgId} role={role} /></NavGate>} />
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
