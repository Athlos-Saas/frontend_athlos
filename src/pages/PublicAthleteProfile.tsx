import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, SearchX, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { VerifiedAthleteCard } from '@/features/athleteProfile/components/VerifiedAthleteCard';
import { ATHLOS_WEBSITE_URL } from '@/features/athleteProfile/constants';
import { usePublicAthleteProfile } from '@/features/athleteProfile/queries';

/**
 * Pide a los buscadores no indexar la ficha (el backend manda además
 * `X-Robots-Tag: noindex`). Muchos perfiles son de menores: compartir el
 * enlace es decisión del club; que aparezca en Google, no.
 */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const referrer = document.createElement('meta');
    referrer.name = 'referrer';
    referrer.content = 'no-referrer';
    document.head.appendChild(referrer);
    return () => {
      meta.remove();
      referrer.remove();
    };
  }, []);
}

/**
 * Ficha pública /p/:slug. Standalone: sin AppShell ni sesión, se monta FUERA
 * del gate de login de App.tsx. Habla con el backend solo vía
 * `backendFetchPublic` (sin token) y muestra lo que devuelve la lista blanca.
 *
 * Cualquier error se muestra como "perfil no disponible": el backend responde
 * el mismo 404 para inexistente/despublicado, y aquí tampoco se distingue.
 */
export default function PublicAthleteProfile() {
  const { t } = useTranslation();
  const { slug = '' } = useParams<{ slug: string }>();
  const query = usePublicAthleteProfile(slug);
  useNoIndex();

  useEffect(() => {
    const previous = document.title;
    document.title = query.data
      ? t('publicAthlete.documentTitle', '{{name}} · Perfil verificado ATHLOS', { name: query.data.athlete.display_name })
      : t('publicAthlete.documentTitleFallback', 'Perfil verificado ATHLOS');
    return () => {
      document.title = previous;
    };
  }, [query.data, t]);

  return (
    <div className="min-h-screen bg-bg text-foreground">
      <header className="border-b border-border bg-panel/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href={ATHLOS_WEBSITE_URL} className="focus-ring flex items-center gap-2 rounded-md" rel="noopener">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-ai to-purple text-sm font-black text-white">A</span>
            <span className="text-lg font-black tracking-widest text-foreground">ATHLOS</span>
          </a>
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <ShieldCheck className="size-4 text-success" aria-hidden="true" />
            {t('publicAthlete.headerTag', 'Talento verificado con video y GPS')}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
        {query.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : query.isError || !query.data ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-panel">
              <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-foreground">{t('publicAthlete.notAvailableTitle', 'Perfil no disponible')}</h1>
              <p className="max-w-md text-sm text-muted-foreground">
                {t(
                  'publicAthlete.notAvailableBody',
                  'El enlace no existe, el club lo despublicó o el servidor está despertando. Si te lo acaban de enviar, reintenta en unos segundos.',
                )}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
              {t('publicAthlete.retry', 'Reintentar')}
            </Button>
          </div>
        ) : (
          <VerifiedAthleteCard profile={query.data} />
        )}

        <section className="flex flex-col items-start gap-4 rounded-2xl border border-ai/30 bg-gradient-to-r from-ai/15 to-purple/15 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">{t('publicAthlete.ctaTitle', '¿Tu club o academia quiere perfiles como este?')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('publicAthlete.ctaBody', 'ATHLOS mide a tus atletas con video normal y GPS, sin depender de proveedores de datos.')}
            </p>
          </div>
          <Button asChild>
            <a href={ATHLOS_WEBSITE_URL} rel="noopener">
              {t('publicAthlete.ctaButton', 'Conoce ATHLOS')} <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </Button>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          {t(
            'publicAthlete.footer',
            'Perfil publicado por el club con consentimiento del atleta (y de su tutor si es menor). ATHLOS no publica datos de salud.',
          )}
        </p>
      </main>
    </div>
  );
}
