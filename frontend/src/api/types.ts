/**
 * Tipos escritos a mano a partir de los DTO del backend (no se generan desde Swagger: el
 * generador no soporta TypeScript 6 todavía). Las fechas llegan como texto ISO en el JSON.
 * Revisar contra el backend en la tarea F.7.
 */

/** Respuesta de register y login. */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

/** Respuesta de GET /users/me. */
export interface Profile extends AuthUser {
  avatarUrl: string | null;
  emailVerifiedAt: string | null;
}

export interface RegisterInput {
  email: string;
  /** De 12 a 128 caracteres. */
  password: string;
  /** Hasta 80 caracteres. */
  displayName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}