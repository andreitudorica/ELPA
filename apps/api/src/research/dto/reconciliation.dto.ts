import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { caseSchema, resultSchema } from '../reconciliation/contracts';

export const ReconciliationListSchema = z
  .array(
    z
      .object({
        id: z.uuid(),
        assessedAt: z.iso.datetime(),
        input: caseSchema,
        result: resultSchema,
      })
      .strict(),
  )
  .meta({ id: 'ReconciliationList' });
export class ReconciliationListDto extends createZodDto(ReconciliationListSchema) {}
