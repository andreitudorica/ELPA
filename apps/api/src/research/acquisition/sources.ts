import { readFile } from 'node:fs/promises';

import { DETERMINISTIC_VERSION } from '../extraction/deterministic';

import {
  OSM_LOCALITY_POLICY_ID,
  OSM_NORMALIZER_VERSION,
  OSM_PARSER_VERSION,
  readOsmAccommodationArtifact,
} from './osm-accommodation-source';
import { SCREENING_POLICY_ID } from './population-screening';
import {
  readOverturePlacesArtifact,
  OVERTURE_PARSER_VERSION,
  OVERTURE_NORMALIZER_VERSION,
  OVERTURE_SCREENING_VERSION,
  OVERTURE_GEOMETRY_VERSION,
} from './overture-places-source';
import {
  readSiturAccommodationArtifact,
  SITUR_NORMALIZER_VERSION,
  SITUR_PARSER_VERSION,
} from './situr-accommodation-source';
import type { SourceArtifactReading, SourceKey } from './source-record';

/**
 * Operational boundary of each supported source: how an artifact is read,
 * under which reuse terms it is held, what may be retained, and how many
 * invalid records are tolerated before a run is treated as format drift.
 * See docs/research/group-rental-property-baseline/source-analysis.md.
 */
export interface SourceDefinition {
  key: SourceKey;
  label: string;
  canonicalUrl: string;
  mediaType: string;
  parserVersion: string;
  normalizerVersion: string;
  reuseTerms: 'odbl_1_0' | 'ro_public_register_no_explicit_licence' | 'cdla_permissive_2_0';
  retentionPolicy: 'full_record' | 'personal_data_redacted';
  attribution: string;
  /** A larger share of rejected records fails the run instead of importing it. */
  maxRejectedRatio: number;
  read(path: string): Promise<SourceArtifactReading>;
}

export const SOURCE_DEFINITIONS: Record<SourceKey, SourceDefinition> = {
  overture_places: {
    key: 'overture_places',
    label: 'Overture Places — bounded experiment (Meta / Microsoft)',
    canonicalUrl: 'https://docs.overturemaps.org/getting-data/duckdb/',
    mediaType: 'application/json',
    parserVersion: OVERTURE_PARSER_VERSION,
    normalizerVersion: OVERTURE_NORMALIZER_VERSION,
    reuseTerms: 'cdla_permissive_2_0',
    retentionPolicy: 'personal_data_redacted',
    attribution: 'Overture Maps Foundation; Meta / Microsoft; CDLA-Permissive-2.0',
    maxRejectedRatio: 0.02,
    read: async (path) => readOverturePlacesArtifact(JSON.parse(await readFile(path, 'utf8'))),
  },
  situr_accommodation_register: {
    key: 'situr_accommodation_register',
    label: 'Registrul structurilor de primire turistice cu funcțiuni de cazare (DGT / SITUR)',
    canonicalUrl: 'https://se.situr.gov.ro/OpenData/ExportToExcel?type=listaCazari',
    mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    parserVersion: SITUR_PARSER_VERSION,
    normalizerVersion: SITUR_NORMALIZER_VERSION,
    reuseTerms: 'ro_public_register_no_explicit_licence',
    retentionPolicy: 'personal_data_redacted',
    attribution:
      'Sursa: Ministerul Economiei, Antreprenoriatului și Turismului — Direcția Generală de Turism',
    maxRejectedRatio: 0.02,
    read: async (path) => readSiturAccommodationArtifact(await readFile(path)),
  },
  osm_geofabrik_romania: {
    key: 'osm_geofabrik_romania',
    label: 'OpenStreetMap — Geofabrik Romania extract',
    canonicalUrl: 'https://download.geofabrik.de/europe/romania-latest.osm.pbf',
    mediaType: 'application/vnd.openstreetmap.data+pbf',
    parserVersion: OSM_PARSER_VERSION,
    normalizerVersion: OSM_NORMALIZER_VERSION,
    reuseTerms: 'odbl_1_0',
    retentionPolicy: 'full_record',
    attribution: '© OpenStreetMap contributors, ODbL 1.0',
    maxRejectedRatio: 0.02,
    read: (path) => readOsmAccommodationArtifact(path),
  },
};

/**
 * Extraction methods whose Claims form a Candidate's current interpretation.
 * Claims from superseded versions stay stored as history but are not read.
 */
export const CURRENT_EXTRACTION_METHODS = [
  DETERMINISTIC_VERSION,
  SITUR_NORMALIZER_VERSION,
  OSM_NORMALIZER_VERSION,
  OSM_LOCALITY_POLICY_ID,
  SCREENING_POLICY_ID,
  OVERTURE_NORMALIZER_VERSION,
  OVERTURE_SCREENING_VERSION,
  OVERTURE_GEOMETRY_VERSION,
] as const;
