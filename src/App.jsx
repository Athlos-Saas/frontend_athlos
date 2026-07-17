import { Navigate, Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import Loader from './components/Loader';
import { useAuth } from './hooks/useAuth';
import CargasGps from './pages/CargasGps';
import Dashboard from './pages/Dashboard';
import Liga from './pages/Liga';
import Login from './pages/Login';
import PerfilesMl from './pages/PerfilesMl';
import Videos from './pages/Videos';
import Wellness from './pages/Wellness';

export default function App() {
  const { session, profile, isLoading, signIn, signOut } = useAuth();

  if (isLoading) return <Loader text="Iniciando ATLOS…" />;
  if (!session) return <Login onSignIn={signIn} />;

  if (!profile?.org_id) {
    return (
      <div className="login-wrap">
        <div className="card login-card">
          <h2>Cuenta sin organización</h2>
          <p className="page-subtitle">
            Tu usuario existe pero aún no pertenece a una organización. Pide a un
            administrador que te invite o corre el seed del backend.
          </p>
          <button className="btn" onClick={signOut}>Salir</button>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Layout profile={profile} onSignOut={signOut} />}>
        <Route index element={<Dashboard orgId={profile.org_id} />} />
        <Route path="/cargas" element={<CargasGps orgId={profile.org_id} />} />
        <Route path="/perfiles" element={<PerfilesMl orgId={profile.org_id} />} />
        <Route path="/liga" element={<Liga orgId={profile.org_id} />} />
        <Route path="/videos" element={<Videos orgId={profile.org_id} />} />
        <Route path="/wellness" element={<Wellness orgId={profile.org_id} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
