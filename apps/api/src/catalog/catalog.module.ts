import { Module } from '@nestjs/common';

import { CatalogService } from './catalog.service';
import { CategoryRepository } from './category.repository';

@Module({
  providers: [CategoryRepository, CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
