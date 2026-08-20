/**
 * Central registry of Web Storage keys. Never build storage keys inline —
 * add them here so collisions and migrations stay manageable.
 *
 * NOTE: `preferences` is also read by the inline color-scheme script in
 * `index.html`. Keep the key stable, or update `index.html` at the same time.
 */
export const storageKeys = {
  preferences: 'app.preferences',
  ui: 'app.ui',
} as const;

export type StorageKey = (typeof storageKeys)[keyof typeof storageKeys];
