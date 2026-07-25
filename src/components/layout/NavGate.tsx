import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';

import { useNavAccessStore } from '@/store/navAccessStore';

/** Bloquea el acceso directo por URL a un módulo que el rol actual tiene denegado en Administración > Matriz de permisos > Navegación. */
export function NavGate({ navKey, children }: { navKey: string; children: ReactElement }) {
  const deniedKeys = useNavAccessStore((state) => state.deniedKeys);
  if (deniedKeys.has(navKey)) return <Navigate to="/" replace />;
  return children;
}
