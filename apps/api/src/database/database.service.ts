import type { OnApplicationShutdown } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { ClsService } from 'nestjs-cls';
import { Pool } from 'pg';

import type { AppClsStore } from '../common';
import { loadEnv } from '../config/env';
import * as schema from '../drizzle/schema';
import type { AppDatabase, AppTransaction } from './database.types';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly pool: Pool;
  private readonly database: AppDatabase;

  constructor(private readonly cls: ClsService<AppClsStore>) {
    const env = loadEnv();
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_MAX,
      connectionTimeoutMillis: 5_000,
    });
    this.database = drizzle({ client: this.pool, schema });
  }

  /** Repositories transparently join the active unit-of-work transaction. */
  get executor(): AppDatabase {
    const transaction = this.cls.get<AppTransaction | undefined>('databaseTransaction');
    return transaction ?? this.database;
  }

  get root(): AppDatabase {
    return this.database;
  }

  async ping(): Promise<void> {
    await this.database.execute(sql`select 1`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
