# Monorepo with independent applications

ELPA will keep `api`, `frontend`, and `data-studio` in one monorepo so agents and
developers can change contracts and consumers atomically. Each application
remains independently runnable, testable, buildable, and deployable; direct
imports between applications are prohibited, and reusable contracts or tooling
must live in explicitly owned shared packages.
