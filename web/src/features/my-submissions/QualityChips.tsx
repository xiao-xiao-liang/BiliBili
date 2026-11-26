import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface QualityChipsProps {
  targetQualities: number[];
  completedQualities: number[];
  currentQuality: number | null;
}

export function QualityChips({
  targetQualities,
  completedQualities,
  currentQuality,
}: QualityChipsProps) {
  if (targetQualities.length === 0) return null;

  const sorted = [...targetQualities].sort((a, b) => a - b);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {sorted.map((q) => {
        const isDone = completedQualities.includes(q);
        const isActive = !isDone && currentQuality === q;

        return (
          <span
            key={q}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs tabular-nums transition-colors",
              isDone
                ? "border-border bg-secondary text-foreground font-medium"
                : isActive
                  ? "border-foreground/60 bg-secondary/70 text-foreground font-medium"
                  : "border-border/60 bg-transparent text-muted-foreground/70",
            )}
          >
            <span>{q}p</span>
            {isDone && <Check className="size-3 text-emerald-500" />}
            {isActive && (
              <Loader2 className="size-3 animate-spin text-amber-500" />
            )}
          </span>
        );
      })}
    </div>
  );
}
