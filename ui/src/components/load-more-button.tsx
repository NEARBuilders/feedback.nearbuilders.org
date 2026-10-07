import { Button } from "@/components";

interface LoadMoreButtonProps {
  query: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown };
}

export function LoadMoreButton({ query }: LoadMoreButtonProps) {
  if (!query.hasNextPage) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void query.fetchNextPage()}
      disabled={query.isFetchingNextPage}
    >
      {query.isFetchingNextPage ? "loading..." : "load more"}
    </Button>
  );
}
