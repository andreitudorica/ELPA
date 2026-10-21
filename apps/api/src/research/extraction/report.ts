import { canonicalJson } from '../acquisition/source-record';
import type { JsonValue } from '../acquisition/source-record';
import { proportion } from '../evaluation/metrics';
import { outputSchema, validateFact } from './contracts';
import type { ExtractionOutput } from './contracts';
import type { Corpus } from './corpus';
import { ATTRIBUTE_IDS } from './ontology';

/** Aggregates only: no source text, property names, model output or annotations. */
export function observedReport(
  corpus: Corpus,
  outputs: ExtractionOutput[],
  prior: { candidateId: string; evidenceId: string; target: string; value: JsonValue }[],
) {
  const docs = new Map(corpus.entries.map((entry) => [entry.document.id, entry.document]));
  const facts = outputs.flatMap((output) => output.facts);
  const known = new Set(
    prior.map((claim) =>
      canonicalJson([claim.candidateId, claim.evidenceId, claim.target, claim.value]),
    ),
  );
  const knownCells = new Set(
    prior.map((claim) => canonicalJson([claim.candidateId, claim.target.replace(/^offer\./, '')])),
  );
  const previous = (fact: (typeof facts)[number]) => {
    const doc = docs.get(fact.documentId);
    return known.has(
      canonicalJson([doc?.candidateId, doc?.evidenceId, `offer.${fact.attribute}`, fact.value]),
    );
  };
  const newCells = new Set(
    facts.flatMap((fact) => {
      const key = canonicalJson([docs.get(fact.documentId)?.candidateId, fact.attribute]);
      return knownCells.has(key) ? [] : [key];
    }),
  );
  const baselineCells = new Set(
    prior
      .filter((claim) => ATTRIBUTE_IDS.some((id) => claim.target === `offer.${id}`))
      .map((claim) => canonicalJson([claim.candidateId, claim.target])),
  );
  const afterCells = new Set([
    ...baselineCells,
    ...facts.map((fact) =>
      canonicalJson([docs.get(fact.documentId)?.candidateId, `offer.${fact.attribute}`]),
    ),
  ]);
  const count = (values: string[]) =>
    Object.fromEntries(
      [...new Set(values)]
        .sort()
        .map((value) => [value, values.filter((item) => item === value).length]),
    );
  return {
    version: 'grp-extraction-observed@1',
    corpusManifestSha256: corpus.manifestSha256,
    labeling:
      'Observed proposed Claims and technical checks; no independent semantic accuracy or verified property counts.',
    documents: corpus.entries.length,
    partitions: count(corpus.entries.map((entry) => entry.partition)),
    sources: count(corpus.entries.map((entry) => entry.document.sourceKey)),
    counties: count(corpus.entries.map((entry) => entry.countyCode ?? 'unknown')),
    fieldsExcluded: corpus.entries.reduce(
      (sum, entry) => sum + entry.document.excludedFields.length,
      0,
    ),
    descriptions: corpus.entries.filter((entry) =>
      entry.document.fields.some((field) => field.section === 'description'),
    ).length,
    documentsWithDiacritics: corpus.entries.filter((entry) =>
      entry.document.fields.some((field) => /[ăâîșşțţ]/i.test(field.text)),
    ).length,
    documentsWithoutDiacritics: corpus.entries.filter(
      (entry) =>
        entry.document.fields.length > 0 &&
        !entry.document.fields.some((field) => /[ăâîșşțţ]/i.test(field.text)),
    ).length,
    documentsWithMixedTerminology: corpus.entries.filter(
      (entry) =>
        entry.document.fields.some((field) =>
          /\b(?:the|private|grass|pool|household|hotel|resort)\b/i.test(field.text),
        ) &&
        entry.document.fields.some((field) =>
          /\b(?:curte|cazare|camere|pensiune|pentru|este)\b/i.test(field.text),
        ),
    ).length,
    proposedFacts: facts.length,
    structuredOutputValidity: proportion(
      outputs.filter((output) => outputSchema.safeParse(output).success).length,
      outputs.length,
    ),
    alreadyProposedSameEvidenceValue: facts.filter(previous).length,
    newlyProposedObservations: facts.filter((fact) => !previous(fact)).length,
    newlyPopulatedCandidateAttributes: newCells.size,
    proposedAttributeCompleteness: {
      denominator: corpus.entries.length * ATTRIBUTE_IDS.length,
      baselinePopulated: baselineCells.size,
      afterPopulated: afterCells.size,
      baselineShare: baselineCells.size / (corpus.entries.length * ATTRIBUTE_IDS.length),
      afterShare: afterCells.size / (corpus.entries.length * ATTRIBUTE_IDS.length),
      independentlySupportedCompleteness: null,
    },
    technicalGroundingFailureRate: proportion(
      facts.filter((fact) => {
        const document = docs.get(fact.documentId);
        return document === undefined || validateFact(fact, document).length > 0;
      }).length,
      facts.length,
    ),
    documentsWithNoClaims: outputs.filter((output) => output.facts.length === 0).length,
    perAttribute: ATTRIBUTE_IDS.map((attribute) => ({
      attribute,
      proposedFacts: facts.filter((fact) => fact.attribute === attribute).length,
      holdoutProposedFacts: facts.filter(
        (fact) =>
          fact.attribute === attribute &&
          corpus.entries.some(
            (entry) => entry.partition === 'holdout' && entry.document.id === fact.documentId,
          ),
      ).length,
      previouslyKnown: facts.filter((fact) => fact.attribute === attribute && previous(fact))
        .length,
      explicitNegative: facts.filter(
        (fact) => fact.attribute === attribute && fact.explicitness === 'explicit_negative',
      ).length,
      qualified: facts.filter(
        (fact) => fact.attribute === attribute && fact.temporal.kind !== 'unspecified',
      ).length,
      ambiguous: facts.filter((fact) => fact.attribute === attribute && fact.ambiguity !== 'none')
        .length,
    })),
  };
}
