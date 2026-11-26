import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Loader2,
  MessageSquare,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers";
import { useAuthModal } from "@/features/auth/AuthModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  formatRelativeTime,
  generateIdempotencyKey,
  getAvatarInitial,
} from "@/lib/format";
import {
  createComment,
  deleteComment,
  fetchComments,
} from "@/lib/mock-api";
import type { Comment } from "@/lib/types";

interface CommentSectionProps {
  submissionId: string;
  commentCount: number;
  onCommentCountDelta: (delta: number) => void;
}

const MAX_COMMENT_LENGTH = 1000;
const PAGE_SIZE = 4;

export function CommentSection({
  submissionId,
  commentCount,
  onCommentCountDelta,
}: CommentSectionProps) {
  const { user, isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();

  const [comments, setComments] = useState<Comment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey());

  const [pendingDelete, setPendingDelete] = useState<Comment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchComments(submissionId, user, { limit: PAGE_SIZE });
      setComments(res.items);
      setNextCursor(res.next_cursor);
    } catch {
      setError("评论加载失败，请重试。");
    } finally {
      setLoading(false);
    }
  }, [submissionId, user]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchComments(submissionId, user, {
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });
      setComments((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...res.items.filter((c) => !seen.has(c.id))];
      });
      setNextCursor(res.next_cursor);
    } catch {
      toast.error("加载更多评论失败");
    } finally {
      setLoadingMore(false);
    }
  };

  const trimmedLength = draft.trim().length;
  const canPost =
    isAuthenticated &&
    user !== null &&
    !submitting &&
    trimmedLength >= 1 &&
    trimmedLength <= MAX_COMMENT_LENGTH;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canPost || !user) return;
    setSubmitting(true);
    try {
      const created = await createComment(
        submissionId,
        draft,
        user,
        idempotencyKeyRef.current,
      );
      setComments((prev) => [created, ...prev]);
      onCommentCountDelta(1);
      setDraft("");
      idempotencyKeyRef.current = generateIdempotencyKey();
      toast.success("评论已发表");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "评论发表失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteComment(submissionId, pendingDelete.id);
      setComments((prev) => prev.filter((c) => c.id !== pendingDelete.id));
      onCommentCountDelta(-1);
      setPendingDelete(null);
      toast.success("评论已删除");
    } catch {
      toast.error("删除评论失败，请重试");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="mt-8">
      <Separator className="mb-6" />

      <div className="mb-5 flex items-baseline gap-2">
        <h2 className="text-base font-semibold tracking-tight">评论</h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          ({commentCount})
        </span>
      </div>

      {/* 发表框：已登录显示 Textarea，游客显示登录引导 */}
      {isAuthenticated && user ? (
        <form onSubmit={(e) => void handleSubmit(e)} className="mb-8 space-y-2.5">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
            disabled={submitting}
            placeholder="写下你的想法..."
            rows={3}
            maxLength={MAX_COMMENT_LENGTH}
            className="resize-none bg-card text-sm leading-relaxed"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              纯文本展示，支持换行
            </span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground tabular-nums">
                {draft.length}/{MAX_COMMENT_LENGTH}
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={!canPost}
                className="min-w-20"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    <span>发表中</span>
                  </>
                ) : (
                  <span>发表</span>
                )}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-8 flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/40 px-4 py-3.5">
          <p className="text-sm text-muted-foreground">登录后参与讨论</p>
          <Button type="button" size="sm" onClick={() => openAuthModal("login")}>
            去登录
          </Button>
        </div>
      )}

      {/* 评论列表四态 */}
      {loading ? (
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-32 rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-2/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12 px-6 text-center">
          <AlertCircle className="size-7 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadComments()}
            className="mt-3 gap-1.5"
          >
            <RefreshCw className="size-3.5" />
            <span>重试</span>
          </Button>
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12 px-6 text-center">
          <MessageSquare className="size-7 text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground">还没有评论</p>
          <p className="mt-1 text-xs text-muted-foreground">
            来发表第一条评论吧。
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <ul className="space-y-6">
            {comments.map((comment) => (
              <li key={comment.id} className="flex items-start gap-3">
                <span
                  className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary border border-border text-xs font-medium text-foreground"
                  aria-hidden="true"
                >
                  {getAvatarInitial(comment.author.username)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-foreground">
                        {comment.author.username}
                      </span>
                      <span className="text-muted-foreground" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatRelativeTime(comment.created_at)}
                      </span>
                    </div>

                    {comment.can_delete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDelete(comment)}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="mr-1 size-3.5" />
                        <span>删除</span>
                      </Button>
                    )}
                  </div>

                  {/* 纯文本展示防 XSS */}
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/95 whitespace-pre-wrap break-words">
                    {comment.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {/* 游标分页：加载更多评论 */}
          {nextCursor && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingMore}
                onClick={() => void handleLoadMore()}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    <span>加载中...</span>
                  </>
                ) : (
                  <span>加载更多评论</span>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 删除二次确认弹窗 */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除这条评论？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后该评论将立即从列表中移除且无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
