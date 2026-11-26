import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Film, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchPublicSubmissions } from "@/lib/mock-api";
import type { PublicSubmission } from "@/lib/types";
import { VideoCard } from "./VideoCard";
import { VideoCardSkeleton } from "./VideoCardSkeleton";

const PAGE_SIZE = 8;

export function HomePage() {
  const [items, setItems] = useState<PublicSubmission[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewSkeleton, setPreviewSkeleton] = useState(false);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPublicSubmissions({ limit: PAGE_SIZE });
      setItems(res.items);
      setNextCursor(res.next_cursor);
    } catch {
      setError("视频列表加载失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchPublicSubmissions({
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });
      setItems((prev) => {
        const seen = new Set(prev.map((v) => v.id));
        const appended = res.items.filter((v) => !seen.has(v.id));
        return [...prev, ...appended];
      });
      setNextCursor(res.next_cursor);
    } catch {
      setError("加载更多失败，请重试。");
    } finally {
      setLoadingMore(false);
    }
  };

  const showSkeleton = loading || previewSkeleton;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* 顶部标题栏 */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight">最新发布</h1>
          {!showSkeleton && items.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              已展示 {items.length} 条
            </span>
          )}
        </div>

        {/* 骨架屏切换演示按钮 */}
        <Button
          type="button"
          variant={previewSkeleton ? "default" : "outline"}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setPreviewSkeleton((prev) => !prev)}
        >
          <Sparkles className="size-3.5" />
          <span>{previewSkeleton ? "退出骨架屏预览" : "骨架屏预览"}</span>
        </Button>
      </div>

      {/* 四态处理：加载态 / 错误态 / 空状态 / 列表态 */}
      {showSkeleton ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-8">
          {Array.from({ length: PAGE_SIZE }).map((_, idx) => (
            <VideoCardSkeleton key={idx} />
          ))}
        </div>
      ) : error && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20 px-6 text-center">
          <AlertCircle className="size-9 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">{error}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            请检查网络连接后重新尝试加载。
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5"
            onClick={() => void loadInitial()}
          >
            <RefreshCw className="size-3.5" />
            <span>重试</span>
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20 px-6 text-center">
          <Film className="size-9 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">暂无已发布视频</p>
          <p className="mt-1 text-xs text-muted-foreground">
            成为第一个发布作品的创作者吧。
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-8">
            {items.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>

          {/* 游标分页：加载更多 */}
          <div className="mt-10 flex flex-col items-center gap-2">
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            {nextCursor ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleLoadMore()}
                disabled={loadingMore}
                className="min-w-36"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    <span>加载中...</span>
                  </>
                ) : (
                  <span>加载更多</span>
                )}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">已展示全部已发布视频</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
