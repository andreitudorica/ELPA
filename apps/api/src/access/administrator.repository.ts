import { Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';

import { DatabaseService } from '../database';
import { administrators } from './access.schema';

export interface AdministratorRecord {
  id: string;
  email: string;
  displayName: string;
}

@Injectable()
export class AdministratorRepository {
  constructor(private readonly database: DatabaseService) {}

  async findByEmail(email: string): Promise<AdministratorRecord | undefined> {
    const [administrator] = await this.database.executor
      .select({
        id: administrators.id,
        email: administrators.email,
        displayName: administrators.displayName,
      })
      .from(administrators)
      .where(eq(administrators.email, email))
      .limit(1);

    return administrator;
  }

  async findByIds(ids: string[]): Promise<AdministratorRecord[]> {
    if (ids.length === 0) return [];

    return this.database.executor
      .select({
        id: administrators.id,
        email: administrators.email,
        displayName: administrators.displayName,
      })
      .from(administrators)
      .where(inArray(administrators.id, ids));
  }
}
