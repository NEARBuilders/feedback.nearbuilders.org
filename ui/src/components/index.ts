import { federated } from "@/lib/federated-components";
import {
  Avatar as LocalAvatar,
  AvatarFallback as LocalAvatarFallback,
  AvatarImage as LocalAvatarImage,
} from "./ui/avatar";
import { Badge as LocalBadge } from "./ui/badge";
import {
  Breadcrumb as LocalBreadcrumb,
  BreadcrumbEllipsis as LocalBreadcrumbEllipsis,
  BreadcrumbItem as LocalBreadcrumbItem,
  BreadcrumbLink as LocalBreadcrumbLink,
  BreadcrumbList as LocalBreadcrumbList,
  BreadcrumbPage as LocalBreadcrumbPage,
  BreadcrumbSeparator as LocalBreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Button as LocalButton } from "./ui/button";
import {
  Card as LocalCard,
  CardAction as LocalCardAction,
  CardContent as LocalCardContent,
  CardDescription as LocalCardDescription,
  CardFooter as LocalCardFooter,
  CardHeader as LocalCardHeader,
  CardTitle as LocalCardTitle,
} from "./ui/card";
import {
  Dialog as LocalDialog,
  DialogClose as LocalDialogClose,
  DialogContent as LocalDialogContent,
  DialogDescription as LocalDialogDescription,
  DialogFooter as LocalDialogFooter,
  DialogHeader as LocalDialogHeader,
  DialogOverlay as LocalDialogOverlay,
  DialogPortal as LocalDialogPortal,
  DialogTitle as LocalDialogTitle,
  DialogTrigger as LocalDialogTrigger,
} from "./ui/dialog";
import {
  Field as LocalField,
  FieldDescription as LocalFieldDescription,
  FieldError as LocalFieldError,
  FieldLabel as LocalFieldLabel,
} from "./ui/field";
import { InfoRow as LocalInfoRow } from "./ui/info-row";
import { Input as LocalInput } from "./ui/input";
import { Label as LocalLabel } from "./ui/label";
import { ScrollArea as LocalScrollArea, ScrollBar as LocalScrollBar } from "./ui/scroll-area";
import { Skeleton as LocalSkeleton } from "./ui/skeleton";
import {
  Tabs as LocalTabs,
  TabsContent as LocalTabsContent,
  TabsList as LocalTabsList,
  TabsTrigger as LocalTabsTrigger,
} from "./ui/tabs";
import { Textarea as LocalTextarea } from "./ui/textarea";

export {
  ApiKeyForm,
  type ApiKeyFormValues,
  ApiKeyReveal,
  type ApiKeyRevealProps,
} from "./api-key-manager";
export { ConfirmDialog } from "./confirm-dialog";
export { EmptyState } from "./empty-state";
export { AppHeader } from "./layout/app-header";
export { AppShell } from "./layout/app-shell";
export { AppSidebar } from "./layout/app-sidebar";
export { Chip } from "./layout/chip";
export {
  filterSidebarByRole,
  getActiveItem,
  getUserRole,
  groupSidebarItems,
  NAV_ITEMS,
  type SidebarItem,
  type SidebarRole,
  type SidebarSection,
} from "./layout/nav-items";
export { NearBranding } from "./layout/near-branding";
export { NetworkToggle } from "./layout/network-toggle";
export { OrgSwitcher } from "./layout/org-switcher";
export { PageContainer } from "./layout/page-container";
export { PageHeader } from "./layout/page-header";
export { PublicHeader } from "./layout/public-header";
export { PublicShell, PublicShellFooter } from "./layout/public-shell";
export { SectionHeader } from "./layout/section-header";
export { SidebarOrgSwitcher } from "./layout/sidebar-org-switcher";
export { SidebarUserNav } from "./layout/sidebar-user-nav";
export { ThemeToggle } from "./layout/theme-toggle";
export { UserNav } from "./layout/user-nav";
export { MyProjects } from "./my-projects";
export { SegmentedToggle } from "./segmented-toggle";
export { UnderConstruction } from "./under-construction";

// Generic design-system primitives (#56): each wrapped in federated() so it renders
// nearbuilders.org's version once the components remote resolves, falling back to the local
// one otherwise. Most of these aren't on the remote yet (nearbuilders.org#259 is still
// completing the barrel) — federated() handles that transparently, so nothing here needs to
// change as the remote catches up. Layout and app-specific components above stay local only,
// per this ticket's scope.
export const Avatar = federated("Avatar", LocalAvatar);
export const AvatarFallback = federated("AvatarFallback", LocalAvatarFallback);
export const AvatarImage = federated("AvatarImage", LocalAvatarImage);
export const Badge = federated("Badge", LocalBadge);
export const Breadcrumb = federated("Breadcrumb", LocalBreadcrumb);
export const BreadcrumbEllipsis = federated("BreadcrumbEllipsis", LocalBreadcrumbEllipsis);
export const BreadcrumbItem = federated("BreadcrumbItem", LocalBreadcrumbItem);
export const BreadcrumbLink = federated("BreadcrumbLink", LocalBreadcrumbLink);
export const BreadcrumbList = federated("BreadcrumbList", LocalBreadcrumbList);
export const BreadcrumbPage = federated("BreadcrumbPage", LocalBreadcrumbPage);
export const BreadcrumbSeparator = federated("BreadcrumbSeparator", LocalBreadcrumbSeparator);
export const Button = federated("Button", LocalButton);
export const Card = federated("Card", LocalCard);
export const CardAction = federated("CardAction", LocalCardAction);
export const CardContent = federated("CardContent", LocalCardContent);
export const CardDescription = federated("CardDescription", LocalCardDescription);
export const CardFooter = federated("CardFooter", LocalCardFooter);
export const CardHeader = federated("CardHeader", LocalCardHeader);
export const CardTitle = federated("CardTitle", LocalCardTitle);
export const Dialog = federated("Dialog", LocalDialog);
export const DialogClose = federated("DialogClose", LocalDialogClose);
export const DialogContent = federated("DialogContent", LocalDialogContent);
export const DialogDescription = federated("DialogDescription", LocalDialogDescription);
export const DialogFooter = federated("DialogFooter", LocalDialogFooter);
export const DialogHeader = federated("DialogHeader", LocalDialogHeader);
export const DialogOverlay = federated("DialogOverlay", LocalDialogOverlay);
export const DialogPortal = federated("DialogPortal", LocalDialogPortal);
export const DialogTitle = federated("DialogTitle", LocalDialogTitle);
export const DialogTrigger = federated("DialogTrigger", LocalDialogTrigger);
export const Field = federated("Field", LocalField);
export const FieldDescription = federated("FieldDescription", LocalFieldDescription);
export const FieldError = federated("FieldError", LocalFieldError);
export const FieldLabel = federated("FieldLabel", LocalFieldLabel);
export const InfoRow = federated("InfoRow", LocalInfoRow);
export const Input = federated("Input", LocalInput);
export const Label = federated("Label", LocalLabel);
export const ScrollArea = federated("ScrollArea", LocalScrollArea);
export const ScrollBar = federated("ScrollBar", LocalScrollBar);
export const Skeleton = federated("Skeleton", LocalSkeleton);
export const Tabs = federated("Tabs", LocalTabs);
export const TabsContent = federated("TabsContent", LocalTabsContent);
export const TabsList = federated("TabsList", LocalTabsList);
export const TabsTrigger = federated("TabsTrigger", LocalTabsTrigger);
export const Textarea = federated("Textarea", LocalTextarea);

export { buttonVariants } from "./ui/button";
// Primitives with no federated counterpart yet (or that carry shared context/hooks, like the
// sidebar family, and can't be swapped piecemeal): re-exported straight from local so every
// consumer still imports from this barrel only (#57). Move them into federated() as the
// remote's barrel (nearbuilders.org#259) gains them.
export * from "./ui/checkbox";
export * from "./ui/dropdown-menu";
export * from "./ui/markdown";
export * from "./ui/separator";
export * from "./ui/sheet";
export * from "./ui/sidebar";
export * from "./ui/sonner";
export * from "./ui/spinner";
export * from "./ui/toggle-group";
export * from "./ui/tooltip";
