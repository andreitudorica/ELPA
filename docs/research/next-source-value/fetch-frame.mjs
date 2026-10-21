import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Offline experiment preparation using the documented DuckDB CLI, not an
// application runtime or a background acquisition service.
const outDir = resolve(process.argv[2] ?? 'apps/api/.data/next-source-fresh');
mkdirSync(outDir, { recursive: true });
const framePath = join(outDir, 'overture-ro-lodging-frame.json');
if (existsSync(framePath))
  throw new Error('Refusing to overwrite a pinned frame; choose a fresh output directory');
const version = spawnSync('duckdb', ['--version'], { encoding: 'utf8' });
if (version.status !== 0 || !/v1\.4\.1\b/.test(version.stdout))
  throw new Error('Install DuckDB CLI v1.4.1 before this fixed-release export');
const sqlPath = join(dirname(fileURLToPath(import.meta.url)), 'export-frame.sql');
const sql = readFileSync(sqlPath, 'utf8').replace('__OUTPUT__', framePath.replaceAll("'", "''"));
const started = performance.now();
const result = spawnSync('duckdb', ['-batch', '-c', sql], {
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});
const wallSeconds = (performance.now() - started) / 1000;
if (result.status !== 0) {
  writeFileSync(
    join(outDir, 'acquisition-failure.json'),
    JSON.stringify(
      {
        exitCode: result.status,
        wallSeconds,
        stderr: result.stderr,
        error: result.error?.message,
      },
      null,
      2,
    ),
  );
  throw new Error('Frame acquisition failed; failure retained, no replacement query was run');
}
const bytes = readFileSync(framePath);
const records = JSON.parse(bytes.toString('utf8'));
const metadata = {
  release: '2026-09-23.1',
  acquiredAt: new Date().toISOString(),
  source: 's3://overturemaps-us-west-2/release/2026-09-23.1/theme=places/type=place/*',
  query: readFileSync(sqlPath, 'utf8'),
  records: records.length,
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  wallSeconds,
  duckdb: '1.4.1',
  contactFieldsOmitted: ['emails', 'phones'],
  failedRequests: null,
  transportMeasurement: 'Not instrumented; one acquisition command succeeded',
};
writeFileSync(join(outDir, 'frame-acquisition.json'), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(
  JSON.stringify(
    { outDir, records: metadata.records, sha256: metadata.sha256, wallSeconds },
    null,
    2,
  ),
);
