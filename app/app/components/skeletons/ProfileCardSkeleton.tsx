import { Skeleton } from "~/components/ui/skeleton";

export function ProfileCardSkeleton() {
  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
      <div className="flex items-start gap-4">
        <Skeleton className="h-16 w-16 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-20 mt-3" />
        </div>
      </div>
    </div>
  );
}
