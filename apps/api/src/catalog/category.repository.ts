import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DatabaseService } from '../database';
import { categories } from './catalog.schema';

export interface CategoryRecord {
  id: string;
  key: string;
  name: string;
}

@Injectable()
export class CategoryRepository {
  constructor(private readonly database: DatabaseService) {}

  async findByKey(key: string): Promise<CategoryRecord | undefined> {
    const [category] = await this.database.executor
      .select({ id: categories.id, key: categories.key, name: categories.name })
      .from(categories)
      .where(eq(categories.key, key))
      .limit(1);

    return category;
  }
}
