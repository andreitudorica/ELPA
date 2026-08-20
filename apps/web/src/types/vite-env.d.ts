/// <reference types="vite/client" />

// Raw (unvalidated) environment variables as Vite injects them.
// Application code must consume the validated `env` from `@/lib/env` instead.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_TIMEOUT_MS?: string;
  readonly VITE_ENABLE_MSW?: string;
  readonly VITE_ENABLE_DEVTOOLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
