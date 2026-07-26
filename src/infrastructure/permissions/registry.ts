/**
 * The permission registry (FTA §6).
 *
 * The ONLY place a permission string literal appears in this codebase. A string
 * typed inline in a component cannot be renamed, found, or audited — which is how
 * the sidebar and the route guards drifted apart in the legacy build.
 *
 * Names MUST mirror the backend's App\Authorization\*Permissions classes exactly.
 * They are what Spatie's `permission:*` middleware actually checks; checking the
 * same string the server checks is what makes it impossible for the UI and the API
 * to disagree about what is allowed.
 *
 * ENTRIES ARE ADDED PER RESOURCE (resource recipe, step 1) — never ahead of the
 * domain that uses them, which would be guessing at a backend contract.
 */
export const PERMISSIONS = Object.freeze({
  /**
   * The only permission guarding reference data. Villes, Secteurs and Products
   * are ALL gated behind this single coarse string server-side
   * (`routes/api.php:160-165`, `VilleController::middleware()`) — there is no
   * `view-villes` / `create-ville` / `update-ville` / `delete-ville`.
   *
   * So every ville action resolves to the same check, including the ones the UI
   * renders separately (create, edit, delete). That is not a modelling shortcut
   * here; it mirrors what the server actually enforces, which is the whole point
   * of this registry. Granular ville permissions are an open backend question —
   * when they land, the entries split here and the call sites follow.
   */
  ACCESS_DASHBOARD: "access-dashboard",

  /**
   * Admin management — the FIRST genuinely granular permission set in the product.
   *
   * Unlike the reference resources, these are four distinct server-side checks
   * (`routes/api.php`: create-admin, update-admin, block-admin, delete-admin),
   * each guarding one route. So the UI gates each action independently rather than
   * collapsing them into one "can manage" flag — which is what D-5 was designed
   * for and what reference data could not exercise.
   */
  CREATE_ADMIN: "create-admin",
  UPDATE_ADMIN: "update-admin",
  BLOCK_ADMIN: "block-admin",
  DELETE_ADMIN: "delete-admin",

  /**
   * Agent management — managers and commercials share one permission set, because
   * the backend gives them one controller and one set of routes
   * (`routes/api.php:193-232`).
   *
   * `VIEW_AGENTS` is the first LIST permission in the product that is not
   * `access-dashboard`: reference data and Admins are both behind that coarse
   * string, agents are not. It gates the managers list, the commercials list and
   * the single-agent read.
   *
   * BLOCK and ACTIVATE are SEPARATE server-side checks on separate routes, so they
   * are separate entries here. An operator can hold one and not the other, and
   * collapsing them into one "can change status" flag would show a control the API
   * would refuse.
   *
   * `CREATE_AGENT` (M3.6) gates `POST /admin/agents` — the agent onboarding
   * wizard, a NEW dedicated domain (`domains/network/agent-onboarding`), not
   * hosted inside Managers or Commercials (ADR-0012): the endpoint creates
   * either role through one controller action, so it belongs to neither.
   *
   * DELIBERATELY ABSENT until they have a caller (this file's own rule — entries
   * are added per resource, never ahead of the domain that uses them):
   *   `manage-agent-status`  — guards `toggle-status`, which this domain does not
   *                            use: it flips active↔blocked only and so cannot
   *                            express the third status. Block and activate are
   *                            precise; the toggle is not.
   *   `delete-agent`         — guards `destroy`, which sets `status = 'blocked'`
   *                            and is therefore the same outcome as `block`
   *                            (BC-R). Registering it would imply the UI offers a
   *                            deletion it cannot honestly perform.
   */
  VIEW_AGENTS: "view-agents",
  UPDATE_AGENT: "update-agent",
  BLOCK_AGENT: "block-agent",
  ACTIVATE_AGENT: "activate-agent",
  CREATE_AGENT: "create-agent",

  /**
   * Client management — its OWN permission set, gated by `ClientController`,
   * entirely separate from the Agent domains' `view-agents`/`update-agent`.
   * `routes/api.php`'s `/admin/clients` group carries eight permissions in
   * total. `create-client`, `delete-client`, `view-client-stats` and
   * `reset-client-password` gate real endpoints (create, delete, statistics,
   * password reset) that remain explicitly OUT OF SCOPE — registering them
   * now would be guessing at UI that does not exist (this file's own rule).
   *
   * `MANAGE_CLIENT_STATUS` gates the ONLY status-changing endpoint for
   * clients (`PATCH /{id}/status`) — there is no separate block/activate
   * pair the way the Agent domains have, so this permission is used
   * directly, unlike `manage-agent-status`, which Managers/Commercials
   * deliberately avoid.
   *
   * `ASSIGN_CLIENT` (M3.5) gates all four of `assignToAgent`/`assignBulk`/
   * `reassign`/`unassignFromAgent` server-side (`routes/api.php:319-332`
   * all share the identical `permission:assign-client` middleware) — but
   * this milestone builds ONLY `PATCH /assign-bulk` against it. The single-
   * client assign/reassign/unassign actions remain unbuilt; this string is
   * not evidence they are in scope, only that the bulk endpoint shares
   * their gate.
   */
  VIEW_CLIENTS: "view-clients",
  UPDATE_CLIENT: "update-client",
  MANAGE_CLIENT_STATUS: "manage-client-status",
  ASSIGN_CLIENT: "assign-client",

  /**
   * Cheque management (roadmap M4.2) — the first Money permission set, and
   * the first resource outside Network. `ChequeController` carries SIX
   * distinct server-side checks (`routes/api.php:246-278`), more granular
   * than any prior resource: submission, three separate list reads, and
   * three separate status actions are each their own permission, with no
   * coarse fallback the way reference data has `access-dashboard`.
   *
   * `VIEW_CHEQUES` gates the general list (`GET /admin/cheques`) and the
   * single-record read (`GET /admin/cheques/{id}`) — the route and the
   * screen this M4.2 phase actually builds.
   *
   * `VIEW_PENDING_CHEQUES` is its OWN permission, separate from
   * `VIEW_CHEQUES` — `GET /admin/cheques/pending` is a distinct route with
   * a distinct check, so an operator can hold one without the other. Not
   * wired to a UI control yet: the pending queue (`ApprovalQueuePage`) is a
   * later M4.2 phase.
   *
   * `APPROVE_CHEQUE`/`REJECT_CHEQUE`/`ANNULER_CHEQUE` each gate their own
   * route (`PUT .../approve`, `.../reject`, `.../annuler`) and were
   * registered together with the read permissions at Phase 2, because the
   * whole six-permission set was verified from source as one stable
   * vocabulary during M4's discovery pass — unlike Clients' still-undecided
   * extra permissions, nothing here is speculative. None of these three
   * action permissions is wired to a UI control yet (no mutations, no
   * dialogs — a later M4.2 phase); registering them ahead of time is what
   * lets that later phase gate an action without touching this file again.
   *
   * `CREATE_CHEQUE` gates `POST /admin/cheques` and is now WIRED (Phase
   * 3A): the "Create Cheque" button on the list page, and the
   * `/money/cheques/new` route itself.
   */
  VIEW_CHEQUES: "view-cheques",
  VIEW_PENDING_CHEQUES: "view-pending-cheques",
  CREATE_CHEQUE: "create-cheque",
  APPROVE_CHEQUE: "approve-cheque",
  REJECT_CHEQUE: "reject-cheque",
  ANNULER_CHEQUE: "annuler-cheque",

  /**
   * Deposit management (roadmap M4.3) — the second Money permission set.
   * `DepoController` carries four distinct server-side checks
   * (`routes/api.php:373-390`): one list/detail read and three status
   * actions, verified fresh from source this phase (the backend changed
   * since the M4.3 discovery pass — `index()`/`show()`/`store()` were
   * unified onto one `DepoResource` shape in the meantime).
   *
   * `VIEW_DEPOSITS` gates the general list (`GET /admin/depos`) and the
   * single-record read (`GET /admin/depos/{depo}`) — the route and screen
   * this M4.3 phase actually builds. Unlike Cheques, there is no separate
   * "pending" permission or route: `index()` has no dedicated pending-queue
   * endpoint, so a future pending view would just be this same list,
   * pre-filtered, behind this same permission.
   *
   * `CREATE_DEPOSIT`/`VALIDATE_DEPOSIT`/`REJECT_DEPOSIT` each gate their own
   * route (`POST .../`, `POST .../validate`, `POST .../reject`) and are
   * registered now, together with the read permission, because the whole
   * four-permission set was verified from source as one stable vocabulary
   * this phase — the same reasoning Cheques' own six-permission set was
   * registered together at its Phase 2, ahead of the mutations that use
   * them. None of these three is wired to a UI control yet (no detail page,
   * no dialogs — later M4.3 phases).
   */
  VIEW_DEPOSITS: "view-depos",
  CREATE_DEPOSIT: "create-depo",
  VALIDATE_DEPOSIT: "validate-depo",
  REJECT_DEPOSIT: "reject-depo",

  /**
   * Debt Payments (roadmap M4, the third and final Money deliverable) — a
   * single permission, verified fresh from source (`routes/api.php:167-170`):
   * `GET /admin/debt-payments` AND `POST /admin/debt-payments` both carry
   * `permission:debt_cash`, unlike Cheques/Deposits' own split
   * view/create/validate/reject vocabularies. There is no separate
   * "view" vs "create" string here because the backend does not have one —
   * this registry mirrors that exactly rather than inventing a split for
   * consistency with the other two Money resources. `show`/`destroy` are
   * commented out in `routes/api.php` (dead code) — no permission is
   * registered for either, since neither route exists to gate.
   */
  DEBT_PAYMENTS: "debt_cash",

  /**
   * Agent Stock Returns (roadmap M5, Phase 1 — the first Stock resource) —
   * eight permissions, verified fresh from source
   * (`App\Authorization\AgentStockReturnPermissions::ALL`). Gated in
   * FormRequests (`authorize()`), NOT route middleware — a genuine
   * departure from every prior domain's `->middleware('permission:...')`
   * convention, confirmed by reading `routes/api.php`'s own
   * `agent-stock-returns` group (no middleware calls at all there).
   *
   * `VIEW_AGENT_STOCK_RETURN` IS DELIBERATELY SINGULAR
   * (`view-agent-stock-return`) — copied verbatim from the backend
   * constant, not normalized to match its own sibling strings (which are
   * all singular `agent-stock-return` too, so this one is actually
   * consistent internally; it is Cheques'/Deposits' OWN plural resource
   * names, e.g. `view-cheques`, that are the outlier across this
   * registry). A test pins the exact string.
   *
   * `VALIDATE_AGENT_STOCK_RETURN` is excluded from the backend's own
   * `ADMIN_GRANTS` (super-admin only — verified from source), the same
   * posture Cheques'/Deposits'/Bons' own validate/approve permissions
   * already have.
   */
  VIEW_AGENT_STOCK_RETURN: "view-agent-stock-return",
  CREATE_AGENT_STOCK_RETURN: "create-agent-stock-return",
  UPDATE_AGENT_STOCK_RETURN: "update-agent-stock-return",
  DELETE_AGENT_STOCK_RETURN: "delete-agent-stock-return",
  VALIDATE_AGENT_STOCK_RETURN: "validate-agent-stock-return",
  CREATE_AGENT_STOCK_RETURN_LINE: "create-agent-stock-return-line",
  UPDATE_AGENT_STOCK_RETURN_LINE: "update-agent-stock-return-line",
  DELETE_AGENT_STOCK_RETURN_LINE: "delete-agent-stock-return-line",

  /**
   * Agent Transfers (roadmap M5, Phase 2) — eight permissions, verified
   * fresh from source (`App\Authorization\AgentTransferPermissions::ALL`).
   * Same FormRequest-gated posture as Agent Stock Returns (no route
   * middleware).
   *
   * `VIEW_AGENT_TRANSFERS` IS PLURAL (`view-agent-transfers`) — copied
   * verbatim from the backend constant. NOT a mechanical rename of Agent
   * Stock Return's own singular `view-agent-stock-return`: the two
   * resources' permission vocabularies were independently seeded and
   * genuinely differ in pluralization. A test pins the exact string.
   *
   * `VALIDATE_AGENT_TRANSFER` is excluded from the backend's own
   * `ADMIN_GRANTS` (super-admin only, verified from source) — Transfer
   * validation is an irreversible stock-materialization act (manager
   * floor debit + commercial credit), the same posture every other
   * validate/approve permission in this registry already has.
   */
  VIEW_AGENT_TRANSFERS: "view-agent-transfers",
  CREATE_AGENT_TRANSFER: "create-agent-transfer",
  UPDATE_AGENT_TRANSFER: "update-agent-transfer",
  DELETE_AGENT_TRANSFER: "delete-agent-transfer",
  VALIDATE_AGENT_TRANSFER: "validate-agent-transfer",
  CREATE_AGENT_TRANSFER_LINE: "create-agent-transfer-line",
  UPDATE_AGENT_TRANSFER_LINE: "update-agent-transfer-line",
  DELETE_AGENT_TRANSFER_LINE: "delete-agent-transfer-line",
} as const satisfies Record<string, string>);

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Roles are NOT an authorization primitive here (FTA D-5). They exist on the
 * session because the backend sends them; nothing may branch on them. Kept as a
 * named constant so a reviewer grepping for role checks finds this note first.
 */
export const ROLES_ARE_NOT_AUTHORIZATION = true as const;
