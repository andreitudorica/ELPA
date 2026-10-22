import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';

import { DatabaseService } from '../database';
import {
  acquisitionRuns,
  candidates,
  claims,
  duplicateSuggestions,
  evidence,
  sourceArtifacts,
} from './acquisition.schema';
import type { EvidenceLocator, JsonObject, JsonValue } from './acquisition/source-record';
import { CURRENT_EXTRACTION_METHODS } from './acquisition/sources';
import { validateFact } from './extraction/contracts';
import { CONTACT_PATTERN, documentFromEvidence } from './extraction/documents';
import { MATCHER_VERSION } from './matching/duplicate-matcher';

/**
 * Source fields another module may read for verification. Everything else in
 * retained Evidence stays inside Research; contact-like text is withheld.
 */
const READABLE_FIELDS: Record<string, readonly string[]> = {
  situr_accommodation_register: [
    'Localitate',
    'Județ',
    'Tip localitate',
    'Localitate componentă',
    'Număr locuri',
    'Număr spații',
    'Tip unitate',
  ],
  osm_geofabrik_romania: [
    'lat',
    'lon',
    'tags.tourism',
    'tags.description',
    'tags.description:ro',
    'tags.description:en',
    'tags.description:hu',
    'tags.beds',
    'tags.capacity:beds',
    'tags.bedrooms',
    'tags.bathrooms',
    'tags.rooms',
    'tags.capacity',
    'tags.swimming_pool',
    'tags.sauna',
    'tags.hot_tub',
    'tags.sport',
    'tags.barbecue',
    'tags.garden',
    'tags.addr:county',
    'tags.addr:city',
    'tags.addr:village',
    'tags.addr:place',
    'tags.is_in',
    'tags.is_in:county',
  ],
  overture_places: [],
};

export interface ReadableField {
  path: string[];
  text: string | null;
  withheld: 'none' | 'redacted' | 'possible_contact' | 'missing' | 'not_readable';
}

export interface ClaimEvidenceRow {
  claimId: string;
  candidateId: string;
  evidenceId: string;
  target: string;
  value: JsonValue;
  locator: EvidenceLocator;
  method: string;
  methodCurrent: boolean;
  evidenceLatest: boolean;
  /** Text-span Claims are re-validated against their retained passage. */
  grounding: 'valid' | 'invalid' | 'not_applicable';
  observedAt: string;
  extractedAt: string;
}

export interface EvidenceSnapshot {
  id: string;
  sourceKey: string;
  sourceRecordKey: string;
  contentSha256: string;
  fields: ReadableField[];
  artifact: {
    id: string;
    sha256: string;
    datasetVersion: string | null;
    latestDatasetVersion: string | null;
    retrievedAt: string;
    reuseTerms: string;
    retentionPolicy: string;
  };
}

/** Dotted locator names address OSM tags; register column names contain no dots. */
export function fieldPath(name: string): string[] {
  return name.startsWith('tags.') ? ['tags', name.slice('tags.'.length)] : [name];
}

function readField(sourceKey: string, payload: JsonObject, redacted: string[], path: string[]) {
  const name = path.join('.');
  if (!(READABLE_FIELDS[sourceKey] ?? []).includes(name))
    return { path, text: null, withheld: 'not_readable' } satisfies ReadableField;
  if (redacted.includes(path[0] ?? ''))
    return { path, text: null, withheld: 'redacted' } satisfies ReadableField;
  let value: JsonValue | undefined = payload;
  for (const key of path)
    value =
      value !== null && typeof value === 'object' && !Array.isArray(value) ? value[key] : undefined;
  if (typeof value !== 'string' && typeof value !== 'number')
    return { path, text: null, withheld: 'missing' } satisfies ReadableField;
  const text = String(value);
  if (text.trim() === '') return { path, text: null, withheld: 'missing' } satisfies ReadableField;
  if (CONTACT_PATTERN.test(text))
    return { path, text: null, withheld: 'possible_contact' } satisfies ReadableField;
  return { path, text, withheld: 'none' } satisfies ReadableField;
}

/**
 * Read-only batch access to Claims and their Evidence for the Curation
 * module. It never writes and never resolves identity across Candidates.
 */
@Injectable()
export class ClaimEvidenceReader {
  constructor(private readonly database: DatabaseService) {}

  /** Lightweight sampling frame; primary records are read only after the draw. */
  async frame(campaignId: string, targets: readonly string[]) {
    const rows = await this.database.executor
      .select({
        claimId: claims.id,
        candidateId: claims.candidateId,
        evidenceId: claims.evidenceId,
        target: claims.target,
        method: claims.extractionMethod,
        locatorType: sql<string>`${claims.evidenceLocator}->>'type'`,
        locatorFields: sql<string[] | null>`${claims.evidenceLocator}->'fields'`,
        locatorFieldPath: sql<string[] | null>`${claims.evidenceLocator}->'fieldPath'`,
        settlementSource: sql<string | null>`${claims.value}->>'settlementSource'`,
        sourceKey: candidates.sourceKey,
        sourceRecordKey: candidates.sourceRecordKey,
        countyCode: candidates.countyCode,
        evidenceLatest: sql<boolean>`${claims.evidenceId} = ${candidates.latestEvidenceId}`,
        evidenceSha256: evidence.contentSha256,
      })
      .from(claims)
      .innerJoin(candidates, eq(candidates.id, claims.candidateId))
      .innerJoin(evidence, eq(evidence.id, claims.evidenceId))
      .where(and(eq(candidates.researchCampaignId, campaignId), inArray(claims.target, targets)))
      .orderBy(asc(claims.id));
    return rows.map((row) => ({
      ...row,
      methodCurrent: (CURRENT_EXTRACTION_METHODS as readonly string[]).includes(row.method),
    }));
  }

  async sameProperty(campaignId: string) {
    return this.database.executor
      .select({
        id: duplicateSuggestions.id,
        left: duplicateSuggestions.leftCandidateId,
        right: duplicateSuggestions.rightCandidateId,
        strength: duplicateSuggestions.strength,
      })
      .from(duplicateSuggestions)
      .where(
        and(
          eq(duplicateSuggestions.researchCampaignId, campaignId),
          eq(duplicateSuggestions.matcherVersion, MATCHER_VERSION),
          eq(duplicateSuggestions.relation, 'same_property'),
        ),
      );
  }

  async candidates(campaignId: string, candidateIds: string[]) {
    if (candidateIds.length === 0) return [];
    return this.database.executor
      .select({
        id: candidates.id,
        sourceKey: candidates.sourceKey,
        sourceRecordKey: candidates.sourceRecordKey,
        displayName: candidates.displayName,
        latestEvidenceId: candidates.latestEvidenceId,
      })
      .from(candidates)
      .where(
        and(eq(candidates.researchCampaignId, campaignId), inArray(candidates.id, candidateIds)),
      );
  }

  /** Suggestions touching the given Candidates; never identity decisions. */
  async counterparts(campaignId: string, candidateIds: string[]) {
    if (candidateIds.length === 0) return [];
    return this.database.executor
      .select({
        id: duplicateSuggestions.id,
        left: duplicateSuggestions.leftCandidateId,
        right: duplicateSuggestions.rightCandidateId,
        strength: duplicateSuggestions.strength,
      })
      .from(duplicateSuggestions)
      .where(
        and(
          eq(duplicateSuggestions.researchCampaignId, campaignId),
          eq(duplicateSuggestions.matcherVersion, MATCHER_VERSION),
          eq(duplicateSuggestions.relation, 'same_property'),
          or(
            inArray(duplicateSuggestions.leftCandidateId, candidateIds),
            inArray(duplicateSuggestions.rightCandidateId, candidateIds),
          ),
        ),
      );
  }

  async claims(
    campaignId: string,
    candidateIds: string[],
    targets: readonly string[],
  ): Promise<ClaimEvidenceRow[]> {
    if (candidateIds.length === 0) return [];
    const rows = await this.database.executor
      .select({
        id: claims.id,
        candidateId: claims.candidateId,
        evidenceId: claims.evidenceId,
        target: claims.target,
        value: claims.value,
        locator: claims.evidenceLocator,
        method: claims.extractionMethod,
        observedAt: claims.observedAt,
        createdAt: claims.createdAt,
        latestEvidenceId: candidates.latestEvidenceId,
        sourceKey: evidence.sourceKey,
        sourceRecordKey: evidence.sourceRecordKey,
        contentSha256: evidence.contentSha256,
        payload: evidence.payload,
        evidenceObservedAt: evidence.observedAt,
        artifactId: sourceArtifacts.id,
        artifactSha256: sourceArtifacts.sha256,
        datasetVersion: sourceArtifacts.datasetVersion,
      })
      .from(claims)
      .innerJoin(candidates, eq(candidates.id, claims.candidateId))
      .innerJoin(evidence, eq(evidence.id, claims.evidenceId))
      .innerJoin(sourceArtifacts, eq(sourceArtifacts.id, evidence.firstSourceArtifactId))
      .where(
        and(
          eq(candidates.researchCampaignId, campaignId),
          inArray(claims.candidateId, candidateIds),
          inArray(claims.target, targets),
        ),
      )
      .orderBy(asc(claims.id));
    return rows.map((row) => {
      let grounding: ClaimEvidenceRow['grounding'] = 'not_applicable';
      if (row.locator.type === 'text_span') {
        const locator = row.locator;
        const document = documentFromEvidence({
          candidateId: row.candidateId,
          evidenceId: row.evidenceId,
          sourceKey: row.sourceKey,
          sourceRecordKey: row.sourceRecordKey,
          contentSha256: row.contentSha256,
          sourceVersion: row.datasetVersion,
          artifactId: row.artifactId,
          artifactSha256: row.artifactSha256,
          observedAt: row.evidenceObservedAt,
          payload: row.payload,
        });
        grounding =
          validateFact(
            {
              attribute: row.target.replace(/^offer\./, ''),
              value: row.value,
              documentId: locator.documentId,
              evidenceId: row.evidenceId,
              sourceVersion: locator.sourceVersion,
              textSha256: locator.textSha256,
              fieldPath: locator.fieldPath,
              start: locator.start,
              end: locator.end,
              quote: locator.quote,
              explicitness: locator.explicitness,
              entityLevel: locator.entityLevel,
              scope: locator.scope,
              temporal: locator.temporal,
              ambiguity: locator.ambiguity,
            },
            document,
          ).length === 0
            ? 'valid'
            : 'invalid';
      }
      return {
        claimId: row.id,
        candidateId: row.candidateId,
        evidenceId: row.evidenceId,
        target: row.target,
        value: row.value,
        locator: row.locator,
        method: row.method,
        methodCurrent: (CURRENT_EXTRACTION_METHODS as readonly string[]).includes(row.method),
        evidenceLatest: row.evidenceId === row.latestEvidenceId,
        grounding,
        observedAt: row.observedAt.toISOString(),
        extractedAt: row.createdAt.toISOString(),
      };
    });
  }

  /** Allowlisted, contact-filtered fields of retained Evidence. */
  async evidence(
    campaignId: string,
    requests: { evidenceId: string; paths: string[][] }[],
  ): Promise<EvidenceSnapshot[]> {
    const ids = [...new Set(requests.map((r) => r.evidenceId))];
    if (ids.length === 0) return [];
    const [rows, latest] = await Promise.all([
      this.database.executor
        .select({
          id: evidence.id,
          sourceKey: evidence.sourceKey,
          sourceRecordKey: evidence.sourceRecordKey,
          contentSha256: evidence.contentSha256,
          payload: evidence.payload,
          redactedFields: evidence.redactedFields,
          artifactId: sourceArtifacts.id,
          artifactSha256: sourceArtifacts.sha256,
          datasetVersion: sourceArtifacts.datasetVersion,
          retrievedAt: sourceArtifacts.retrievedAt,
          reuseTerms: sourceArtifacts.reuseTerms,
          retentionPolicy: sourceArtifacts.retentionPolicy,
        })
        .from(evidence)
        .innerJoin(sourceArtifacts, eq(sourceArtifacts.id, evidence.firstSourceArtifactId))
        .where(inArray(evidence.id, ids)),
      this.latestDatasetVersions(campaignId),
    ]);
    return rows.map((row) => {
      const paths = new Map<string, string[]>();
      for (const request of requests.filter((r) => r.evidenceId === row.id))
        for (const path of request.paths) paths.set(path.join('.'), path);
      return {
        id: row.id,
        sourceKey: row.sourceKey,
        sourceRecordKey: row.sourceRecordKey,
        contentSha256: row.contentSha256,
        fields: [...paths.values()]
          .sort((a, b) => a.join('.').localeCompare(b.join('.')))
          .map((path) => readField(row.sourceKey, row.payload, row.redactedFields, path)),
        artifact: {
          id: row.artifactId,
          sha256: row.artifactSha256,
          datasetVersion: row.datasetVersion,
          latestDatasetVersion: latest.get(row.sourceKey) ?? null,
          retrievedAt: row.retrievedAt.toISOString(),
          reuseTerms: row.reuseTerms,
          retentionPolicy: row.retentionPolicy,
        },
      };
    });
  }

  /** Dataset version of each source's most recent completed import into the campaign. */
  private async latestDatasetVersions(campaignId: string) {
    const rows = await this.database.executor
      .select({
        sourceKey: acquisitionRuns.sourceKey,
        datasetVersion: sourceArtifacts.datasetVersion,
      })
      .from(acquisitionRuns)
      .innerJoin(sourceArtifacts, eq(sourceArtifacts.id, acquisitionRuns.sourceArtifactId))
      .where(
        and(
          eq(acquisitionRuns.researchCampaignId, campaignId),
          eq(acquisitionRuns.stage, 'import'),
          inArray(acquisitionRuns.status, ['succeeded', 'completed_with_rejections']),
        ),
      )
      .orderBy(desc(acquisitionRuns.startedAt));
    const latest = new Map<string, string | null>();
    for (const row of rows)
      if (!latest.has(row.sourceKey)) latest.set(row.sourceKey, row.datasetVersion);
    return latest;
  }
}
