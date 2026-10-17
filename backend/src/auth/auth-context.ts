import type { Request } from 'express';

/** Lo que el guard deja disponible tras validar la sesión. */
export interface AuthContext {
  userId: string;
  sessionId: string;
  token: string;
}

export type AuthenticatedRequest = Request & { auth?: AuthContext };