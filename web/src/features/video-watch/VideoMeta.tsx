import { useState } from "react";
import { ChevronDown, ChevronUp, Heart } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthModal } from "@/features/auth/AuthModal";
import { formatDate, getAvatarInitial } from "@/lib/format";
import { toggleSubmissionLike } from "@/lib/mock-api";
import type { PublicSubmission } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VideoMetaProps {
  video: PublicSubmission;
  onLikeUpdated: (liked: boolean, likeCount: number) => void;
}

export function VideoMeta({ video, onLikeUpdated }: VideoMetaProps) {
  const { isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();

  const [togglingLike, setTogglingLike] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const highestQuality =
    video.qualities.length > 0 ? Math.max(...video.qualities) : null;

  const trimmedDescription = video.description.trim();
  const isLongDescription =
    trimmedDescription.length > 130 ||
    trimmedDescription.split("\n").length > 3;

  const handleToggleLike = async () => {
    if (!isAuthenticated) {
      toast.info("请登录后点赞");
      openAuthModal("login");
      return;
    }
    if (togglingLike) return;

    setTogglingLike(true);
    try {
      const res = await toggleSubmissionLike(video.id, !video.liked_by_me);
      onLikeUpdated(res.liked, res.like_count);
    } catch {
      toast.error("操作失败，请稍后重试");
    } finally {
      setTogglingLike(false);
    }
  };

  return (
    <section className="mt-5 space-y-4">
      {/* 标题 */}
      <h1 className="text-xl font-semibold tracking-tight leading-snug text-foreground line-clamp-2">
        {video.title}
      </h1>

      {/* 作者元信息 + 黑白反色点赞按钮 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5 text-sm">
          <span
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary border border-border text-xs font-medium text-foreground"
            aria-hidden="true"
          >
            {getAvatarInitial(video.author.username)}
          </span>
          <span className="font-medium text-foreground">
            {video.author.username}
          </span>
          <span className="text-muted-foreground" aria-hidden="true">
            ·
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            发布于 {formatDate(video.published_at)}
          </span>
          {highestQuality && (
            <>
              <span className="text-muted-foreground" aria-hidden="true">
                ·
              </span>
              <Badge
                variant="secondary"
                className="font-normal text-xs tabular-nums border border-border"
              >
                {highestQuality}p
              </Badge>
            </>
          )}
        </div>

        {/* 黑白反色点赞按钮 */}
        <Button
          type="button"
          variant={video.liked_by_me ? "default" : "outline"}
          size="sm"
          disabled={togglingLike}
          onClick={() => void handleToggleLike()}
          className={cn(
            "h-9 gap-2 rounded-full px-4 transition-colors",
            video.liked_by_me &&
              "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          <Heart
            className={cn(
              "size-4 transition-transform",
              video.liked_by_me && "fill-current scale-105",
            )}
          />
          <span>{video.liked_by_me ? "已点赞" : "点赞"}</span>
          <span className="tabular-nums">{video.like_count}</span>
        </Button>
      </div>

      {/* 可折叠纯文本简介（有内容时才展示，whitespace-pre-wrap 防 XSS） */}
      {trimmedDescription.length > 0 && (
        <div className="rounded-xl bg-secondary/50 border border-border/60 p-4">
          <p
            className={cn(
              "text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words",
              !descExpanded && isLongDescription && "line-clamp-3",
            )}
          >
            {trimmedDescription}
          </p>

          {isLongDescription && (
            <button
              type="button"
              onClick={() => setDescExpanded((prev) => !prev)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {descExpanded ? (
                <>
                  <span>收起</span>
                  <ChevronUp className="size-3.5" />
                </>
              ) : (
                <>
                  <span>展开</span>
                  <ChevronDown className="size-3.5" />
                </>
              )}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
