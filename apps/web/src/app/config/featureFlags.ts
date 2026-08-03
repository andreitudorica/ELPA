/**
 * Static feature flags.
 *
 * This is intentionally a plain typed object: flip a flag in code, ship it
 * with the bundle. When a remote flag provider (LaunchDarkly, Unleash,
 * GrowthBook, …) is introduced, keep this shape and replace the values with
 * provider lookups behind the same `isFeatureEnabled` call so call sites
 * stay unchanged.
 *
 * The registry starts empty — add a flag only when a feature genuinely needs
 * one. Env variables are for environment differences, never feature toggles.
 */
export const featureFlags = {} as const satisfies Record<string, boolean>;

export type FeatureFlag = keyof typeof featureFlags;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag];
}
