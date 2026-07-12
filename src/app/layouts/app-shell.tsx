import { Outlet } from "react-router-dom";
import { config } from "@/infrastructure/config";
import { SidebarInset, SidebarProvider } from "@/shared/components/ui/sidebar";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { RouteProgress } from "./route-progress";

/**
 * The application shell — the frame every authenticated page renders inside
 * (Architecture §4, Design System §2).
 *
 * ONLY THE CONTENT REGION SCROLLS. The sidebar and header stay reachable at any
 * scroll depth, which is what makes a long table navigable without scrolling back
 * to the top to reach the nav.
 *
 * THE CONTENT REGION LIVES HERE, not in a shared `PageContainer`, and that is a
 * deliberate call (FTA D-11): zero pages exist, so a shared container would be an
 * abstraction fitted to an imagined caller. Pages render into the Outlet and
 * inherit these spatial rules for free — no import, and no boundary problem
 * (a page in domains/ could not import from app/ anyway).
 *
 * Spatial rules from Design System §2:
 *   - fluid up to ~1440px, then centred
 *   - horizontal padding steps with the width class
 *   - generous bottom padding so the last table row never sits on the viewport edge
 */
export function AppShell() {
  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset>
        <RouteProgress />
        <AppHeader />

        {/* Staging must be visibly marked (Design System §20). The flag is a
            declared capability from the validated config — never a check against
            an environment name (FTA §14). */}
        {config.features.environmentBanner ? (
          <div className="bg-muted text-muted-foreground border-b px-4 py-1 text-center text-xs">
            {config.environment}
          </div>
        ) : null}

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-6 pt-6 pb-16 md:px-8 lg:px-12">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
