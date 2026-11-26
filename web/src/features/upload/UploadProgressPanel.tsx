import { Link } from "react-router-dom";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { UploadErrorState, UploadStage } from "./useChunkUploader";

interface UploadProgressPanelProps {
  title: string;
  stage: UploadStage;
  hashProgress: number;
  paused: boolean;
  error: UploadErrorState | null;
  confirmedBytes: number;
  expectedSize: number;
  uploadedPartCount: number;
  totalPartCount: number;
  uploadPercent: number;
  submissionId: string | null;
  onPause: () => void;
  onResume: () => void;
  onRetry: () => void;
  onSimulateNetworkError: () => void;
  onUploadAnother: () => void;
}

const STEPS = [
  { key: "hashing", index: 1, label: "计算校验值" },
  { key: "preparing", index: 2, label: "准备上传" },
  { key: "uploading", index: 3, label: "上传中" },
  { key: "processing", index: 4, label: "校验处理中" },
] as const;

function getStepStatus(
  stepIndex: number,
  stage: UploadStage,
): "done" | "current" | "pending" {
  const stageOrder: Record<UploadStage, number> = {
    idle: 0,
    hashing: 1,
    preparing: 2,
    uploading: 3,
    completing: 4,
    processing: 5,
  };
  const current = stageOrder[stage];
  if (current > stepIndex) return "done";
  if (current === stepIndex) return "current";
  return "pending";
}

export function UploadProgressPanel({
  title,
  stage,
  hashProgress,
  paused,
  error,
  confirmedBytes,
  expectedSize,
  uploadedPartCount,
  totalPartCount,
  uploadPercent,
  submissionId,
  onPause,
  onResume,
  onRetry,
  onSimulateNetworkError,
  onUploadAnother,
}: UploadProgressPanelProps) {
  // 阶段 4 确认完成后，切换为交接完成卡片
  if (stage === "processing") {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-secondary border border-border">
          <CheckCircle2 className="size-6 text-foreground" />
        </div>

        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          上传完成，正在后台校验与转码
        </h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          《{title}》已全部完成分片对账。全部目标清晰度转码完成后将自动发布，无需手动上架。
        </p>

        {/* MONO 状态语义微标（§2.2 processing 琥珀色脉冲点） */}
        <div className="mt-4 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground border border-border">
            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>处理中 · 等待转码队列</span>
          </span>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link to="/me/submissions">查看我的投稿</Link>
          </Button>
          <Button type="button" variant="outline" onClick={onUploadAnother}>
            再投一个
          </Button>
        </div>
      </div>
    );
  }

  const displayPercent =
    stage === "hashing"
      ? hashProgress
      : stage === "preparing"
        ? 0
        : stage === "completing"
          ? 100
          : uploadPercent;

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-6">
      {/* 头部：标题 + 文件总大小 */}
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
          《{title}》
        </h2>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {formatBytes(expectedSize)}
        </span>
      </div>

      {/* 四阶段步骤条 */}
      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STEPS.map((step) => {
          const status = getStepStatus(step.index, stage);
          return (
            <li
              key={step.key}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors",
                status === "current"
                  ? "border-foreground bg-secondary/70 font-medium text-foreground"
                  : status === "done"
                    ? "border-border bg-secondary/30 text-foreground"
                    : "border-border/60 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] tabular-nums",
                  status === "done"
                    ? "bg-primary text-primary-foreground"
                    : status === "current"
                      ? "border border-foreground text-foreground"
                      : "border border-border text-muted-foreground",
                )}
              >
                {status === "done" ? (
                  <Check className="size-2.5" />
                ) : (
                  step.index
                )}
              </span>
              <span className="truncate">{step.label}</span>
            </li>
          );
        })}
      </ol>

      {/* 主进度条与当前阶段说明 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium text-foreground">
            {stage === "hashing" && "正在按 8 MiB 分片流式计算 SHA-256 校验值..."}
            {stage === "preparing" && "正在创建投稿并初始化分片上传会话..."}
            {stage === "uploading" &&
              (paused ? "已暂停上传（已对账分片安全保留）" : "上传中 / 可继续")}
            {stage === "completing" && "正在向服务端确认完成上传并校验..."}
          </span>
          <span className="font-semibold text-foreground tabular-nums">
            {displayPercent}%
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${displayPercent}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
          {stage === "uploading" || stage === "completing" ? (
            <span>
              已对账 {formatBytes(confirmedBytes)} / {formatBytes(expectedSize)}{" "}
              · {uploadedPartCount} / {totalPartCount} 分片（3 路并发）
            </span>
          ) : (
            <span>
              {stage === "hashing"
                ? `校验进度 ${hashProgress}%`
                : "等待服务端返回上传会话..."}
            </span>
          )}

          {stage === "completing" && (
            <span className="inline-flex items-center gap-1 text-foreground">
              <Loader2 className="size-3 animate-spin" />
              <span>确认中</span>
            </span>
          )}
        </div>
      </div>

      {/* 错误提示与重试区 */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-3"
        >
          <div className="flex items-start gap-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-medium">{error.message}</p>
              <p className="text-xs text-destructive/80">
                错误码：{error.code}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {error.code === "SESSION_EXPIRED" ? (
              <Button asChild size="sm">
                <Link
                  to={`/login?redirect=${encodeURIComponent(
                    submissionId
                      ? `/upload?submissionId=${submissionId}`
                      : "/upload",
                  )}`}
                >
                  重新登录以继续
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRetry}
                className="gap-1.5"
              >
                <RefreshCw className="size-3.5" />
                <span>重试当前步骤</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 阶段 3 操作按钮：暂停 / 继续 + 模拟网络中断演示 */}
      {stage === "uploading" && !error && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div>
            {paused ? (
              <Button
                type="button"
                size="sm"
                onClick={onResume}
                className="gap-1.5"
              >
                <Play className="size-3.5" />
                <span>继续上传</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onPause}
                className="gap-1.5"
              >
                <Pause className="size-3.5" />
                <span>暂停上传</span>
              </Button>
            )}
          </div>

          {!paused && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSimulateNetworkError}
              className="h-8 gap-1.5 rounded-full border border-dashed border-border text-xs text-muted-foreground hover:text-foreground"
            >
              <WifiOff className="size-3.5" />
              <span>模拟网络中断</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
