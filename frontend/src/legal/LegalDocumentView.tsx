import { Link } from 'react-router';
import { LEGAL_REVIEWED, splitPlaceholders } from './documents';
import type { LegalBlock, LegalDocument } from './documents';

/** Texto con los marcadores [COMPLETAR] resaltados para que no pasen desapercibidos. */
function Text({ text }: { text: string }) {
  return (
    <>
      {splitPlaceholders(text).map((part, index) =>
        part.placeholder ? (
          <mark key={index} className="rounded bg-amber-100 px-1 text-amber-900">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === 'p') {
    return (
      <p className="mb-3 leading-relaxed">
        <Text text={block.text} />
      </p>
    );
  }
  return (
    <ul className="mb-3 list-disc space-y-1.5 pl-6 leading-relaxed">
      {block.items.map((item, index) => (
        <li key={index}>
          <Text text={item} />
        </li>
      ))}
    </ul>
  );
}

export function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Volver
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">{doc.title}</h1>
        <p className="mb-6 mt-1 text-sm text-muted">Versión {doc.version}</p>
        {!LEGAL_REVIEWED && (
          <p
            role="note"
            className="mb-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <strong>Borrador.</strong> Este texto no ha sido revisado legalmente y contiene marcadores{' '}
            <code>[COMPLETAR]</code> pendientes. No constituye asesoría legal.
          </p>
        )}
        {doc.sections.map((section) => (
          <section key={section.id} aria-labelledby={`${section.id}-title`} className="mb-8">
            <h2 id={`${section.id}-title`} className="mb-3 text-xl font-semibold">
              {section.heading}
            </h2>
            {section.blocks.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}