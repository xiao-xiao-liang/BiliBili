import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LocalUploadResume } from "@/lib/types";

interface ResumeBannerProps {
  record: LocalUploadResume;
  onResume: () => void;
  onDismiss: () => void;
}

export function ResumeBanner({
  record,
  onResume,
  onDismiss,
}: ResumeBannerProps) {
  const percent =
    record.expectedSize > 0
      ? Math.min(
          100,
          Math.round((record.confirmedBytes / record.expectedSize) * 100),
        )
      : 0;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/60 px-4 py-3">
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <Info className="mt-0.5 size-4 shrink-0 text-foreground" />
        <p className="text-sm text-foreground leading-snug">
          检测到未完成的投稿{" "}
          <span className="font-medium">《{record.title}》</span>
          ，已上传{" "}
          <span className="font-medium tabular-nums">{percent}%</span>
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button type="button" size="sm" className="h-8" onClick={onResume}>
          继续上传
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
        >
          忽略
        </Button>
      </div>
    </div>
  );
}
