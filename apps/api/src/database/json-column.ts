import { customType } from 'drizzle-orm/pg-core';

/**
 * `jsonb` column that returns the value exactly as stored.
 *
 * node-postgres already parses `jsonb` results. Drizzle's built-in `jsonb`
 * column then calls `JSON.parse` again on string results, so the stored JSON
 * string `"10013733"` is read back as the number `10013733` and `"true"` as a
 * boolean. Use this column for values that may be top-level JSON strings,
 * such as Claim values, where that coercion would corrupt evidence.
 */
export const exactJsonb = customType<{ data: unknown; driverData: unknown }>({
  dataType: () => 'jsonb',
  toDriver: (value) => JSON.stringify(value),
  fromDriver: (value) => value,
});
