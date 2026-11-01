import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { SESSION_COOKIE, sessionCookieOptions } from '../auth/session-cookie';
import { AccountService } from './account.service';
import { DeleteAccountResponseDto } from './dto/delete-account-response.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';

@ApiTags('users')
@ApiCookieAuth(SESSION_COOKIE)
@ApiUnauthorizedResponse({ description: 'Sin sesión válida' })
@Controller('users/me')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly config: ConfigService,
  ) {}

  @Post('delete')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Elimina la cuenta y todos sus datos (no se puede deshacer)',
    description:
      'Exige el correo de la cuenta y, si tiene contraseña, también la contraseña. Desconecta los canales conectados y revoca su acceso en Google (si Google no lo confirma, se elimina igualmente y se informa). Se usa POST en lugar de DELETE para llevar el cuerpo de confirmación sin problemas con proxies. Tras 5 confirmaciones fallidas en 15 minutos responde 429.',
  })
  @ApiOkResponse({ type: DeleteAccountResponseDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  @ApiForbiddenResponse({ description: 'El correo o la contraseña de confirmación no son correctos' })
  @ApiTooManyRequestsResponse({ description: 'Demasiadas confirmaciones fallidas' })
  async deleteAccount(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DeleteAccountResponseDto> {
    const result = await this.account.deleteAccount(auth.userId, dto);
    // Las sesiones ya no existen; se borra también la cookie del navegador.
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.config.get('NODE_ENV') === 'production'));
    return result;
  }
}