# pnpm workspaces with Turborepo

ELPA will use `pnpm` workspaces for dependency and package management and
Turborepo for dependency-aware task orchestration and caching. Node.js and
`pnpm` versions will be pinned for reproducibility, while every package-level
task must remain directly executable so local work and automation are not
coupled exclusively to the orchestration layer.
