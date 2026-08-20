import { z } from 'zod';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Builds a Zod schema for the standard paginated envelope around `itemSchema`. */
export function paginatedSchema<TSchema extends z.ZodType>(itemSchema: TSchema) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  });
}

export type SortDirection = 'asc' | 'desc';

export interface PageParams {
  page: number;
  pageSize: number;
}
