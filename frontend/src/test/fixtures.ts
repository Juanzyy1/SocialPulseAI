import type { Profile, SocialAccount } from '../api/types';
import { TERMS_VERSION } from '../legal/terms';

export const profile = (overrides: Partial<Profile> = {}): Profile => ({
  id: '77c69fe0-cfa1-44f6-a43d-cf33ae48cc89',
  email: 'ana@example.com',
  displayName: 'Ana',
  createdAt: '2026-10-24T00:00:00.000Z',
  avatarUrl: null,
  emailVerifiedAt: null,
  termsAcceptedAt: '2026-10-24T00:00:00.000Z',
  termsVersion: TERMS_VERSION,
  termsUpToDate: true,
  currentTermsVersion: TERMS_VERSION,
  ...overrides,
});

export const socialAccount = (overrides: Partial<SocialAccount> = {}): SocialAccount => ({
  id: 'cuenta-1',
  platform: 'YOUTUBE',
  platformAccountId: 'canal-1',
  displayName: 'Canal de prueba',
  handle: '@canal',
  avatarUrl: null,
  status: 'ACTIVE',
  connectedAt: '2026-10-18T14:26:36.473Z',
  lastSyncedAt: '2026-10-22T14:24:44.456Z',
  ...overrides,
});