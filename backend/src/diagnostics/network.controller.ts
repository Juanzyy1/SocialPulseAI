import { Controller, Get, NotFoundException, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/public.decorator';

@ApiTags('diagnostics')
@Controller('diagnostics')
export class NetworkDiagnosticsController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get('network')
  @ApiOperation({
    summary: 'Qué ve el servidor de la conexión (solo con EXPOSE_NETWORK_DIAGNOSTICS=true)',
    description:
      'Sirve para medir cuántos proxies hay delante y fijar TRUST_PROXY_HOPS. Responde 404 si está apagado. Solo refleja lo que envía quien consulta; apágalo al terminar.',
  })
  network(@Req() req: Request) {
    if (this.config.get<boolean>('EXPOSE_NETWORK_DIAGNOSTICS') !== true) throw new NotFoundException();

    return {
      ip: req.ip ?? null,
      protocol: req.protocol,
      forwardedFor: req.get('x-forwarded-for') ?? null,
      forwardedProto: req.get('x-forwarded-proto') ?? null,
      trustProxyHops: this.config.get<number | undefined>('TRUST_PROXY_HOPS') ?? 0,
    };
  }
}