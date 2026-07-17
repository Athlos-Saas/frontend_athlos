import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Panel', icon: '📊' },
  { to: '/cargas', label: 'Cargas GPS', icon: '📈' },
  { to: '/perfiles', label: 'Perfiles ML', icon: '🧠' },
  { to: '/liga', label: 'Liga', icon: '🏆' },
  { to: '/videos', label: 'Video análisis', icon: '🎥' },
  { to: '/wellness', label: 'Wellness', icon: '🩺' },
];

export default function Layout({ profile, onSignOut }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-dot" /> ATLOS
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span>{item.icon}</span> {item.label}
          </NavLink>
        ))}
        <div className="user-box">
          <div style={{ color: 'var(--white)', fontWeight: 600 }}>
            {profile.full_name || 'Usuario'}
          </div>
          <div style={{ marginBottom: 8 }}>rol: {profile.role}</div>
          <button className="btn btn-secondary" onClick={onSignOut}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
