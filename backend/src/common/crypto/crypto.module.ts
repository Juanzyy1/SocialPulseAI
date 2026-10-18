import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenCipherService } from './token-cipher.service';

// Global: cualquier módulo puede inyectar TokenCipherService sin importar este módulo.
@Global()
@Module({
  providers: [
    {
      provide: TokenCipherService,
      useFactory: (config: ConfigService) =>
        new TokenCipherService(
          Buffer.from(config.getOrThrow<string>('TOKEN_ENCRYPTION_KEY'), 'base64'),
        ),
      inject: [ConfigService],
    },
  ],
  exports: [TokenCipherService],
})
export class CryptoModule {}