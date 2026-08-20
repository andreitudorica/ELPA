import 'reflect-metadata';

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { stringify } from 'yaml';

import { createApplication } from './application';
import { createOpenApiDocument } from './openapi';

async function generateOpenApi(): Promise<void> {
  const app = await createApplication();

  try {
    const document = createOpenApiDocument(app);
    await writeFile(resolve(process.cwd(), 'openapi.yaml'), stringify(document));
  } finally {
    await app.close();
  }
}

generateOpenApi().catch((error: unknown) => {
  console.error('[apps/api] failed to generate OpenAPI:', error);
  process.exit(1);
});
