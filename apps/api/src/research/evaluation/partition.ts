import { sha256Hex, type SourceKey } from '../acquisition/source-record';

/**
 * Deterministic split of source records into a tuning partition (examples
 * that may be inspected while developing matching and screening rules) and
 * an evaluation partition (reserved for independent review). The split
 * depends only on the record identity, so it is stable across runs and
 * matcher versions.
 */
export const PARTITION_VERSION = 'grp-eval-partition@1';
/** Share of records in the tuning partition, out of 256 hash buckets (~30 %). */
const TUNING_BUCKETS = 77;

export type Partition = 'tuning' | 'evaluation';

export function partitionOf(sourceKey: SourceKey, sourceRecordKey: string): Partition {
  const bucket = Number.parseInt(
    sha256Hex(`${PARTITION_VERSION}:${sourceKey}:${sourceRecordKey}`).slice(0, 2),
    16,
  );
  return bucket < TUNING_BUCKETS ? 'tuning' : 'evaluation';
}

/**
 * A pair belongs to the partition of its anchor record: the register record
 * when the pair crosses sources (record-centric evaluation starts from the
 * official register), otherwise the record that sorts first.
 */
export function pairPartition(
  left: { sourceKey: SourceKey; sourceRecordKey: string },
  right: { sourceKey: SourceKey; sourceRecordKey: string },
): Partition {
  const anchor =
    right.sourceKey === 'situr_accommodation_register' && left.sourceKey !== right.sourceKey
      ? right
      : left;
  return partitionOf(anchor.sourceKey, anchor.sourceRecordKey);
}
