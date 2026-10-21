import 'reflect-metadata';

import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';
import { parseArgs } from 'node:util';

import { NestFactory } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { Logger } from 'nestjs-pino';

import { AccessService } from './access';
import { AppModule } from './app.module';
import type { AppClsStore } from './common';
import {
  AcquisitionReportService,
  AcquisitionRunService,
  type ArtifactManifest,
  BASELINE_CAMPAIGN,
  DuplicateSuggestionService,
  EvaluationService,
  ExtractionService,
  fileSha256,
  ResearchCampaignService,
  SOURCE_DEFINITIONS,
  SOURCE_KEYS,
  createOvertureSampleArtifact,
  scoreIncrementalReviewFiles,
  type SourceKey,
} from './research';

/**
 * Operator CLI for the acquisition baseline. Acquisition is a long-running
 * batch workload, so it runs here rather than inside HTTP controllers; it uses
 * the same application services, transactions, and audit trail as the API.
 * See docs/research/group-rental-property-baseline/reproduction.md.
 */
const USAGE = `Usage: node dist/research-cli.js <command> [options]

Commands:
  extraction-corpus --campaign <id> --out <dir>   Seal a stratified primary-Evidence sample
  extraction-run --campaign <id> --sample <dir>  Propose grounded attribute Claims from pinned Evidence
  extraction-score --sample <dir> [--labels <json>...] [--artifact <ai-capture.json>]
                                                   Score the same independent holdout annotations for both methods
  extraction-ai-import --sample <dir> --artifact <json> Validate captured model results; no live calls
  extraction-report --sample <dir>                Aggregate observed extraction and prior Claim coverage
  fetch --source <key> --out <dir> [--url <url>]   Download an artifact and write its manifest
  sample-overture --frame <json> --metadata <json> --out <dir>
                                                   Draw the frozen bounded Overture sample
  baseline-campaign                                Create or find the national baseline campaign
  next-source-campaign                             Create or find the isolated source experiment
  import --campaign <id> --artifact <path>         Import an artifact (manifest: <path>.manifest.json)
  match --campaign <id>                            Generate duplicate suggestions
  report --campaign <id> [--out <file>]            Build the data-quality report (JSON)
  incremental-report --campaign <id> --out <dir>  Compare Overture with A+B and export blind review pack
  incremental-score --sample <dir> [--labels <csv>...]  Score independent holdout discovery reviews
  evaluation-sample --campaign <id> --out <dir>    Export the blind review sample
  evaluation-score --campaign <id> --sample <dir> --labels <csv>...
                                                   Score the matcher against reviewer labels

Sources: ${SOURCE_KEYS.join(', ')}`;

async function fetchArtifact(sourceKey: SourceKey, outDir: string, url?: string): Promise<void> {
  const source = SOURCE_DEFINITIONS[sourceKey];
  const requestedUrl = url ?? source.canonicalUrl;
  const retrievedAt = new Date().toISOString();
  const response = await fetch(requestedUrl, { redirect: 'follow' });
  if (!response.ok || response.body === null) {
    throw new Error(`Download failed with HTTP ${String(response.status)} for ${requestedUrl}`);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const encodedName = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const plainName = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  const fileName = basename(
    encodedName !== undefined
      ? decodeURIComponent(encodedName)
      : (plainName ?? new URL(response.url).pathname),
  ).replace(/[^\p{L}\p{N}._-]+/gu, '_');

  await mkdir(outDir, { recursive: true });
  const temporaryPath = join(outDir, `.${fileName}.partial`);
  await pipeline(
    Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
    createWriteStream(temporaryPath),
  );
  const sha256 = await fileSha256(temporaryPath);
  const artifactPath = join(outDir, `${sha256.slice(0, 12)}-${fileName}`);
  await rename(temporaryPath, artifactPath);
  const { size } = await import('node:fs/promises').then((fs) => fs.stat(artifactPath));
  const manifest: ArtifactManifest = {
    sourceKey,
    originalUrl: response.url,
    retrievedAt,
    fileName,
    sha256,
    byteSize: size,
  };
  await writeFile(`${artifactPath}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ artifactPath, ...manifest }, null, 2));
}

function required(values: Record<string, unknown>, name: string): string {
  const value = values[name];
  if (typeof value !== 'string' || value === '')
    throw new Error(`--${name} is required\n\n${USAGE}`);
  return value;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({
    args: rest,
    options: {
      source: { type: 'string' },
      out: { type: 'string' },
      url: { type: 'string' },
      campaign: { type: 'string' },
      artifact: { type: 'string' },
      sample: { type: 'string' },
      labels: { type: 'string', multiple: true },
      frame: { type: 'string' },
      metadata: { type: 'string' },
    },
  });

  if (command === undefined || command === 'help' || command === '--help') {
    console.log(USAGE);
    return;
  }
  if (command === 'fetch') {
    const source = required(values, 'source');
    if (source === 'overture_places')
      throw new Error(
        'Use the documented fixed-release SQL export, then sample-overture; direct web crawling is unsupported.',
      );
    if (!(SOURCE_KEYS as readonly string[]).includes(source))
      throw new Error(`Unknown source ${source}`);
    await fetchArtifact(source as SourceKey, resolve(required(values, 'out')), values.url);
    return;
  }
  if (command === 'sample-overture') {
    console.log(
      JSON.stringify(
        await createOvertureSampleArtifact(
          resolve(required(values, 'frame')),
          resolve(required(values, 'metadata')),
          resolve(required(values, 'out')),
        ),
        null,
        2,
      ),
    );
    return;
  }
  if (command === 'incremental-score') {
    console.log(
      JSON.stringify(
        await scoreIncrementalReviewFiles(resolve(required(values, 'sample')), values.labels ?? []),
        null,
        2,
      ),
    );
    return;
  }

  // Keep stdout for the command's JSON result unless the operator asks for more logging.
  process.env.API_LOG_LEVEL ??= 'warn';
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const cls = app.get<ClsService<AppClsStore>>(ClsService);
  try {
    await cls.run(async () => {
      cls.set('administrator', await app.get(AccessService).resolveCurrentAdministrator());
      const result = await runCommand(command, values, app);
      console.log(JSON.stringify(result, null, 2));
    });
  } finally {
    await app.close();
  }
}

async function runCommand(
  command: string,
  values: Record<string, unknown>,
  app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>,
): Promise<unknown> {
  switch (command) {
    case 'extraction-corpus':
      return app
        .get(ExtractionService)
        .exportCorpus(required(values, 'campaign'), resolve(required(values, 'out')));
    case 'extraction-run':
      return app
        .get(ExtractionService)
        .run(required(values, 'campaign'), resolve(required(values, 'sample')));
    case 'extraction-score':
      return app
        .get(ExtractionService)
        .score(
          resolve(required(values, 'sample')),
          Array.isArray(values.labels) ? values.labels.map(String) : [],
          typeof values.artifact === 'string' ? resolve(values.artifact) : undefined,
        );
    case 'extraction-ai-import':
      return app
        .get(ExtractionService)
        .importAi(resolve(required(values, 'sample')), resolve(required(values, 'artifact')));
    case 'extraction-report':
      return app.get(ExtractionService).report(resolve(required(values, 'sample')));
    case 'baseline-campaign':
    case 'next-source-campaign': {
      const campaigns = app.get(ResearchCampaignService);
      const definition =
        command === 'baseline-campaign'
          ? BASELINE_CAMPAIGN
          : {
              name: 'Experiment incremental Overture — eșantion controlat v1',
              eventNeed: BASELINE_CAMPAIGN.eventNeed,
              county: undefined,
              locality: undefined,
              minimumCriteria: BASELINE_CAMPAIGN.minimumCriteria,
              investigatedSources: [
                ...BASELINE_CAMPAIGN.investigatedSources,
                'https://docs.overturemaps.org/guides/places/',
              ],
            };
      const existing = (await campaigns.list()).find(
        (campaign) => campaign.name === definition.name,
      );
      return existing ?? campaigns.create(definition);
    }
    case 'import': {
      const artifactPath = resolve(required(values, 'artifact'));
      const manifest = JSON.parse(
        await readFile(`${artifactPath}.manifest.json`, 'utf8'),
      ) as ArtifactManifest;
      const outcome = await app.get(AcquisitionRunService).importArtifact({
        researchCampaignId: required(values, 'campaign'),
        artifactPath,
        manifest,
      });
      if (outcome.status === 'failed') process.exitCode = 1;
      return outcome;
    }
    case 'match':
      return app.get(DuplicateSuggestionService).generate(required(values, 'campaign'));
    case 'report': {
      const report = await app.get(AcquisitionReportService).build(required(values, 'campaign'));
      if (typeof values.out === 'string') {
        await writeFile(resolve(values.out), `${JSON.stringify(report, null, 2)}\n`);
        return { written: resolve(values.out) };
      }
      return report;
    }
    case 'incremental-report':
      return app
        .get(EvaluationService)
        .exportIncrementalComparison(
          required(values, 'campaign'),
          resolve(required(values, 'out')),
        );
    case 'evaluation-sample':
      return app
        .get(EvaluationService)
        .exportSample(required(values, 'campaign'), resolve(required(values, 'out')));
    case 'evaluation-score': {
      const labels = values.labels;
      if (!Array.isArray(labels) || labels.length === 0) {
        throw new Error(`--labels is required\n\n${USAGE}`);
      }
      return app.get(EvaluationService).score(
        required(values, 'campaign'),
        resolve(required(values, 'sample')),
        labels.map((path) => resolve(String(path))),
      );
    }
    default:
      throw new Error(`Unknown command ${command}\n\n${USAGE}`);
  }
}

main().catch((error: unknown) => {
  console.error('[apps/api] research CLI failed:', error);
  process.exit(1);
});
