# TypeScript as the primary language

ELPA will use TypeScript across `api`, `frontend`, and `data-studio` to minimize
context switching and share schema, validation, API-client, linting, and test
tooling inside the monorepo. Another runtime may be introduced only behind a
clear application or worker boundary when a concrete workload—such as a data
extraction pipeline—demonstrates that the added operational and agentic-work
cost is justified.
