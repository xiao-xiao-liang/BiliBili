import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  Loader2,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBytes, formatDate, formatDuration } from "@/lib/format";
import type { OwnerSubmission } from "@/lib/types";
import { QualityChips } from "./QualityChips";
import { StatusBadge } from "./StatusBadge";

interface SubmissionRowProps {
  submission: OwnerSubmission;
  retrying?: boolean;
  onRetry: (submission: OwnerSubmission) => void;
  onEdit: (submission: OwnerSubmission) => void;
  onDelete: (submission: OwnerSubmission) => void;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getProcessingStageText(
  stage: string | null,
  currentQuality: number | null,
): string {
  if (stage === "probing") return "正在校验媒体流";
  if (stage === "packaging") return "正在封装 HLS 清单并截取封面";
  if (currentQuality) return `正在转码 ${currentQuality}p`;
  return "正在后台处理中";
}

export function SubmissionRow({
  submission,
  retrying = false,
  onRetry,
  onEdit,
  onDelete,
}: SubmissionRowProps) {
  const { state, upload, processing, error } = submission;

  const uploadPercent =
    upload && upload.expected_size > 0
      ? Math.min(
          100,
          Math.round((upload.confirmed_bytes / upload.expected_size) * 100),
        )
      : 0;

  const canEdit = state !== "expired";
  const canRetry = state === "failed" && Boolean(processing?.can_retry);

  // 左侧 16:9 缩略图 / 状态占位框
  const thumbnail =
    state === "published" && submission.cover_url ? (
      <Link
        to={`/videos/${submission.id}`}
        className="group relative block w-full sm:w-44 aspect-video shrink-0 overflow-hidden rounded-lg bg-secondary border border-border/80 dark:border-white/12"
      >
        <img
          src={submission.cover_url}
          alt={submission.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {submission.duration_ms !== null && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums backdrop-blur-xs">
            {formatDuration(submission.duration_ms)}
          </span>
        )}
      </Link>
    ) : (
      <div className="flex w-full sm:w-44 aspect-video shrink-0 items-center justify-center rounded-lg bg-muted border border-border/70 text-muted-foreground">
        {state === "uploading" && <Upload className="size-6" />}
        {state === "processing" && <Loader2 className="size-6 animate-spin" />}
        {state === "failed" && (
          <AlertTriangle className="size-6 text-destructive/80" />
        )}
        {state === "expired" && (
          <Clock className="size-6 text-muted-foreground/60" />
        )}
      </div>
    );

  return (
    <article className="flex flex-col sm:flex-row sm:items-center gap-5 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20">
      {/* 左侧 16:9 缩略图 */}
      {thumbnail}

      {/* 中间标题、状态微标与动态反馈区 */}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2.5">
          {state === "published" ? (
            <Link
              to={`/videos/${submission.id}`}
              className="truncate text-sm font-medium leading-snug text-foreground hover:underline underline-offset-4"
            >
              {submission.title}
            </Link>
          ) : (
            <h2 className="truncate text-sm font-medium leading-snug text-foreground">
              {submission.title}
            </h2>
          )}
          <StatusBadge state={state} />
        </div>

        {/* 5 种状态对应的动态反馈区 */}
        {state === "uploading" && upload && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="h-1.5 flex-1 max-w-xs overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
              <span className="text-xs font-medium text-foreground tabular-nums">
                {uploadPercent}%
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatBytes(upload.confirmed_bytes)} /{" "}
                {formatBytes(upload.expected_size)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              过期时间 {formatDate(upload.expires_at)}
            </p>
          </div>
        )}

        {state === "processing" && processing && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">
                {getProcessingStageText(
                  processing.stage,
                  processing.current_quality,
                )}
              </span>
              <QualityChips
                targetQualities={processing.target_qualities}
                completedQualities={processing.completed_qualities}
                currentQuality={processing.current_quality}
              />
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              创建于 {formatDateTime(submission.created_at)}
            </p>
          </div>
        )}

        {state === "published" && (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
              {processing && processing.completed_qualities.length > 0 && (
                <>
                  <span>
                    {[...processing.completed_qualities]
                      .sort((a, b) => a - b)
                      .map((q) => `${q}p`)
                      .join(" · ")}
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              {submission.published_at && (
                <span>发布于 {formatDate(submission.published_at)}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              创建于 {formatDateTime(submission.created_at)}
            </p>
          </div>
        )}

        {state === "failed" && (
          <div className="space-y-1">
            <p className="text-xs text-destructive leading-relaxed">
              {error?.message ?? "视频处理失败"}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
              {processing && processing.completed_qualities.length > 0 && (
                <span>
                  已保留{" "}
                  {[...processing.completed_qualities]
                    .sort((a, b) => a - b)
                    .map((q) => `${q}p`)
                    .join(" / ")}{" "}
                  成果
                </span>
              )}
              {processing?.next_retry_at && (
                <>
                  {processing.completed_qualities.length > 0 && (
                    <span aria-hidden="true">·</span>
                  )}
                  <span>
                    预计自动重试 {formatDateTime(processing.next_retry_at)}
                  </span>
                </>
              )}
              <span>· 创建于 {formatDateTime(submission.created_at)}</span>
            </div>
          </div>
        )}

        {state === "expired" && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              上传会话已超过 7 天未活动并过期，无法继续上传或编辑。
            </p>
            <p className="text-xs text-muted-foreground/80 tabular-nums">
              创建于 {formatDateTime(submission.created_at)}
            </p>
          </div>
        )}
      </div>

      {/* 右侧操作区：最多 1 个主按钮 + 低饱和度无边框图标按钮 */}
      <div className="flex items-center justify-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
        {state === "uploading" && (
          <Button asChild size="sm" className="h-8 px-3">
            <Link to={`/upload?submissionId=${submission.id}`}>继续上传</Link>
          </Button>
        )}

        {state === "published" && (
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 px-3">
            <Link to={`/videos/${submission.id}`}>
              <Play className="size-3.5" />
              <span>观看</span>
            </Link>
          </Button>
        )}

        {canRetry && (
          <Button
            type="button"
            size="sm"
            disabled={retrying}
            onClick={() => onRetry(submission)}
            className="h-8 gap-1.5 px-3"
          >
            {retrying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}
            <span>重试处理</span>
          </Button>
        )}

        {canEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                aria-label="编辑资料"
                onClick={() => onEdit(submission)}
              >
                <Pencil className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>编辑资料</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              aria-label="删除投稿"
              onClick={() => onDelete(submission)}
            >
              <Trash2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>删除投稿</TooltipContent>
        </Tooltip>
      </div>
    </article>
  );
}
