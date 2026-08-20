import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AdministratorSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    displayName: z.string().min(1),
  })
  .meta({ id: 'Administrator' });

export class AdministratorDto extends createZodDto(AdministratorSchema) {}
