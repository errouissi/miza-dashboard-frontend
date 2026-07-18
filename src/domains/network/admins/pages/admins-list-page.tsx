import { useState } from "react";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { Button } from "@/shared/components/ui/button";
import { ListPage } from "@/shared/components/patterns/list-page";
import {
  ListEmptyState,
  ListErrorState,
  ListLoadingState,
} from "@/shared/components/patterns/list-states";
import { AdminFormSheet } from "../components/admin-form-sheet";
import { DeleteAdminDialog } from "../components/delete-admin-dialog";
import { ToggleAdminStatusDialog } from "../components/toggle-admin-status-dialog";
import { useAdminsQuery } from "../queries/admins-queries";
import type { Admin } from "../model/admin";

/**
 * The Admins list (roadmap M3.1) — the fourth reference-shaped resource.
 *
 * IT EXPOSES ONLY WHAT THE ENDPOINT SUPPORTS. `AdminController::index()` ends in
 * `->get()` and accepts no parameters at all: no pagination, no search, no filter,
 * no sort. So this screen has none of those controls, and no filter row.
 *
 * EVERY ACTION IS GATED ON ITS OWN PERMISSION. This is the first screen where that
 * is a real distinction rather than a formality: the backend guards each route with
 * a different string (create-admin, update-admin, block-admin, delete-admin), so an
 * operator can legitimately hold one and not the others. Collapsing them into a
 * single "can manage" flag would show controls the API would refuse — the exact
 * drift the permission registry exists to prevent (FTA D-5, §6).
 *
 * These checks are UX only. The backend remains the authority (FTA §17); a hidden
 * button is not a protected action.
 *
 * STATUS IS A BOOLEAN, rendered with a domain-owned label. Admins is deliberately
 * NOT evidence for a future enum-based StatusBadge — the agents' three-value status
 * is a different vocabulary, and one boolean does not generalise to it.
 *
 * Permission management is absent, not stubbed: see BC-M and BC-D.
 */
export function AdminsListPage() {
  const adminsQuery = useAdminsQuery();
  const { has } = usePermission();

  // Four independent gates, mirroring four independent server-side checks.
  const canCreate = has(PERMISSIONS.CREATE_ADMIN);
  const canUpdate = has(PERMISSIONS.UPDATE_ADMIN);
  const canToggleStatus = has(PERMISSIONS.BLOCK_ADMIN);
  const canDelete = has(PERMISSIONS.DELETE_ADMIN);
  const hasAnyRowAction = canUpdate || canToggleStatus || canDelete;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Admin | undefined>(undefined);
  const [deleting, setDeleting] = useState<Admin | undefined>(undefined);
  const [togglingStatus, setTogglingStatus] = useState<Admin | undefined>(undefined);

  const listErrorReference = isAppError(adminsQuery.error)
    ? resolveErrorDisplay(adminsQuery.error).requestId
    : undefined;

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (admin: Admin) => {
    setEditing(admin);
    setFormOpen(true);
  };

  const admins = adminsQuery.data;

  return (
    <ListPage
      title="Admins"
      action={canCreate ? <Button onClick={openCreate}>New admin</Button> : null}
    >
      {adminsQuery.isPending ? (
        <ListLoadingState />
      ) : adminsQuery.isError ? (
        <ListErrorState
          message="The list of admins could not be loaded."
          reference={listErrorReference}
          onRetry={() => void adminsQuery.refetch()}
        />
      ) : admins && admins.length === 0 ? (
        <ListEmptyState>No admin yet.</ListEmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                {/* Plain headers: the endpoint accepts no `sort`. */}
                <th scope="col" className="p-2 font-medium">
                  Name
                </th>
                <th scope="col" className="p-2 font-medium">
                  Email
                </th>
                <th scope="col" className="p-2 font-medium">
                  Status
                </th>
                <th scope="col" className="w-56 p-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {admins?.map((admin) => (
                <tr key={admin.id} className="border-b">
                  <td className="p-2">{admin.name}</td>
                  <td className="text-muted-foreground p-2">{admin.email}</td>
                  <td className="p-2">
                    {/* A boolean, labelled locally. No shared badge (M3.1 scope). */}
                    <span
                      className={
                        admin.isActive ? "text-sm" : "text-muted-foreground text-sm"
                      }
                    >
                      {admin.isActive ? "Active" : "Blocked"}
                    </span>
                  </td>
                  <td className="p-2">
                    {hasAnyRowAction ? (
                      <div className="flex justify-end gap-2">
                        {canUpdate ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(admin)}
                            aria-label={`Edit ${admin.name}`}
                          >
                            Edit
                          </Button>
                        ) : null}
                        {canToggleStatus ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTogglingStatus(admin)}
                            aria-label={
                              admin.isActive
                                ? `Block ${admin.name}`
                                : `Activate ${admin.name}`
                            }
                          >
                            {admin.isActive ? "Block" : "Activate"}
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleting(admin)}
                            aria-label={`Delete ${admin.name}`}
                          >
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminFormSheet open={formOpen} onOpenChange={setFormOpen} admin={editing} />
      <DeleteAdminDialog
        admin={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined);
        }}
      />
      <ToggleAdminStatusDialog
        admin={togglingStatus}
        onOpenChange={(open) => {
          if (!open) setTogglingStatus(undefined);
        }}
      />
    </ListPage>
  );
}
