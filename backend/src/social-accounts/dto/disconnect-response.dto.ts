import { ApiProperty } from '@nestjs/swagger';

export class DisconnectResponseDto {
  @ApiProperty({
    description:
      'false si Google no confirmó la revocación. La cuenta se desconecta igualmente y el usuario puede quitar el acceso desde su cuenta de Google',
  })
  revokedAtGoogle: boolean;
}