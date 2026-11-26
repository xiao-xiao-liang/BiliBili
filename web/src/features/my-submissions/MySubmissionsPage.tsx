import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Film,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { generateIdempotencyKey } from "@/lib/format";
import type { OwnerSubmission, SubmissionState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DeleteSubmissionDialog } from "./DeleteSubmissionDialog";
import { EditSubmissionDialog } from "./EditSubmissionDialog";
import {
  mockFetchMySubmissions,
  mockRetrySubmission,
  resetMockOwnerSubmissions,
} from "./mock-submissions-api";
import { SubmissionRow } from "./SubmissionRow";

type FilterState = "all" | SubmissionState;

const FILTER_TABS: { value: FilterState; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "uploading", label: "上传中" },
  { value: "processing", label: "处理中" },
  { value: "published", label: "已发布" },
  { value: "failed", label: "处理失败" },
  { value: "expired", label: "已过期" },
];

const PAGE_SIZE = 6;

function SubmissionRowSkeleton() {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-5 rounded-xl border border-border bg-card p-4"
      aria-hidden="true"
    >
      <Skeleton className="w-full sm:w-44 aspect-video shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-4 w-56 rounded" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3.5 w-72 rounded" />
        <Skeleton className="h-3 w-36 rounded" />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
      </div>
    </div>
  );
}

export function MySubmissionsPage() {
  const { isAuthenticated } = useAuth();

  const [filter, setFilter] = useState<FilterState>("all");
  const [items, setItems] = useState<OwnerSubmission[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [retryingIds, setRetryingIds] = useState<Record<string, boolean>>({});
  const [editingSubmission, setEditingSubmission] =
    useState<OwnerSubmission | null>(null);
  const [deletingSubmission, setDeletingSubmission] =
    useState<OwnerSubmission | null>(null);

  const retryKeysRef = useRef<Record<string, string>>({});

  const loadList = useCallback(
    async (targetFilter: FilterState) => {
      setLoading(true);
      setError(null);
      try {
        const res = await mockFetchMySubmissions({
          state: targetFilter,
          limit: PAGE_SIZE,
        });
        setItems(res.items);
        setNextCursor(res.next_cursor);
      } catch {
        setError("投稿列表加载失败，请稍后重试。");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadList(filter);
  }, [isAuthenticated, filter, loadList]);

  // 存在 uploading 或 processing 条目时启动可见性感知轮询（可见 2s / 隐藏 10s）
  const hasActiveTasks = items.some(
    (item) => item.state === "uploading" || item.state === "processing",
  );

  useEffect(() => {
    if (!isAuthenticated || !hasActiveTasks) return;

    let timerId: number | null = null;
    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled) return;
      const intervalMs = document.hidden ? 10000 : 2000;
      timerId = window.setTimeout(async () => {
        if (cancelled) return;
        try {
          const res = await mockFetchMySubmissions({
            state: filter,
            limit: Math.max(PAGE_SIZE, items.length),
            isPoll: true,
          });
          if (!cancelled) {
            setItems(res.items);
            setNextCursor(res.next_cursor);
          }
        } catch {
          // 轮询瞬时失败不打断用户浏览
        }
        scheduleNext();
      }, intervalMs);
    };

    const handleVisibilityChange = () => {
      if (timerId !== null) window.clearTimeout(timerId);
      scheduleNext();
    };

    scheduleNext();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, hasActiveTasks, filter, items.length]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await mockFetchMySubmissions({
        state: filter,
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...res.items.filter((x) => !seen.has(x.id))];
      });
      setNextCursor(res.next_cursor);
    } catch {
      toast.error("加载更多失败，请重试");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRetry = async (target: OwnerSubmission) => {
    if (retryingIds[target.id]) return;
    setRetryingIds((prev) => ({ ...prev, [target.id]: true }));
    if (!retryKeysRef.current[target.id]) {
      retryKeysRef.current[target.id] = generateIdempotencyKey();
    }
    try {
      const updated = await mockRetrySubmission(
        target.id,
        retryKeysRef.current[target.id],
      );
      delete retryKeysRef.current[target.id];
      setItems((prev) => {
        if (filter === "failed") {
          return prev.filter((item) => item.id !== updated.id);
        }
        return prev.map((item) => (item.id === updated.id ? updated : item));
      });
      toast.success("已重新加入转码队列，保留已完成清晰度");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "重试失败，请稍后再试");
    } finally {
      setRetryingIds((prev) => ({ ...prev, [target.id]: false }));
    }
  };

  const handleResetDemo = () => {
    resetMockOwnerSubmissions();
    setFilter("all");
    void loadList("all");
    toast.info("已重置我的投稿 Mock 演示数据");
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-10 text-center">
          <Film className="mx-auto size-9 text-muted-foreground mb-3" />
          <h1 className="text-base font-semibold">请登录后查看「我的投稿」</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            未发布与处理中的投稿仅作者本人可见。
          </p>
          <Button asChild size="sm" className="mt-5">
            <Link to="/login?redirect=/me/submissions">前往登录</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="max-w-7xl mx-auto px-6 py-8 pb-16">
        {/* 页头：标题 + 自动刷新脉冲指示 + 新建投稿主按钮 */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">我的投稿</h1>
            {hasActiveTasks && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/70 px-2.5 py-0.5 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>自动刷新中</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetDemo}
              className="h-8 gap-1.5 rounded-full border border-dashed border-border px-2.5 text-xs text-muted-foreground hover:text-foreground"
              title="恢复初始 5 种状态 Mock 数据以重新体验轮询与重试"
            >
              <RotateCcw className="size-3" />
              <span>重置演示数据</span>
            </Button>
            <Button asChild size="sm" className="h-8 gap-1.5 px-3">
              <Link to="/upload">
                <Plus className="size-4" />
                <span>新建投稿</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* 6 个状态筛选 Tabs */}
        <div
          role="tablist"
          aria-label="投稿状态筛选"
          className="flex items-center gap-1 overflow-x-auto pb-2"
        >
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  if (tab.value !== filter) {
                    setFilter(tab.value);
                  }
                }}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <Separator className="mb-6" />

        {/* 列表四态：加载骨架屏 / 错误态 / 双空状态 / 卡片列表 */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <SubmissionRowSkeleton key={idx} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 px-6 text-center">
            <AlertCircle className="size-9 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadList(filter)}
              className="mt-4 gap-1.5"
            >
              <RefreshCw className="size-3.5" />
              <span>重试</span>
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 px-6 text-center">
            <Film className="size-9 text-muted-foreground mb-3" />
            {filter === "all" ? (
              <>
                <p className="text-sm font-medium text-foreground">
                  还没有投稿过视频
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  上传你的第一个 MP4 视频，后台将自动完成多清晰度转码与发布。
                </p>
                <Button asChild size="sm" className="mt-5 gap-1.5">
                  <Link to="/upload">
                    <Plus className="size-4" />
                    <span>去投稿</span>
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  当前筛选下暂无投稿
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  可以切换到其他状态或查看全部投稿记录。
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFilter("all")}
                  className="mt-5"
                >
                  查看全部
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {items.map((item) => (
                <SubmissionRow
                  key={item.id}
                  submission={item}
                  retrying={Boolean(retryingIds[item.id])}
                  onRetry={(sub) => void handleRetry(sub)}
                  onEdit={setEditingSubmission}
                  onDelete={setDeletingSubmission}
                />
              ))}
            </div>

            {/* 底部游标分页 */}
            <div className="mt-8 flex justify-center">
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
                <p className="text-xs text-muted-foreground">
                  已展示全部符合条件的投稿
                </p>
              )}
            </div>
          </>
        )}

        {/* 编辑资料弹窗（S03 + S04 + 412 冲突处理） */}
        <EditSubmissionDialog
          submission={editingSubmission}
          onClose={() => setEditingSubmission(null)}
          onSaved={(updated) =>
            setItems((prev) =>
              prev.map((item) => (item.id === updated.id ? updated : item)),
            )
          }
        />

        {/* 删除二次确认弹窗（S05） */}
        <DeleteSubmissionDialog
          submission={deletingSubmission}
          onClose={() => setDeletingSubmission(null)}
          onDeleted={(deletedId) =>
            setItems((prev) => prev.filter((item) => item.id !== deletedId))
          }
        />
      </div>
    </TooltipProvider>
  );
}
