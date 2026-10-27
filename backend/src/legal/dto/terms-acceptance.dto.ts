import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsString, MaxLength } from 'class-validator';

/** Aceptación de los términos y la política de privacidad. La usan el registro y la puerta de aceptación. */
export class TermsAcceptanceDto {
  @ApiProperty({
    type: Boolean,
    example: true,
    description: 'Debe ser true: la persona acepta los términos y la política de privacidad',
  })
  @Equals(true, { message: 'Debes aceptar los términos y la política de privacidad' })
  acceptTerms: boolean;

  @ApiProperty({
    example: '2026-10-24',
    description: 'Versión del texto que la persona vio y aceptó; debe ser la vigente',
  })
  @IsString()
  @MaxLength(32)
  termsVersion: string;
}