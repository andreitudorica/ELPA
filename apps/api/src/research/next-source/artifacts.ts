import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { z } from 'zod';

import { sha256Hex } from '../acquisition/source-record';
import { sampleOvertureFrame } from './sampling';
import { parseCsv } from '../evaluation/csv';
import { scoreIncrementalReview } from './review';

/** Write only local source artifacts; public exports contain keys and aggregates. */
export async function createOvertureSampleArtifact(
  framePath: string,
  metadataPath: string,
  outDir: string,
) {
  const bytes = await readFile(framePath);
  const frame = z.array(z.record(z.string(), z.json())).parse(JSON.parse(bytes.toString('utf8')));
  const metadata = z
    .object({
      release: z.string(),
      acquiredAt: z.iso.datetime(),
      sha256: z.string(),
      source: z.string(),
    })
    .parse(JSON.parse(await readFile(metadataPath, 'utf8')));
  if (sha256Hex(bytes) !== metadata.sha256)
    throw new Error('Frame checksum differs from acquisition metadata');
  const { records, manifest } = sampleOvertureFrame(frame);
  const snapshot = {
    snapshotVersion: 'elpa-overture-sample@1',
    release: metadata.release,
    retrievedAt: metadata.acquiredAt,
    sampling: manifest,
    records,
  };
  const content = `${JSON.stringify(snapshot, null, 2)}\n`;
  const sha256 = sha256Hex(content);
  await mkdir(outDir, { recursive: true });
  const artifactPath = join(outDir, `${sha256.slice(0, 12)}-overture-sample.json`);
  await writeFile(artifactPath, content);
  await writeFile(
    `${artifactPath}.manifest.json`,
    `${JSON.stringify(
      {
        sourceKey: 'overture_places',
        originalUrl: metadata.source,
        retrievedAt: metadata.acquiredAt,
        fileName: basename(artifactPath),
        sha256,
        byteSize: Buffer.byteLength(content),
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(outDir, 'sample-manifest.json'),
    `${JSON.stringify(
      {
        ...manifest,
        artifactSha256: sha256,
        frameFileSha256: metadata.sha256,
        release: metadata.release,
      },
      null,
      2,
    )}\n`,
  );
  return {
    artifactPath,
    sha256,
    selected: records.length,
    manifestPath: join(outDir, 'sample-manifest.json'),
  };
}

export async function scoreIncrementalReviewFiles(sampleDir: string, labelPaths: string[]) {
  const predictions = z
    .array(
      z.object({ sourceRecordKey: z.string(), partition: z.string(), classification: z.string() }),
    )
    .parse(JSON.parse(await readFile(join(sampleDir, 'prediction-key.private.json'), 'utf8')));
  const labels = (
    await Promise.all(labelPaths.map(async (path) => parseCsv(await readFile(path, 'utf8'))))
  )
    .flat()
    .filter((row) => row.discovery_decision !== '');
  const result = scoreIncrementalReview(predictions, labels);
  await writeFile(
    join(sampleDir, 'independent-review-score.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  return result;
}
