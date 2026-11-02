import { Module } from '@nestjs/common';
import { NetworkDiagnosticsController } from './network.controller';

@Module({ controllers: [NetworkDiagnosticsController] })
export class DiagnosticsModule {}