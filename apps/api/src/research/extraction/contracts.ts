import { z } from 'zod';

import { canonicalJson, sha256Hex } from '../acquisition/source-record';
import { documentSchema, verifyDocument } from './documents';
import type { PrimaryDocument } from './documents';
import { ATTRIBUTE_SCHEMAS, ONTOLOGY_VERSION, attributeIdSchema } from './ontology';

export const factSchema = z
  .object({
    attribute: attributeIdSchema,
    value: z.union([z.string(), z.number(), z.boolean()]),
    documentId: z.string(),
    evidenceId: z.uuid(),
    sourceVersion: z.string(),
    textSha256: z.string(),
    fieldPath: z.array(z.string()).min(1),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    quote: z.string().min(1),
    explicitness: z.enum(['explicit_positive', 'explicit_negative']),
    entityLevel: z.literal('offer'),
    scope: z.literal('advertised_accommodation'),
    temporal: z
      .object({
        kind: z.enum(['unspecified', 'seasonal', 'year_round', 'restricted']),
        text: z.string().nullable(),
      })
      .strict(),
    ambiguity: z.enum(['none', 'approximate', 'conflict', 'uncertain_scope']),
  })
  .strict();
export type ExtractedFact = z.infer<typeof factSchema>;

export const outputSchema = z
  .object({
    ontologyVersion: z.literal(ONTOLOGY_VERSION),
    method: z.string().min(1),
    documentId: z.string(),
    facts: z.array(factSchema).max(200),
    abstentions: z.array(
      z.object({ attribute: attributeIdSchema, reason: z.string().min(1) }).strict(),
    ),
  })
  .strict();
export type ExtractionOutput = z.infer<typeof outputSchema>;

/** Technical grounding only. A matching quote does not prove semantic support. */
export function validateFact(input: unknown, document: PrimaryDocument): string[] {
  const parsed = factSchema.safeParse(input);
  if (!parsed.success) return ['claim_schema'];
  const fact = parsed.data;
  const errors: string[] = [];
  if (!documentSchema.safeParse(document).success || !verifyDocument(document))
    errors.push('document_fingerprint');
  if (fact.documentId !== document.id || fact.evidenceId !== document.evidenceId)
    errors.push('document_identity');
  if (fact.sourceVersion !== document.sourceVersion) errors.push('source_version');
  if (fact.textSha256 !== document.textSha256) errors.push('text_version');
  const field = document.fields.find(
    (entry) => canonicalJson(entry.path) === canonicalJson(fact.fieldPath),
  );
  if (field === undefined) errors.push('field_reference');
  else if (
    fact.start >= fact.end ||
    fact.end > field.text.length ||
    field.text.slice(fact.start, fact.end) !== fact.quote
  )
    errors.push('evidence_span');
  if (!ATTRIBUTE_SCHEMAS[fact.attribute].safeParse(fact.value).success)
    errors.push('value_normalization');
  if (
    fact.temporal.kind === 'unspecified'
      ? fact.temporal.text !== null
      : fact.temporal.text === null || !fact.quote.includes(fact.temporal.text)
  )
    errors.push('temporal_span');
  if (
    fact.explicitness === 'explicit_negative' &&
    fact.value !== false &&
    !(fact.attribute === 'parties_allowed' && fact.value === 'no') &&
    fact.attribute !== 'music_policy'
  )
    errors.push('negative_value');
  if (fact.value === false && fact.explicitness !== 'explicit_negative')
    errors.push('negative_value');
  return errors;
}

export function factIdentity(fact: ExtractedFact): string {
  return canonicalJson([
    fact.documentId,
    fact.attribute,
    fact.value,
    fact.explicitness,
    fact.temporal,
    fact.scope,
    fact.ambiguity,
  ]);
}

export function distinctFacts(facts: ExtractedFact[]): ExtractedFact[] {
  return [...new Map(facts.map((fact) => [factIdentity(fact), fact])).values()];
}

export function outputDigest(outputs: ExtractionOutput[]): string {
  return sha256Hex(canonicalJson(outputs));
}

/** Provider-neutral captured-output boundary; never executes an external model. */
export function validateCapturedOutput(input: unknown, document: PrimaryDocument) {
  const parsed = outputSchema.safeParse(input);
  if (!parsed.success) return { accepted: null, errors: ['output_schema'] };
  const errors = parsed.data.documentId === document.id ? [] : ['document_identity'];
  for (const fact of parsed.data.facts) errors.push(...validateFact(fact, document));
  return { accepted: errors.length === 0 ? parsed.data : null, errors };
}
