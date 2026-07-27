import { forwardRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Lock, Mail, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input, type InputProps } from '@/components/ui/Input';
import { cn } from '@/utils/cn';

export interface LoginConsoleProps {
  onSignIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
  /** Se llama al entrar/salir de `isSubmitting`, para que el resto de la experiencia (partículas, holograma, ticker) pueda "reaccionar" mientras la autenticación real está en vuelo. */
  onSubmittingChange?: (value: boolean) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface IconInputProps extends InputProps {
  icon: LucideIcon;
}

/**
 * `Field` clona su hijo directo para inyectarle `invalid`/`aria-describedby`
 * (ver `Field.tsx`) — si el hijo fuera un `<div>` envolviendo el ícono +
 * `Input`, esas props caerían sobre el div (warning de React, atributo
 * `invalid` no-booleano en el DOM). Este wrapper reenvía todo a `Input` de
 * verdad, así `Field` puede seguir clonando su hijo como siempre.
 */
const IconInput = forwardRef<HTMLInputElement, IconInputProps>(({ icon: Icon, className, ...props }, ref) => (
  <div className="relative">
    <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    <Input
      ref={ref}
      className={cn('h-12 pl-10 text-base caret-ai focus-visible:shadow-[0_0_0_4px_rgba(59,130,246,0.15)]', className)}
      {...props}
    />
  </div>
));
IconInput.displayName = 'IconInput';

/**
 * Misma lógica de autenticación que el Login anterior (validación,
 * estados, `onSignIn`) — NO se toca nada de eso, solo cambia el vestido
 * visual (glass, borde en gradiente, inputs grandes, botón premium).
 */
export function LoginConsole({ onSignIn, onSubmittingChange }: LoginConsoleProps) {
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
    onSubmittingChange?.(true);
    const { error } = await onSignIn(email, password);
    if (error) setFormError('Credenciales inválidas.');
    setIsSubmitting(false);
    onSubmittingChange?.(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="border-gradient border-gradient-live glass group relative w-full max-w-sm overflow-hidden rounded-2xl p-8 shadow-elevated sm:p-10"
    >
      {/* Sheen — solo visible en hover, recorre el panel en diagonal */}
      <div
        className="motion-safe:animate-sheen-sweep pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          backgroundImage: 'linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.12) 50%, transparent 58%)',
          backgroundSize: '250% 100%',
        }}
      />

      <h2 className="text-2xl font-bold text-foreground">Bienvenido de nuevo</h2>
      <p className="mb-8 mt-2 text-sm text-muted-foreground">
        Ingresa a tu cuenta para continuar con el análisis de tu organización.
      </p>

      {formError && (
        <div role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Field label="Correo" htmlFor="email" required error={fieldErrors.email}>
          <IconInput
            icon={Mail}
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
          <IconInput
            icon={Lock}
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}>
          <Button
            type="submit"
            isLoading={isSubmitting}
            className="relative h-12 w-full overflow-hidden bg-[length:200%_100%] bg-gradient-to-r from-ai via-purple to-ai bg-[position:0%_0%] text-base shadow-[0_8px_30px_-8px_rgba(59,130,246,0.6)] transition-[background-position] duration-500 hover:bg-[position:100%_0%]"
          >
            {/* Brillo continuo, independiente del hover — "el botón nunca está del todo quieto" */}
            <span
              aria-hidden="true"
              className="motion-safe:animate-sheen-sweep pointer-events-none absolute inset-0"
              style={{
                backgroundImage: 'linear-gradient(115deg, transparent 44%, rgba(255,255,255,0.35) 50%, transparent 56%)',
                backgroundSize: '250% 100%',
              }}
            />
            Ingresar
            {!isSubmitting && <ArrowRight className="size-4" aria-hidden="true" />}
          </Button>
        </motion.div>
      </form>
    </motion.div>
  );
}
