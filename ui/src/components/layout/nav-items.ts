import {
  BookOpen,
  Building2,
  ClipboardCheck,
  FolderKanban,
  Home,
  LayoutDashboard,
  MessageSquare,
  PlusCircle,
  Shield,
  Trophy,
} from "lucide-react";

export type SidebarRole = "anon" | "member" | "admin";
export type SidebarSectionId = "main" | "workspace" | "manage";

export interface SidebarItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  to: string;
  section: SidebarSectionId;
  roleRequired: SidebarRole;
  /** Path prefixes that highlight this item. Defaults to `[to]`. */
  activePrefixes?: string[];
}

export interface SidebarSection {
  id: SidebarSectionId;
  label: string;
  items: SidebarItem[];
}

export const SIDEBAR_SECTIONS: { id: SidebarSectionId; label: string }[] = [
  { id: "main", label: "main" },
  { id: "workspace", label: "workspace" },
  { id: "manage", label: "manage" },
];

export const NAV_ITEMS: SidebarItem[] = [
  { icon: Home, label: "dashboard", to: "/dashboard", section: "main", roleRequired: "member" },
  { icon: MessageSquare, label: "rounds", to: "/rounds", section: "main", roleRequired: "anon" },
  {
    icon: FolderKanban,
    label: "projects",
    to: "/projects",
    section: "main",
    roleRequired: "anon",
  },
  {
    icon: Trophy,
    label: "leaderboard",
    to: "/leaderboard",
    section: "main",
    roleRequired: "anon",
  },
  {
    icon: BookOpen,
    label: "how it works",
    to: "/how-to-integrate",
    section: "main",
    roleRequired: "anon",
  },
  {
    icon: ClipboardCheck,
    label: "testing",
    to: "/testing",
    section: "workspace",
    roleRequired: "member",
  },
  {
    icon: PlusCircle,
    label: "request a round",
    to: "/manage/new",
    section: "workspace",
    roleRequired: "member",
  },
  {
    icon: LayoutDashboard,
    label: "manage",
    to: "/manage",
    section: "workspace",
    roleRequired: "member",
  },
  { icon: Building2, label: "orgs", to: "/orgs", section: "workspace", roleRequired: "member" },
  { icon: Shield, label: "admin", to: "/admin", section: "manage", roleRequired: "admin" },
];

export function getUserRole(isAuthenticated: boolean, isAdmin: boolean): SidebarRole {
  if (isAdmin) return "admin";
  if (isAuthenticated) return "member";
  return "anon";
}

export function filterSidebarByRole(items: SidebarItem[], userRole: SidebarRole): SidebarItem[] {
  return items.filter((item) => {
    if (item.roleRequired === "anon") return true;
    if (item.roleRequired === "member" && userRole !== "anon") return true;
    if (item.roleRequired === "admin" && userRole === "admin") return true;
    return false;
  });
}

export function groupSidebarItems(items: SidebarItem[]): SidebarSection[] {
  return SIDEBAR_SECTIONS.map((section) => ({
    ...section,
    items: items.filter((item) => item.section === section.id),
  })).filter((section) => section.items.length > 0);
}

function matchLength(pathname: string, prefix: string): number {
  return pathname === prefix || pathname.startsWith(`${prefix}/`) ? prefix.length : -1;
}

/** The item whose prefix matches `pathname` most specifically. */
export function getActiveItem(items: SidebarItem[], pathname: string): SidebarItem | undefined {
  let best: SidebarItem | undefined;
  let bestLength = -1;
  for (const item of items) {
    for (const prefix of item.activePrefixes ?? [item.to]) {
      const length = matchLength(pathname, prefix);
      if (length > bestLength) {
        best = item;
        bestLength = length;
      }
    }
  }
  return best;
}
