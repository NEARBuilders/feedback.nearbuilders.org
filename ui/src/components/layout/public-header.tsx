import { Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components";
import { getActiveItem, getPublicNavItems } from "./nav-items";
import { UserNav } from "./user-nav";

interface PublicHeaderProps {
  showConnect?: boolean;
}

function PublicNavLinks({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = getPublicNavItems();
  const active = getActiveItem(items, pathname);

  return (
    <nav aria-label="Public pages" className={className} data-testid="public-nav">
      {items.map((item) => {
        const slug = item.label.toLowerCase().replace(/\s+/g, "-");
        const isActive = item === active;
        return (
          <Link
            key={item.to}
            to={item.to}
            preload="intent"
            onClick={onNavigate}
            data-testid={`public-nav-${slug}`}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "text-sm font-medium text-foreground"
                : "text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PublicHeader({ showConnect = true }: PublicHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="shrink-0">
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
        <Link
          to="/"
          preload="intent"
          className="shrink-0 text-sm font-semibold text-foreground"
          data-testid="public-nav-home"
        >
          Feedback Rounds
        </Link>
        <PublicNavLinks className="hidden min-w-0 flex-1 items-center gap-4 md:flex" />
        <div className="ml-auto flex items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="md:hidden"
                aria-label="Open menu"
                data-testid="public-nav-menu"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Feedback Rounds</SheetTitle>
              </SheetHeader>
              <PublicNavLinks
                className="flex flex-col gap-3 px-5 py-3"
                onNavigate={() => setOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <UserNav showConnect={showConnect} />
        </div>
      </div>
    </header>
  );
}
