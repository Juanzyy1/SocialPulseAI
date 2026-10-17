import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca un endpoint como público: el guard global no exige sesión. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);