import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';

function boundaryLinter(app) {
  const cwd = resolve('apps', app);
  const require = createRequire(resolve(cwd, 'package.json'));
  const { ESLint } = require('eslint');
  const tseslint = require('typescript-eslint');
  return new ESLint({ cwd, overrideConfig: tseslint.configs.disableTypeChecked });
}

async function checkImport(linter, filePath, code, forbidden) {
  const [result] = await linter.lintText(code, { filePath });
  assert.ok(result, `No lint result for ${filePath}`);
  assert.equal(
    result.messages.some((message) => message.fatal),
    false,
    'Probe must parse',
  );
  const restrictions = result.messages.filter(
    (message) => message.ruleId === 'no-restricted-imports',
  );
  assert.equal(restrictions.length > 0, forbidden, `${filePath}: ${code}`);
}

test('public and Studio route boundaries compose with MSW restrictions', async () => {
  const linter = boundaryLinter('web');
  const publicRoute = 'src/app/router/routes/_public/probe.tsx';
  const studioRoute = 'src/app/router/routes/studio/_authenticated/probe.tsx';
  for (const path of [publicRoute, 'src/app/router/routes/_public.tsx']) {
    await checkImport(linter, path, "import { studio } from '@/lib/apiClient';", true);
    await checkImport(linter, path, "import { studio as admin } from '@/lib/apiClient';", true);
    await checkImport(linter, path, "import { requireAdministrator } from '@/lib/identity';", true);
    await checkImport(
      linter,
      path,
      "import page from '@/app/router/routes/studio/unauthorized';",
      true,
    );
    await checkImport(linter, path, "import { http } from 'msw';", true);
    await checkImport(linter, path, "import { Route } from '@/app/router/routes/studio';", true);
    await checkImport(linter, path, "import { api } from '@/lib/api/client';", false);
  }
  await checkImport(
    linter,
    studioRoute,
    "import page from '@/app/router/routes/_public/index';",
    true,
  );
  await checkImport(
    linter,
    'src/app/router/routes/studio/_authenticated.tsx',
    "import { Route } from '@/app/router/routes/_public';",
    true,
  );
  await checkImport(linter, studioRoute, "import { http } from 'msw';", true);
  await checkImport(linter, studioRoute, "import { studio } from '@/lib/apiClient';", false);
  await checkImport(linter, 'src/mocks/handlers/probe.ts', "import { http } from 'msw';", false);
  await checkImport(
    linter,
    'src/components/common/probe.stories.tsx',
    "import page from '@/features/research/ResearchCampaignsPage';",
    true,
  );
});

test('API domain imports use public barrels at every nesting depth', async () => {
  const linter = boundaryLinter('api');
  await checkImport(
    linter,
    'src/research/probe.ts',
    "import { CatalogService } from '../catalog/catalog.service';",
    true,
  );
  await checkImport(
    linter,
    'src/research/extraction/probe.ts',
    "import { CatalogService } from '../../catalog/catalog.service';",
    true,
  );
  await checkImport(
    linter,
    'src/research/extraction/probe.ts',
    "import { CatalogService } from '../../catalog';",
    false,
  );
  await checkImport(
    linter,
    'src/research/extraction/probe.ts',
    "import { CatalogService } from '../../catalog/index';",
    false,
  );
  await checkImport(
    linter,
    'src/research/extraction/probe.ts',
    "import { CandidateClaimsRepository } from '../candidate-claims.repository';",
    false,
  );
  await checkImport(
    linter,
    'src/research/research.schema.ts',
    "import { administrators } from '../access/access.schema';",
    false,
  );
  await checkImport(
    linter,
    'src/database/database.service.ts',
    "import * as schema from '../drizzle/schema';",
    true,
  );
});
