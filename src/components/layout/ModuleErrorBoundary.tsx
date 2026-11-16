import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from 'i18next';

import { ErrorState } from '@/components/ui/ErrorState';
import { isChunkLoadError } from '@/lib/lazyWithRetry';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Aísla el fallo de UN módulo. Sin esto, cualquier excepción al renderizar una
 * página (o un chunk que no carga tras un redeploy) desmontaba toda la app y
 * dejaba la pantalla en blanco, sin sidebar para ir a otro módulo. AppShell lo
 * monta con `key={pathname}`, así que navegar a otra ruta lo resetea solo.
 */
export class ModuleErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Solo mensaje y stack de componentes: nunca props ni datos del módulo
    // (pueden incluir datos de salud de atletas).
    console.error('[ModuleErrorBoundary]', error.message, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isStaleChunk = isChunkLoadError(error);
    return (
      <ErrorState
        className="min-h-[50vh]"
        title={
          isStaleChunk
            ? i18n.t('common.moduleError.staleTitle', 'Hay una versión nueva de ATHLOS')
            : i18n.t('common.moduleError.title', 'Este módulo no pudo cargarse')
        }
        description={
          isStaleChunk
            ? i18n.t('common.moduleError.staleDescription', 'Recarga la página para usar la versión más reciente.')
            : i18n.t('common.moduleError.description', 'Ocurrió un error inesperado en este módulo. El resto de la plataforma sigue funcionando.')
        }
        onRetry={() => (isStaleChunk ? window.location.reload() : this.setState({ error: null }))}
      />
    );
  }
}
