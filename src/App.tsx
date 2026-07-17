import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { ModulePlaceholder } from '@/components/dashboard/ModulePlaceholder';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { NAV_ITEMS_FLAT } from '@/constants/navigation';

import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';

const AiIntelligenceCenter = lazy(() => import('./pages/AiIntelligenceCenter'));
const Analisis = lazy(() => import('./pages/Analisis'));
const Atletas = lazy(() => import('./pages/Atletas'));
const Competiciones = lazy(() => import('./pages/Competiciones'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ModelosIa = lazy(() => import('./pages/ModelosIa'));

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

  return (
    <Suspense fallback={<Spinner label="Cargando módulo…" className="min-h-[60vh]" />}>
      <Routes>
        <Route element={<AppShell profile={profile} onSignOut={signOut} />}>
          <Route index element={<Dashboard orgId={orgId} />} />
          <Route path="/analisis" element={<Analisis orgId={orgId} />} />
          <Route path="/atletas" element={<Atletas orgId={orgId} />} />
          <Route path="/competiciones" element={<Competiciones orgId={orgId} />} />
          <Route path="/modelos" element={<ModelosIa orgId={orgId} />} />
          <Route path="/ai" element={<AiIntelligenceCenter orgId={orgId} />} />

          {NAV_ITEMS_FLAT.filter((item) => item.comingSoon || PLACEHOLDER_ROUTES.has(item.to)).map((item) => (
            <Route
              key={item.to}
              path={item.to}
              element={
                <ModulePlaceholder
                  title={item.label}
                  icon={item.icon}
                  description={`Vista de ${item.label.toLowerCase()} para tu organización.`}
                />
              }
            />
          ))}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
