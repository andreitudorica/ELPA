// Drizzle's tooling needs one schema entry point. Each table remains owned by
// its domain module; this file only composes those definitions for migrations.
export * from '../access/access.schema';
export * from '../audit/audit.schema';
export * from '../catalog/catalog.schema';
export * from '../research/research.schema';
