#!/usr/bin/env node
// Generate the typed OpenAPI client from `apps/api/openapi.yaml` (ADR 0012).

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const openapiPath = resolve(webRoot, '..', 'api', 'openapi.yaml');
const outputPath = resolve(webRoot, 'src', 'lib', 'apiClient', 'generated', 'schema.d.ts');

if (!existsSync(openapiPath)) {
  console.log(
    `[codegen] ${openapiPath} not present — run pnpm openapi:generate from the workspace root.`,
  );
  process.exit(0);
}

console.log(`[codegen] Generating types from ${openapiPath}`);
execSync(`pnpm exec openapi-typescript ${openapiPath} -o ${outputPath}`, {
  stdio: 'inherit',
  cwd: webRoot,
});
execSync(`pnpm exec prettier --write ${outputPath}`, {
  stdio: 'inherit',
  cwd: webRoot,
});
console.log('[codegen] Done.');
