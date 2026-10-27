import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { authApi } from '../api/endpoints';
import { describeAuthError, describeOAuthLoginError } from '../auth/auth-errors';
import { safeRedirectPath } from '../auth/redirect';
import { loginErrors } from '../auth/validation';
import type { LoginErrors, LoginForm } from '../auth/validation';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { Divider } from '../components/Divider';
import { FormAlert } from '../components/FormAlert';
import { GoogleLink } from '../components/GoogleLink';
import { PasswordField } from '../components/PasswordField';
import { TextField } from '../components/TextField';
import { refreshSession } from '../session/session-core';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState<LoginForm>({ email: '', password: '' });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const alert = failure ?? describeOAuthLoginError(searchParams.get('error'));
  const from: unknown = (location.state as { from?: unknown } | null)?.from;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = loginErrors(form);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await authApi.login({ email: form.email.trim(), password: form.password });
    } catch (error) {
      setFailure(describeAuthError(error, 'login'));
      setSubmitting(false);
      return;
    }
    // Se espera a conocer la sesión antes de navegar: si no, la guarda te devolvería al login.
    await refreshSession(queryClient).catch(() => null);
    void navigate(safeRedirectPath(from), { replace: true });
  }

  return (
    <AuthLayout title="Inicia sesión">
      {alert && <FormAlert>{alert}</FormAlert>}
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <TextField
          label="Correo electrónico"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Escribe tu correo"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          error={errors.email}
        />
        <PasswordField
          label="Contraseña"
          name="password"
          autoComplete="current-password"
          placeholder="Escribe tu contraseña"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          error={errors.password}
        />
        <Button type="submit" loading={submitting} className="w-full">
          Entrar
        </Button>
      </form>
      <Divider />
      <GoogleLink />
      <p className="mt-8 text-center text-sm text-muted">
        ¿No tienes cuenta?{' '}
        <Link to="/registro" className="font-medium text-brand-600 hover:text-brand-700">
          Crear cuenta
        </Link>
      </p>
    </AuthLayout>
  );
}