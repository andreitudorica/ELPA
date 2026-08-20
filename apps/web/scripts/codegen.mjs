#!/usr/bin/env node
// Generate the typed OpenAPI client from `apps/api/openapi.json` (ADR 0012).
// No-op until apps/api publishes a schema; the CI drift check treats this
// as passing until the file exists.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const openapiPath = resolve(webRoot, '..', 'api', 'openapi.json');
const outputPath = resolve(webRoot, 'src', 'lib', 'apiClient', 'generated', 'schema.d.ts');

if (!existsSync(openapiPath)) {
  console.log(
    `[codegen] ${openapiPath} not present — skipping (apps/api not scaffolded yet). See ADR 0012/0016.`,
  );
  process.exit(0);
}

console.log(`[codegen] Generating types from ${openapiPath}`);
execSync(`pnpm exec openapi-typescript ${openapiPath} -o ${outputPath}`, {
  stdio: 'inherit',
  cwd: webRoot,
});
console.log('[codegen] Done.');
