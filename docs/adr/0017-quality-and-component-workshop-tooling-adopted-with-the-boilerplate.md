# Quality and component-workshop tooling adopted with the boilerplate

Alongside the React chassis referenced in ADR 0015, `apps/web` adopts a
bundle of quality and component-workshop tooling that no earlier ADR
described: Storybook 10 with the accessibility, docs, interaction-test, and
MSW addons as the component workshop; Vitest 4 with Testing Library and
jsdom for unit and component tests; Playwright with `@axe-core/playwright`
for end-to-end and accessibility tests; ESLint 10 (flat, type-aware) with
Prettier, Husky, `lint-staged`, and Commitlint enforcing code style and
commit-message discipline; and Renovate for dependency updates. These tools
are adopted because the chassis was chosen partly for them: they are
integrated, current, and would be expensive to reintroduce piecemeal later.
The Playwright test matrix runs Chromium only on pull requests to keep
feedback fast; the full matrix (Chromium, Firefox, WebKit, mobile) runs as
a scheduled nightly. Storybook is scoped to the component workshop and must
not import routes, route guards, the identity boundary, or feature modules;
this is enforced by an ESLint override on `**/*.stories.tsx`. Renovate
groups updates by ecosystem (Material UI, TanStack, ESLint, Storybook) to
reduce pull-request noise, and no auto-merge rules are enabled during the
alpha. Commitlint accepts a fixed scope enumeration (`web`, `api`, `docs`,
`infra`, `deps`, `chore`) so history remains uniform across the monorepo.
The alternative of picking each tool independently was rejected because it
sacrificed the internal integration the boilerplate ships (for example,
`msw-storybook-addon` binds the ADR 0016 mocks to Storybook stories) and
would have required custom wiring for no observable gain. The alternative
of adding visual-regression tooling such as Chromatic was rejected as
premature: with no established design language yet, the marginal value
does not justify the operational cost.
