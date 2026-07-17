import { useState, type FormEvent } from 'react';
import { Activity, BrainCircuit, ShieldCheck, Sparkles, Video } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';

export interface LoginProps {
  onSignIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FEATURES = [
  { icon: BrainCircuit, label: 'Modelos de ML en producción', description: 'Fatiga, clustering y clasificación en tiempo real' },
  { icon: Activity, label: 'Monitoreo GPS y wellness', description: 'Carga física y prevención de lesiones' },
  { icon: Video, label: 'Video análisis', description: 'Tracking de jugadores con computer vision' },
  { icon: Sparkles, label: 'AI Intelligence Center', description: 'Insights y predicciones consolidadas' },
];

export default function Login({ onSignIn }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');

    const errors: typeof fieldErrors = {};
    if (!EMAIL_PATTERN.test(email)) errors.email = 'Ingresa un correo válido.';
    if (password.length < 6) errors.password = 'Mínimo 6 caracteres.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    const { error } = await onSignIn(email, password);
    if (error) setFormError('Credenciales inválidas.');
    setIsSubmitting(false);
  };

  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de marca — solo en desktop */}
      <div className="relative hidden overflow-hidden border-r border-border bg-panel lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse at 30% 20%, black 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />
        <div
          className="motion-safe:animate-pulse pointer-events-none absolute -left-24 -top-24 size-[420px] rounded-full bg-ai/20 blur-3xl [animation-duration:6s]"
          aria-hidden="true"
        />
        <div
          className="motion-safe:animate-pulse pointer-events-none absolute -bottom-32 -right-16 size-[420px] rounded-full bg-purple/20 blur-3xl [animation-duration:8s]"
          aria-hidden="true"
        />

        <div className="relative flex items-center gap-3">
          <img src="/images/Logo.png" alt="ATHLOS" className="h-20 w-auto mix-blend-screen" />
          <span className="rounded-full border border-purple/30 bg-purple/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-purple">
            AI Platform
          </span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground">
            Inteligencia artificial para el rendimiento deportivo de élite.
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Datos, modelos y predicciones en una sola plataforma — construida para equipos que
            compiten con precisión.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div
                key={feature.label}
                className="glass rounded-lg border border-border p-4 transition-colors hover:border-ai/30"
              >
                <feature.icon className="size-5 text-ai" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-foreground">{feature.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-success" aria-hidden="true" />
          Row Level Security por organización — tus datos, aislados y protegidos.
        </div>
      </div>

      {/* Formulario */}
      <div className="relative flex items-center justify-center overflow-hidden p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-60 lg:hidden"
          style={{
            background:
              'radial-gradient(600px circle at 20% 20%, rgba(59,130,246,0.12), transparent 60%), radial-gradient(500px circle at 80% 80%, rgba(124,58,237,0.12), transparent 60%)',
          }}
          aria-hidden="true"
        />

        <div className="relative w-full max-w-sm">
          <div className="mb-7 flex items-center gap-2 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-md bg-ai/15">
              <img src="/images/Favicon.png" alt="" className="size-7 mix-blend-screen" />
            </span>
            <span className="text-2xl font-bold tracking-wide text-foreground">ATHLOS</span>
          </div>

          <h2 className="text-xl font-semibold text-foreground">Bienvenido de nuevo</h2>
          <p className="mb-7 mt-1 text-sm text-muted-foreground">
            Ingresa a tu cuenta para continuar con el análisis de tu organización.
          </p>

          {formError && (
            <div role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <Field label="Correo" htmlFor="email" required error={fieldErrors.email}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field
              label="Contraseña"
              htmlFor="password"
              required
              error={fieldErrors.password}
              hint={!fieldErrors.password ? 'Mínimo 6 caracteres.' : undefined}
            >
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Button type="submit" isLoading={isSubmitting} className="w-full">
              Ingresar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
