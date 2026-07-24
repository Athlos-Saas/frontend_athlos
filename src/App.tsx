import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { ModulePlaceholder } from '@/components/dashboard/ModulePlaceholder';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { MODULE_PREVIEWS } from '@/constants/modulePreviews';
import { NAV_ITEMS_FLAT } from '@/constants/navigation';

import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';

const AiIntelligenceCenter = lazy(() => import('./pages/AiIntelligenceCenter'));
const Alertas = lazy(() => import('./pages/Alertas'));
const Analisis = lazy(() => import('./pages/Analisis'));
const Atletas = lazy(() => import('./pages/Atletas'));
const Competiciones = lazy(() => import('./pages/Competiciones'));
const Configuracion = lazy(() => import('./pages/Configuracion'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Equipos = lazy(() => import('./pages/Equipos'));
const ModelosIa = lazy(() => import('./pages/ModelosIa'));
const PlayerProfile = lazy(() => import('./pages/PlayerProfile'));
const Scouting = lazy(() => import('./pages/Scouting'));
const Temporadas = lazy(() => import('./pages/Temporadas'));
const Usuarios = lazy(() => import('./pages/Usuarios'));

const PLACEHOLDER_ROUTES = new Set(['/pronosticos']);

export default function App() {
  const { session, profile, isLoading, signIn, signOut } = useAuth();

  if (isLoading) return <Spinner label="Iniciando ATHLOS…" className="min-h-screen" />;
  if (!session) return <Login onSignIn={signIn} />;

  if (!profile?.org_id) {
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

  const orgId = profile.org_id;
  const role = profile.role;

  return (
    <Suspense fallback={<Spinner label="Cargando módulo…" className="min-h-[60vh]" />}>
      <Routes>
        <Route element={<AppShell profile={profile} onSignOut={signOut} />}>
          <Route index element={<Dashboard orgId={orgId} />} />
          <Route path="/analisis" element={<Analisis orgId={orgId} role={role} />} />
          <Route path="/atletas" element={<Atletas orgId={orgId} role={role} />} />
          <Route path="/atletas/:playerId" element={<PlayerProfile orgId={orgId} role={role} />} />
          <Route path="/competiciones" element={<Competiciones orgId={orgId} role={role} />} />
          <Route path="/modelos" element={<ModelosIa orgId={orgId} role={role} />} />
          <Route path="/ai" element={<AiIntelligenceCenter orgId={orgId} />} />
          <Route path="/equipos" element={<Equipos orgId={orgId} />} />
          <Route path="/temporadas" element={<Temporadas orgId={orgId} />} />
          <Route path="/scouting" element={<Scouting orgId={orgId} />} />
          <Route path="/alertas" element={<Alertas orgId={orgId} />} />
          <Route path="/configuracion" element={<Configuracion orgId={orgId} role={role} />} />
          <Route path="/usuarios" element={<Usuarios orgId={orgId} role={role} currentUserId={profile.user_id} />} />

          {NAV_ITEMS_FLAT.filter((item) => item.comingSoon || PLACEHOLDER_ROUTES.has(item.to)).map((item) => {
            const preview = MODULE_PREVIEWS[item.to];
            return (
              <Route
                key={item.to}
                path={item.to}
                element={
                  <ModulePlaceholder
                    title={item.label}
                    icon={item.icon}
                    description={preview?.description ?? `Vista de ${item.label.toLowerCase()} para tu organización.`}
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
