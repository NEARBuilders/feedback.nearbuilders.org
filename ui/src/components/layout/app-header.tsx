import { Link, useRouterState } from "@tanstack/react-router";
import { Fragment } from "react";
import type { ClientRuntimeConfig } from "@/app";
import { getAccount, getActiveRuntime } from "@/app";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Separator,
  SidebarTrigger,
} from "@/components";
import { getBreadcrumbs } from "@/lib/breadcrumbs";
import { useIdentity } from "./use-identity";

interface AppHeaderProps {
  runtimeConfig?: Partial<ClientRuntimeConfig>;
}

export function AppHeader({ runtimeConfig }: AppHeaderProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { organizations } = useIdentity();
  const runtime = getActiveRuntime(runtimeConfig);
  const account = getAccount(runtimeConfig);
  const crumbs = getBreadcrumbs(pathname, {
    orgName: (slug) => organizations.find((org) => org.slug === slug)?.name,
  });

  return (
    <header className="shrink-0 bg-card/50 border-b border-border transition-all duration-200 overflow-hidden h-12 sticky top-0 z-10">
      <div className="flex items-center gap-2 px-4 sm:px-6 h-12 min-w-0">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />

        <Breadcrumb className="hidden sm:block min-w-0">
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem>
              {crumbs.length === 0 ? (
                <span>{runtime?.accountId ?? account}</span>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to="/dashboard">{runtime?.accountId ?? account}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {crumbs.length === 0 ? (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>home</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : (
              crumbs.map((crumb, index) => {
                const isLast = index === crumbs.length - 1;
                return (
                  <Fragment key={crumb.href}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link to={crumb.href}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                );
              })
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
