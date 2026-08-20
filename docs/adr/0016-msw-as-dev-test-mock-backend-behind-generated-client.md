# Mock Service Worker as dev and test mock backend behind the generated client

The client application, `apps/web`, will keep Mock Service Worker (MSW) as a
permanent mock backend for local development, component tests, Storybook, and
end-to-end tests, gated so it never runs in a production build. MSW handlers
are not an alternative contract: once `apps/api` publishes its OpenAPI
document, handler request and response shapes must be typed against the
generated OpenAPI types in `apps/web/src/lib/apiClient/generated/`, so a
contract change surfaces as a TypeScript error in the mocks rather than a
runtime surprise in the UI. Until the OpenAPI document exists, handlers may
use hand-written interim types under `src/mocks/types.ts`, and the migration
to generated types is a required follow-up recorded in this decision. The
production gating is a defence-in-depth pair: `import.meta.env.DEV` short-
circuits worker registration, and a `VITE_APP_ENV === 'production'` check
refuses to boot the worker in any deploy that identifies as production even
when the `DEV` flag is misinterpreted. An ESLint rule forbids importing from
`msw` outside `src/mocks/**` and `src/test/**` to prevent accidental leakage
of mock code into production bundles. This decision is compatible with ADR
0012's designation of the generated client as the REST contract authority:
MSW is a transport-layer mock consumed only in non-production runtimes, and
the generated types remain the single source of truth. The alternative of
removing MSW at the moment `apps/api` becomes reachable was rejected because
it would forfeit component-workshop network stories, hermetic end-to-end
tests, and the ability to iterate on `apps/web` when the API is unavailable;
the alternative of removing MSW immediately was rejected because it would
block frontend development on API scaffolding.
