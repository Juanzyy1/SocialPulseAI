import { SyncRange } from './sync-range';

export interface MetricRow {
  date: string;
  metric: string;
  value: number;
}

export interface SnapshotRow {
  metric: string;
  value: number;
}

export interface SyncData {
  dailyMetrics: MetricRow[];
  snapshots: SnapshotRow[];
}

export interface SyncAdapter {
  readonly platform: string;
  fetch(accountId: string, range: SyncRange): Promise<SyncData>;
}

export const SYNC_ADAPTERS = Symbol('SYNC_ADAPTERS');

/** La respuesta de una plataforma no tiene la forma esperada: se rechaza en lugar de guardar. */
export class SyncDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncDataError';
  }
}
