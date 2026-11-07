import { ApiProperty } from '@nestjs/swagger';

export class DisconnectResponseDto {
  @ApiProperty({
    description:
      'Indica si el proveedor confirmó la revocación. La cuenta se desconecta y sus credenciales se borran incluso si la revocación remota falla.',
  })
  revokedAtProvider: boolean;
}