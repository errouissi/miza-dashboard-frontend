# CLAUDE.md — Miza Dashboard (frontend-v2)

Guidance for Claude Code when working in this repository.

## Source of truth

Five approved, **frozen** documents govern this codebase. They are authoritative; this file
only summarises the rules that get broken most often. Read them, do not re-derive them:

- `docs/phase8-discovery-report.html` — what existed, and the backend's gaps
- `docs/phase8-architecture.html` — the five business domains and page patterns
- `docs/phase8-design-system.html` — how the interface looks and behaves
- `docs/phase8-frontend-technical-architecture.html` — **how the code is organized (read first)**
- `docs/phase8-frontend-implementation-roadmap.html` — what to build, in what order

If the code and a document disagree, the document wins — unless implementation has found a
genuine contradiction, in which case **raise it**, do not work around it.

## Commands

Package manager is **pnpm** (`pnpm-lock.yaml`).

| Command                             | Does                                              |
| ----------------------------------- | ------------------------------------------------- |
| `pnpm dev`                          | Vite dev server                                   |
| `pnpm build`                        | typecheck (`tsc -b`) then production build        |
| `pnpm preview`                      | preview the production build                      |
| `pnpm lint`                         | ESLint — **enforces the architecture boundaries** |
| `pnpm typecheck`                    | `tsc -b`                                          |
| `pnpm test`                         | Vitest (watch)                                    |
| `pnpm test:ci`                      | Vitest (single run)                               |
| `pnpm format` / `pnpm format:check` | Prettier                                          |

## Architecture rules (non-negotiable)

Dependencies point **downward only**: `app → domains → shared → infrastructure`.
Violations fail lint and therefore fail CI. Do not suppress them — fix the design, or write an ADR.

- **No architecture changes** without explicit approval or an ADR in `docs/adr/`.
- **No business logic in `shared/` or `infrastructure/`.** If a shared component needs to know
  what a cheque is, it is a domain component. Pass the data in.
- **No server data copied into local or global state.** TanStack Query is the cache. A
  `useEffect` that copies query data into `useState` is a bug.
- **No direct `axios` usage** outside `src/infrastructure/http`. Resources call their `api/` module.
- **No inline query keys.** Every key comes from its resource's key factory.
- **No inline permission strings.** They live only in the central permission registry.
- **No role-based authorization checks.** Authorize on permission strings, never on roles.
- **No optimistic mutations for financial workflows.** None in v1 (FTA D-7). Mutations never auto-retry.
- **No inline formatting.** Money, dates, phones, identifiers render through `shared/formatters`.
- **No new dependency** without justification and an ADR.
- **No premature shared abstractions.** Promote on stable shared semantics evidenced across
  three independent domains — never on reuse count alone. Duplication is the cheaper mistake.
- **No `import.meta.env`** outside `src/infrastructure/config`. Components branch on a declared
  capability (`config.features.*`), never on an environment name.

## Legacy

`C:\Miza\frontend` is **reference-only**. It was the bootstrap source for the scaffold and
nothing more. It is **not** an architecture reference and **not** an implementation reference.
Do not copy patterns from it, do not synchronise with it, do not preserve compatibility with it.

## Working agreement

- **Review first, modify second.** Read the relevant code before changing it.
- **Do not implement beyond the currently assigned milestone.** Current milestone and next
  approved task are in `docs/implementation-status.md`.
- Always report: **changed files, verification commands run, risks, and unresolved blockers.**
- Do not commit or push unless asked.
