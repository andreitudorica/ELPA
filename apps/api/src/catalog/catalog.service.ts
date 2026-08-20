import { Injectable } from '@nestjs/common';

import { PreconditionError } from '../common';
import { type CategoryRecord, CategoryRepository } from './category.repository';

export const GROUP_RENTAL_PROPERTY_CATEGORY_KEY = 'group_rental_property';

@Injectable()
export class CatalogService {
  constructor(private readonly categories: CategoryRepository) {}

  async requireCategory(key: string): Promise<CategoryRecord> {
    const category = await this.categories.findByKey(key);
    if (category === undefined) {
      throw new PreconditionError(
        `Required category ${key} is missing; apply the database migrations`,
      );
    }

    return category;
  }
}
