# Monorepo with independent applications

Superseded in part by ADR 0015: the client-application split into `frontend`
and `data-studio` is replaced by one client application (`apps/web`) that
serves both audiences through route-based separation. The monorepo posture,
the prohibition on cross-application imports, and the shared-packages rule for
reusable contracts and tooling remain in force for the two applications that
exist (`apps/api` and `apps/web`).

ELPA will keep its applications in one monorepo so agents and developers can
change contracts and consumers atomically. Each application remains
independently runnable, testable, buildable, and deployable; direct imports
between applications are prohibited, and reusable contracts or tooling must
live in explicitly owned shared packages.
