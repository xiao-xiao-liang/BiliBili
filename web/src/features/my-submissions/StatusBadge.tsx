import type { SubmissionState } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  state: SubmissionState;
  className?: string;
}

const STATE_CONFIG: Record<
  SubmissionState,
  { label: string; dotClass: string }
> = {
  uploading: {
    label: "上传中",
    dotClass: "bg-muted-foreground",
  },
  processing: {
    label: "处理中",
    dotClass: "bg-amber-500 animate-pulse",
  },
  published: {
    label: "已发布",
    dotClass: "bg-emerald-500",
  },
  failed: {
    label: "处理失败",
    dotClass: "bg-destructive",
  },
  expired: {
    label: "已过期",
    dotClass: "bg-muted-foreground/50",
  },
};

export function StatusBadge({ state, className }: StatusBadgeProps) {
  const cfg = STATE_CONFIG[state];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground",
        className,
      )}
    >
      <span
        className={cn("size-1.5 rounded-full shrink-0", cfg.dotClass)}
        aria-hidden="true"
      />
      <span>{cfg.label}</span>
    </span>
  );
}
