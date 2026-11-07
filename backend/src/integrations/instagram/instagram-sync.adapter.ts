import { Injectable } from '@nestjs/common';
import { credentialAad, TokenCipherService } from '../../common/crypto/token-cipher.service';
import { addDays } from '../../common/dates/pacific-date';
import { PrismaService } from '../../prisma/prisma.service';
import { MetricRow, SyncAdapter, SyncData, SyncDataError } from '../../sync/sync-adapter';
import { SyncRange } from '../../sync/sync-range';
import { InstagramInsightsClient } from './instagram-insights.client';
import { parseDailyReach } from './instagram-insights.mapper';

const MAX_DAYS_PER_INSIGHTS_REQUEST = 29;

function splitRange(range: SyncRange): SyncRange[] {
  const chunks: SyncRange[] = [];
  for (let start = range.start; start <= range.end; ) {
    const chunkEnd = addDays(start, MAX_DAYS_PER_INSIGHTS_REQUEST - 1);
    const end = chunkEnd < range.end ? chunkEnd : range.end;
    chunks.push({ ...range, start, end });
    start = addDays(end, 1);
  }
  return chunks;
}

@Injectable()
export class InstagramSyncAdapter implements SyncAdapter {
  readonly platform = 'INSTAGRAM';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: TokenCipherService,
    private readonly insights: InstagramInsightsClient,
  ) {}

  async fetch(accountId: string, range: SyncRange): Promise<SyncData> {
    const account = await this.prisma.socialAccount.findFirst({
      where: { id: accountId, platform: 'INSTAGRAM' },
      select: {
        platformAccountId: true,
        credential: { select: { accessTokenEnc: true, expiresAt: true } },
      },
    });
    if (!account?.credential) {
      throw new SyncDataError('No se encontró el acceso de Instagram; vuelve a conectar la cuenta');
    }
    if (account.credential.expiresAt && account.credential.expiresAt <= new Date()) {
      throw new SyncDataError('El acceso de Instagram caducó; vuelve a conectar la cuenta');
    }

    let accessToken: string;
    try {
      accessToken = this.cipher.decrypt(
        account.credential.accessTokenEnc,
        credentialAad(accountId, 'access'),
      );
    } catch {
      throw new SyncDataError('No se pudo leer el acceso de Instagram; vuelve a conectar la cuenta');
    }

    const dailyMetrics: MetricRow[] = [];
    for (const chunk of splitRange(range)) {
      const response = await this.insights.fetchDailyReach(
        accessToken,
        account.platformAccountId,
        chunk,
      );
      dailyMetrics.push(...parseDailyReach(response, chunk));
    }
    return { dailyMetrics, snapshots: [] };
  }
}
