import type { ReactNode } from "react";
import { usePermission } from "@/shared/hooks";

type RequirePermissionProps = {
  /** A string from the central registry — never an inline literal (FTA §6). */
  permission: string;
  children: ReactNode;
  /**
   * Rendered when the permission is absent.
   *
   * For an ACTION, absent means the control is not rendered at all: Design System §10
   * requires a disabled control to explain itself, and "you lack the permission" is not
   * an explanation an operator can act on. For a ROUTE, the fallback is the calm 403
   * state (Design System §23) — a real screen, which arrives in M1-B. This PR ships no UI.
   */
  fallback?: ReactNode;
};

/** Route/UI guard: does the session hold this permission? (FTA §6) */
export function RequirePermission({
  permission,
  children,
  fallback = null,
}: RequirePermissionProps) {
  const { has } = usePermission();
  return has(permission) ? <>{children}</> : <>{fallback}</>;
}
