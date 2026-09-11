/**
 * LoadingOverlay — ayuda visual para procesos que tardan.
 *
 * Muchos módulos consultan agregados pesados (insights sobre decenas de miles
 * de predicciones, entrenamientos, recomendaciones de scouting sobre 6 000+
 * jugadores). Un spinner pelado no dice nada; este overlay muestra un mensaje
 * de qué está pasando y, opcionalmente, un aviso de "esto puede tardar" cuando
 * el proceso se alarga, para que el usuario sepa que la app no se colgó.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingOverlayProps {
  /** Mensaje principal (qué se está cargando). */
  message?: string;
  /** Segundos tras los cuales se muestra el aviso de "puede tardar". */
  slowAfterSeconds?: number;
  /** Mensaje del aviso de proceso lento. */
  slowMessage?: string;
  /** Si es un overlay a pantalla dentro del contenedor (con fondo) o inline. */
  variant?: 'block' | 'overlay';
}

export function LoadingOverlay({
  message = 'Cargando…',
  slowAfterSeconds = 6,
  slowMessage = 'Esto está tardando un poco más de lo normal. Seguimos procesando…',
  variant = 'block',
}: LoadingOverlayProps) {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setIsSlow(true), slowAfterSeconds * 1000);
    return () => clearTimeout(id);
  }, [slowAfterSeconds]);

  const inner = (
    <div className="flex flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="size-8 animate-spin text-ai" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{message}</p>
      {isSlow && <p className="max-w-sm text-xs text-muted-foreground">{slowMessage}</p>}
    </div>
  );

  if (variant === 'overlay') {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-bg/70 backdrop-blur-sm">
        {inner}
      </div>
    );
  }

  return <div className="flex min-h-[240px] items-center justify-center py-12">{inner}</div>;
}
