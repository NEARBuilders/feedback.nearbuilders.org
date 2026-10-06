import { type ErrorComponentProps, Link, useRouter } from "@tanstack/react-router";
import { AlertTriangle, SearchX } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/components";
import { PageContainer } from "@/components/layout/page-container";

export function RoutePending() {
  return (
    <PageContainer>
      <div className="space-y-3" data-testid="route-pending">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </PageContainer>
  );
}

export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <PageContainer>
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong."
        description={error.message}
        className="min-h-[30vh]"
        action={
          <Button variant="outline" size="sm" onClick={() => void router.invalidate()}>
            Try again
          </Button>
        }
      />
    </PageContainer>
  );
}

export function RouteNotFound({ title, backTo }: { title: string; backTo: string }) {
  return (
    <PageContainer>
      <EmptyState
        icon={SearchX}
        title={title}
        className="min-h-[30vh]"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={backTo}>Go back</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
