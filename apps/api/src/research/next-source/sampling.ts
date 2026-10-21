import {
  hasPermittedOvertureSources,
  overtureCounty,
  OvertureRecordSchema,
} from '../acquisition/overture-places-source';
import { canonicalJson, type JsonObject, sha256Hex } from '../acquisition/source-record';
import { foldText } from '../acquisition/text-normalization';
import { partitionOf } from '../evaluation/partition';

export const NEXT_SOURCE_SEED = 'elpa-next-source-2026-10';
export const NEXT_SOURCE_VERSION = 'grp-next-source@1';
const SEATS: Readonly<Record<string, string>> = {
  'RO-BH': 'Oradea',
  'RO-MM': 'Baia Mare',
  'RO-CT': 'Constanța',
  'RO-BV': 'Brașov',
  'RO-CJ': 'Cluj-Napoca',
  'RO-HR': 'Miercurea Ciuc',
};

/** Sampling is independent of names, matcher predictions, and review labels. */
export function sampleOvertureFrame(frame: JsonObject[]) {
  const excluded: Record<string, number> = {};
  const groups = new Map<string, { id: string; raw: JsonObject; rank: string }[]>();
  const ids = new Set<string>();
  const exclude = (reason: string) => {
    excluded[reason] = (excluded[reason] ?? 0) + 1;
  };
  for (const raw of frame) {
    const parsed = OvertureRecordSchema.safeParse(raw);
    if (!parsed.success) {
      exclude('invalid_record');
      continue;
    }
    const row = parsed.data;
    if (ids.has(row.id)) throw new Error(`Duplicate frame id ${row.id}`);
    ids.add(row.id);
    if (!hasPermittedOvertureSources(row)) {
      exclude('unapproved_licence');
      continue;
    }
    const address = row.addresses?.find((entry) => entry.country === 'RO');
    const county = overtureCounty(address?.region);
    if (county === null) {
      exclude('unresolved_county');
      continue;
    }
    const seat = SEATS[county];
    if (seat === undefined) {
      exclude('outside_selected_counties');
      continue;
    }
    const urbanity =
      foldText(address?.locality ?? '') === foldText(seat) ? 'county_seat' : 'other_or_unknown';
    const category = row.taxonomy.primary;
    const type = /cabin|chalet|cottage|country_house|holiday_rental_home|lodge/.test(category)
      ? 'dwelling_hint'
      : /hotel|motel|hostel|resort/.test(category)
        ? 'hotel_like'
        : 'other';
    const richness =
      (row.websites?.length ?? 0) + (row.socials?.length ?? 0) > 0 ? 'web_present' : 'web_absent';
    const stratum = `${county}|${urbanity}|${type}|${richness}`;
    const group = groups.get(stratum) ?? [];
    group.push({ id: row.id, raw, rank: sha256Hex(`${NEXT_SOURCE_SEED}|${row.id}`) });
    groups.set(stratum, group);
  }
  const selected = [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([stratum, rows]) =>
      rows
        .sort((a, b) => a.rank.localeCompare(b.rank) || a.id.localeCompare(b.id))
        .slice(0, 2)
        .map((row) => ({ ...row, stratum, population: rows.length })),
    );
  return {
    records: selected.map((row) => row.raw),
    manifest: {
      experimentVersion: NEXT_SOURCE_VERSION,
      seed: NEXT_SOURCE_SEED,
      frameRecords: frame.length,
      frameContentSha256: sha256Hex(canonicalJson(frame)),
      selectedRecords: selected.length,
      excluded,
      strata: Object.fromEntries(
        [...groups]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([stratum, rows]) => [
            stratum,
            {
              population: rows.length,
              sampled: Math.min(2, rows.length),
              inclusionProbability: Math.min(2, rows.length) / rows.length,
            },
          ]),
      ),
      items: selected.map((row) => ({
        sourceRecordKey: row.id,
        stratum: row.stratum,
        partition: partitionOf('overture_places', row.id),
      })),
    },
  };
}
