import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import type { AppClsStore } from '../common';
import { DatabaseService } from './database.service';

@Injectable()
export class UnitOfWork {
  constructor(
    private readonly database: DatabaseService,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.cls.get('databaseTransaction') !== undefined) return work();

    return this.database.root.transaction((transaction) =>
      this.cls.runWith({ ...this.cls.get(), databaseTransaction: transaction }, work),
    );
  }
}
