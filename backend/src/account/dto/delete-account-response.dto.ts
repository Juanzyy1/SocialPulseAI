import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountResponseDto {
  @ApiProperty({ description: 'Cuentas sociales que estaban conectadas y se desconectaron' })
  accountsDisconnected: number;

  @ApiProperty({
    description:
      'De ellas, cuántas no se pudo confirmar la revocación del acceso en Google (la cuenta se eliminó igualmente)',
  })
  revocationsNotConfirmed: number;
}