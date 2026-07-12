import { useSession } from "@/shared/hooks";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Separator } from "@/shared/components/ui/separator";
import { SidebarTrigger } from "@/shared/components/ui/sidebar";

/**
 * The application header.
 *
 * DELIBERATELY MINIMAL, and each absence is a decision rather than an omission:
 *
 *   - NO breadcrumb. Design System §2 places the breadcrumb in the PAGE header,
 *     above the page title, and omits it on top-level lists. It is not shell
 *     chrome. It ships with PageHeader.
 *
 *   - NO page title. Design System §5: exactly one page title per page, owned by
 *     the page. A second title in the header would compete with it.
 *
 *   - NO logout. A client-only logout would clear localStorage while leaving the
 *     bearer token valid server-side — there is no revocation call yet. A logout
 *     that lies is worse than no logout button. It ships with the auth flow.
 *
 *   - NO global search. Design System §15 scopes search per-resource and warns
 *     that invisible global scope is a correctness hazard on financial data.
 *
 * What remains is what the shell genuinely owns: the sidebar trigger and the
 * identity of the person acting.
 */

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppHeader() {
  const session = useSession();
  const user = session?.user;

  return (
    <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-2 h-4" />

      <div className="ml-auto flex items-center gap-3">
        {user ? (
          <>
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-muted-foreground text-xs">{user.email}</div>
            </div>
            <Avatar className="size-8">
              <AvatarFallback>{initialsOf(user.name)}</AvatarFallback>
            </Avatar>
          </>
        ) : null}
      </div>
    </header>
  );
}
