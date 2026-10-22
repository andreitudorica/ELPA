import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { canonicalJson, sha256Hex } from '../research';
import {
  capturedAssessmentSchema,
  corpusSchema,
  type CapturedAssessment,
  type Corpus,
} from './verification/contracts';

export const CORPUS_FILE = 'corpus.private.json';
const CAPTURES_FILE = 'assessments.private.jsonl';

/** Files go under the ignored private data directory; a sealed file is never overwritten. */
export async function writePrivate(directory: string, name: string, data: unknown, sealed = false) {
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, name), `${JSON.stringify(data, null, 2)}\n`, {
    flag: sealed ? 'wx' : 'w',
  });
}

export async function readCorpus(directory: string): Promise<{ corpus: Corpus; digest: string }> {
  const corpus = corpusSchema.parse(
    JSON.parse(await readFile(join(directory, CORPUS_FILE), 'utf8')),
  );
  return { corpus, digest: sha256Hex(canonicalJson(corpus)) };
}

export async function readCaptures(directory: string): Promise<CapturedAssessment[]> {
  let text: string;
  try {
    text = await readFile(join(directory, CAPTURES_FILE), 'utf8');
  } catch {
    return [];
  }
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => capturedAssessmentSchema.parse(JSON.parse(line)));
}

export async function appendCapture(directory: string, capture: CapturedAssessment) {
  await appendFile(join(directory, CAPTURES_FILE), `${JSON.stringify(capture)}\n`);
}
