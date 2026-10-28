import { apiFetch } from './client';
import type {
  AuthUser,
  LoginInput,
  Profile,
  RegisterInput,
  TermsAcceptanceInput,
} from './types';

export const authApi = {
  /** No inicia sesión: después hay que llamar a login. */
  register: (input: RegisterInput) =>
    apiFetch<AuthUser>('/auth/register', { method: 'POST', body: input }),
  login: (input: LoginInput) => apiFetch<AuthUser>('/auth/login', { method: 'POST', body: input }),
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
};

export const usersApi = {
  me: () => apiFetch<Profile>('/users/me'),
  /** Registra la aceptación de los términos vigentes. Repetirlo no cambia la fecha original. */
  acceptTerms: (input: TermsAcceptanceInput) =>
    apiFetch<Profile>('/users/me/terms', { method: 'POST', body: input }),
};