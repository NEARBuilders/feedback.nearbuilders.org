import { Link } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components";
import type { SidebarItem, SidebarSection } from "./nav-items";
import { SidebarOrgSwitcher } from "./sidebar-org-switcher";
import { SidebarUserNav } from "./sidebar-user-nav";
import { useIdentity } from "./use-identity";

interface AppSidebarProps {
  sections: SidebarSection[];
  appName: string;
  isActive: (item: SidebarItem) => boolean;
}

export function AppSidebar({ sections, appName, isActive }: AppSidebarProps) {
  const { organizations, activeOrgId } = useIdentity();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarOrgSwitcher
          appName={appName}
          organizations={organizations}
          activeOrgId={activeOrgId}
        />
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.id} data-testid={`sidebar-section-${section.id}`}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarMenu>
              {section.items.map((item) => {
                const Icon = item.icon;
                const slug = item.label.toLowerCase().replace(/\s+/g, "-");
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.label}>
                      <Link to={item.to} preload="intent" data-testid={`sidebar-nav-${slug}`}>
                        <Icon />
                        <span className="capitalize">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarUserNav />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
