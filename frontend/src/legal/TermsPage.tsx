import { LegalDocumentView } from './LegalDocumentView';
import { TERMS_DOCUMENT } from './documents';

export function TermsPage() {
  return <LegalDocumentView doc={TERMS_DOCUMENT} />;
}