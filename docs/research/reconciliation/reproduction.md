# Reproduction and validation

Use the repository-pinned Node/pnpm versions. Keep original private artifacts,
source restrictions and review sheets out of git. No live AI or new source access
is required.

## Local setup

From the repository root, with existing local configuration and PostgreSQL:

```sh
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:migrate
pnpm --filter @elpa/api build
```

Migration `0005` adds only the Research assessment table and its constraints.
Do not recreate or overwrite a configured `.env.local`. For a fresh setup use
the sanitized examples and the application README. The imported isolated
campaign and source artifacts are prerequisites for the real experiment;
a fresh empty database cannot reproduce private-source counts from public keys.

## Replay pinned primary inputs

The retained primary corpus is privately stored at
`apps/api/.data/reconciliation/corpus-v2`. Run:

```sh
pnpm --filter @elpa/api research reconciliation-run --sample .data/reconciliation/corpus-v2
pnpm --filter @elpa/api research reconciliation-score --sample .data/reconciliation/corpus-v2
```

Expected on the existing database: zero new assessments, 28 unchanged, 53
profiles, 49 pair assessments and output digest
`acfcb8ec7e17e72979843e5c659265fbe744fbebb816f344d1ac781bde17550f`.
The score reports `independent_evaluation_incomplete`, zero scored cases and
null rates. It must not report perfect accuracy. Every repeat appends an Audit
event while preserving the original assessment timestamp.

The preflight `corpus-v1` is also replayable with these commands and retains
its separate digest. Corpus schema versions 1 and 2 are accepted; acquisition
and extraction method versions have not changed. Existing Claims remain
immutable. The replay checks every pinned projection against retained source
Claims; it preserves the pinned method-status snapshot if newer Evidence later
changes the Candidate's latest interpretation. Newly appended Claims are not
silently inserted into the old corpus.

To assess a later state, export a **new** directory:

```sh
pnpm --filter @elpa/api research reconciliation-corpus \
  --campaign 01a15d8d-edc4-7a6d-bc18-26af6cccfdf3 \
  --out .data/reconciliation/corpus-next
pnpm --filter @elpa/api research reconciliation-run --sample .data/reconciliation/corpus-next
```

Export refuses to overwrite a sealed corpus. The new corpus pins a new reference
time and membership. It creates new assessment fingerprints, preserving earlier
history. A source/frame mismatch fails explicitly; no replacement is selected.
The sampling policy and exclusions are described in the
[annotation guide](./annotation-guide.md). New exports are new experiments,
not byte-identical reproductions of the archived corpus.

## Independent scoring

Give two independent human reviewers the source-backed corpus and separate copies
of `review-template.private.json`. Follow the review rubric and retain all
rationales. Then:

```sh
pnpm --filter @elpa/api research reconciliation-score \
  --sample .data/reconciliation/corpus-v2 \
  --labels .data/reconciliation/reviewer-a.private.json \
  --labels .data/reconciliation/reviewer-b.private.json \
  --adjudication .data/reconciliation/adjudication.private.json
```

Omit adjudication until it exists. Disagreements remain excluded. The strict
review/adjudication schemas are in `reconciliation/evaluation.ts`; JSON nulls
in the template are deliberate incomplete fields, not acceptable truth labels.
Only same-attribute pairs are enumerated. Other targets remain separate profiles;
review scope/normalization errors in the case-level judgment as well.

## Data Studio

Run `pnpm dev` and open the Candidate page. One development example is:

```text
/studio/research-campaigns/01a15d8d-edc4-7a6d-bc18-26af6cccfdf3/candidates/01a15d8e-3ae3-7b2c-bf4c-e4c10f0bf1be
```

For other examples, use development Candidate IDs in `data/manifest.json`. Click **Inspectează evaluările de cercetare**
and expand an assessment. Choose an attribute to inspect its input Claims,
source passages/locators, normalized values, timing, qualifiers, relationship
rules and uncertainty. Cross-Candidate Evidence links open that Candidate's
protected source context. Up to 20 recent assessments are returned; this is a
bounded experiment inspector, not an unbounded historical search interface.

`GET /api/admin/research-campaigns/{campaignId}/candidates/{candidateId}/reconciliation`
is Administrator-guarded and checks Candidate/campaign membership. It has no
mutation, verification or publication counterpart. Raw source content is not
available through public Recommendation routes.

## Automated checks

```sh
pnpm validate
pnpm db:check
pnpm openapi:generate
pnpm --filter @elpa/web exec playwright test --project=chromium
git diff --check
```

Check generated contract changes against this task's expected additions; the
existing working tree already contained earlier visual/review changes. Tests
use synthetic inputs and captured/local data only. The actual-source corpus is
private and is not a CI fixture. Tests exercise units, definitions, negation
values, seasons, intervals, entity scope, shared/correlated Evidence, independent
confirmation fixtures, invalid references, abstention, reruns and history.

The generated proposition schema can be reproduced after building the API:

```sh
cd apps/api
node -e 'const fs=require("node:fs"); const {z}=require("zod"); const {propositionSchema}=require("./dist/research/reconciliation/contracts"); fs.writeFileSync("../../docs/research/reconciliation/data/proposition.schema.json", JSON.stringify(z.toJSONSchema(propositionSchema),null,2)+"\n")'
```

Run Prettier on the generated JSON. Source passages, completed labels and raw
results with quotations stay private. Only key manifests, schemas and aggregate
reports belong in the repository.
