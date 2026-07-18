# Session Bootstrap

**The entry point for every new session.** Read this first, then follow the order below.

This file is an **orchestrator**. It holds no project state, no milestone details and no
architecture of its own — those live in the documents it points to, and duplicating them
here would create a second source of truth that silently goes stale. If you need a fact,
this file tells you which document owns it.

---

## 1 · Read in this order

| # | File | Why it exists | Read it for |
| --- | --- | --- | --- |
| 1 | `docs/next-session.md` | Session handover, written by the previous session | The next task, what must not be changed, verification steps |
| 2 | `docs/project-status.md` | Current live state, overwritten each milestone | Milestone, branch, blockers, backend dependencies |
| 3 | `docs/decisions.md` | **Append-only** decision log (`ADR-0002`+) | *Why* the code is shaped this way |
| 4 | `docs/implementation-status.md` | **Historical record** | How past milestones were delivered and gates evaluated |
| 5 | `CLAUDE.md` | Working rules and architecture boundaries | Non-negotiable constraints, commands |

**#4 is history, not state.** It is never updated as the project moves on. Read it when
you need the reasoning behind a past milestone; do not treat it as current.

Beyond these, five **frozen** specification documents (`docs/phase8-*.html`) govern the
codebase. `CLAUDE.md` lists them. Read them when a task touches their subject matter —
they are authoritative, and if code and a frozen document disagree, **raise it** rather
than working around it.

## 2 · Who owns which answer

| Question | Authoritative source |
| --- | --- |
| What do I do next? | `next-session.md` |
| Where is the project now? | `project-status.md` |
| Why was this built this way? | `decisions.md` |
| How was a past milestone delivered? | `implementation-status.md` |
| What am I not allowed to do? | `CLAUDE.md` + `next-session.md` |
| What should the interface look like? | frozen `phase8-*` documents |
| **What does the API actually do?** | **the backend source, then the live endpoint** |

The last row is the one that matters most. No document is authoritative about backend
behaviour — only the backend is.

## 3 · Working principles

These are how work proceeds here. They have been earned, usually the hard way.

- **Verify backend contracts before implementing.** Read the controller, then call the
  live endpoint. Documents and runtime have diverged before, in both directions.
- **Never invent an API contract.** If an endpoint is missing or its shape is unclear,
  stop and raise a backend consultation item. Do not hardcode, infer, or derive a
  contract from adjacent data.
- **Expose only what the API supports.** No search box over an endpoint that cannot
  search; no client-side pagination faking a paginated backend. A control the API ignores
  misrepresents the system.
- **Respect the Rule of Three.** Three independent, genuinely comparable uses before
  extraction. A resource whose backend *cannot* express a capability is not evidence for
  abstracting it. `decisions.md` records the current thresholds.
- **Avoid speculative abstraction.** Do not build for an imagined caller. Duplication is
  the cheaper mistake and is often deliberate here — check `decisions.md` before
  "cleaning it up".
- **Preserve domain ownership.** Each resource owns its mapper, key factory, validation,
  permission checks and copy. Cross-domain reads go through a domain's public surface,
  never a deep import.
- **Prefer extending existing patterns** over inventing new ones. Copy the newest
  comparable resource's structure rather than designing a fresh one.
- **Authorize on permission strings, never roles**, and mirror the server's gating
  exactly — neither stricter (hiding what is permitted) nor looser (offering what will be
  refused). UI gating is UX only; the backend is the authority.
- **Stop when reality contradicts an assumption.** A contradicted plan is information,
  not an obstacle to route around. Report it and wait.
- **Keep documentation synchronised.** See §5.

## 4 · Before writing code

- [ ] Read the five documents in §1.
- [ ] Confirm the task is the one `next-session.md` names — do not work ahead.
- [ ] Run the verification commands from `next-session.md`; confirm the tree is clean and
      the suite is green **before** changing anything.
- [ ] Read the backend contract from source; call the live endpoint where possible.
- [ ] Read the newest comparable resource and copy its structure.
- [ ] Check `decisions.md` for a decision covering what you are about to do.
- [ ] Confirm nothing in the task requires touching a frozen or forbidden surface.
- [ ] **Present a plan and wait for approval.** Implementation follows approval, not
      intent.

## 5 · Before ending a session

- [ ] Full verification: lint · typecheck · format · tests · build. Report exact counts.
- [ ] Overwrite `docs/project-status.md` with current state.
- [ ] Overwrite `docs/next-session.md` for whoever comes next — including anything
      uncommitted, and anything they must not change.
- [ ] **Append** to `docs/decisions.md` *only* if a real architectural decision was made.
      Never rewrite or delete an entry; supersede it with a new one.
- [ ] Leave `docs/implementation-status.md` alone unless a milestone closed — it is the
      historical record, appended to at milestone boundaries only.
- [ ] Ensure status docs are accurate **as of the commit**, not as of mid-session.
- [ ] Report changed files, verification results, risks and unresolved blockers.
- [ ] Do not commit or push unless asked.

## 6 · Finishing the bootstrap

Once you have read §1's documents, **report back before doing anything else**:

1. **Current milestone** — and what was completed immediately before it.
2. **Current blockers** — frontend follow-ups and backend dependencies, flagging anything
   that blocks the named next task.
3. **Current implementation target** — the specific next task, and the contract or
   constraints it depends on.
4. **Anything that looks stale or contradictory** across the documents you just read.

Then **stop and wait for confirmation.**

Do not begin implementing, do not propose a design, and do not "just check" by editing
files. The bootstrap establishes shared context; the user decides what happens with it.
Point 4 matters as much as the rest — these documents are maintained by hand, and the
session that notices a contradiction is the one that can cheaply fix it.
