import { LegalDocumentView } from './LegalDocumentView';
import { PRIVACY_DOCUMENT } from './documents';

export function PrivacyPage() {
  return <LegalDocumentView doc={PRIVACY_DOCUMENT} />;
}