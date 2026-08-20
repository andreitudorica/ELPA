# `lib/apiClient/`

The typed contract layer between `apps/web` and `apps/api`, per ADR 0012.

## Structure

```
apiClient/
  generated/          # openapi-typescript output; never edited by hand
    schema.d.ts       # produced by `pnpm codegen` from apps/api/openapi.yaml
    README.md
  index.ts            # curated public surface: namespaced operation wrappers
```

The generated file is committed so fresh clones work without codegen, and so
PR diffs surface contract changes. CI runs `pnpm codegen && git diff --exit-code`
to fail builds that forget to regenerate.

## Layered relationship with `lib/api/`

`lib/api/client.ts` is the single transport chokepoint (bearer token, 401
handler, timeout, and RFC 7807 normalization). The curated `identity` and
`studio` operations in `apiClient/index.ts` delegate to it while their payloads
come from the generated contract. This preserves observability and the
identity-boundary hooks without shipping a second fetch abstraction.

## MSW handlers

Per ADR 0016, `src/mocks/handlers/**` must type its request and response
shapes against `generated/schema.d.ts` once it exists, so contract drift
surfaces as a TypeScript error. Interim hand-written types under
`src/mocks/types.ts` are permitted only until the first real generation.

The generated file is source-controlled. Run `pnpm openapi:generate` at the
repository root after every API contract change; it regenerates both the API
document and these TypeScript types.
