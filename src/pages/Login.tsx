import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';

export interface LoginProps {
  onSignIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg p-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(600px circle at 20% 20%, rgba(59,130,246,0.12), transparent 60%), radial-gradient(500px circle at 80% 80%, rgba(124,58,237,0.12), transparent 60%)',
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-elevated">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-ai/15">
            <span className="size-2.5 rounded-full bg-ai shadow-[0_0_12px_2px_rgba(59,130,246,0.6)]" />
          </span>
          <span className="text-2xl font-bold tracking-wide text-foreground">ATLOS</span>
        </div>
        <p className="mb-7 text-sm text-muted-foreground">Inteligencia artificial para el rendimiento deportivo</p>

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
          <Field label="Contraseña" htmlFor="password" required error={fieldErrors.password} hint={!fieldErrors.password ? 'Mínimo 6 caracteres.' : undefined}>
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
  );
}
