import { useSession } from "@/shared/hooks";
import { useLogoutMutation } from "@/domains/auth";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
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
 *   - NO global search. Design System §15 scopes search per-resource and warns
 *     that invisible global scope is a correctness hazard on financial data.
 *
 * Logout lives behind the identity menu (M1-C). It calls the backend revocation
 * endpoint and terminates the local session on settle; it does NOT navigate —
 * wireSessionTermination (app/bootstrap/wire-session.ts) is the application's
 * single navigation authority for session end, the same path a 401 already
 * uses. See domains/auth/queries/mutations.ts.
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
  const logoutMutation = useLogoutMutation();

  return (
    <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-2 h-4" />

      <div className="ml-auto flex items-center gap-3">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-3 rounded-md outline-none">
              <div className="hidden text-right leading-tight sm:block">
                <div className="text-sm font-medium">{user.name}</div>
                <div className="text-muted-foreground text-xs">{user.email}</div>
              </div>
              <Avatar className="size-8">
                <AvatarFallback>{initialsOf(user.name)}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                disabled={logoutMutation.isPending}
                onSelect={() => logoutMutation.mutate()}
              >
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}
