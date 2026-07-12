import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { usePermission } from "@/shared/hooks";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/shared/components/ui/sidebar";
import { NAV_TREE, filterNav } from "@/app/navigation/nav";

/**
 * Domain navigation (Architecture §3).
 *
 * Renders whatever survives the permission filter — nothing more, and nothing
 * hardcoded. A group with no permitted items does not render its heading.
 *
 * Active state is derived from the URL via NavLink, not held in component state:
 * "which nav item is active" is a fact about the location, and storing it would
 * create a second source of truth that can disagree with the address bar.
 *
 * In M1-B the tree is empty (no domains exist), so no groups render. That is the
 * honest result, not a bug — see nav.ts.
 */
export function AppSidebar() {
  const permissions = usePermission();

  const groups = useMemo(() => filterNav(NAV_TREE, permissions), [permissions]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="truncate font-semibold">Miza</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* The vendored Sidebar primitive renders a plain div, so it contributes no
            landmark. Site navigation must be a landmark (Design System §1's
            accessibility floor), so the nav element is declared here — in authored
            code — rather than by hand-editing the generated primitive (FTA §12). */}
        <nav aria-label="Navigation principale">
          {groups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <NavLink to={item.to}>
                        {({ isActive }) => (
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={item.label}
                          >
                            <span>
                              {item.icon ? <item.icon aria-hidden /> : null}
                              <span>{item.label}</span>
                            </span>
                          </SidebarMenuButton>
                        )}
                      </NavLink>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
