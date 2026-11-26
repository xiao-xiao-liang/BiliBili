import { Skeleton } from "@/components/ui/skeleton";

export function VideoCardSkeleton() {
  return (
    <div className="block" aria-hidden="true">
      {/* 与 VideoCard 严格等比例的 16:9 封面骨架 */}
      <Skeleton className="aspect-video w-full rounded-xl" />

      <div className="mt-2.5 flex items-start gap-2.5">
        <Skeleton className="mt-0.5 size-7 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <div className="space-y-1.5 pt-0.5">
            <Skeleton className="h-3 w-1/3 rounded-md" />
            <Skeleton className="h-3 w-1/2 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
