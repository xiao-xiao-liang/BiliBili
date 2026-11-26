import { useRef, useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuthModal } from "@/features/auth/AuthModal";
import { generateIdempotencyKey } from "@/lib/format";

interface DanmakuBarProps {
  submissionId: string;
  enabled: boolean;
  onToggleEnabled: (checked: boolean) => void;
  totalCount: number;
  onSend: (body: string, idempotencyKey: string) => Promise<void>;
}

const MAX_LENGTH = 100;

export function DanmakuBar({
  enabled,
  onToggleEnabled,
  totalCount,
  onSend,
}: DanmakuBarProps) {
  const { isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey());

  const trimmedLength = text.trim().length;
  const canSubmit =
    isAuthenticated && !submitting && trimmedLength >= 1 && trimmedLength <= MAX_LENGTH;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSend(text.trim(), idempotencyKeyRef.current);
      setText("");
      // 发送成功后换新的幂等键；失败时保留原键以便重试复用
      idempotencyKeyRef.current = generateIdempotencyKey();
      if (!enabled) {
        onToggleEnabled(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "弹幕发送失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border bg-card px-4 py-2.5">
      {/* 弹幕开关 */}
      <div className="flex items-center gap-2 shrink-0">
        <Switch
          id="danmaku-switch"
          checked={enabled}
          onCheckedChange={onToggleEnabled}
          aria-label="弹幕开关"
        />
        <label
          htmlFor="danmaku-switch"
          className="cursor-pointer select-none text-xs font-medium text-foreground"
        >
          弹幕
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">
          ({totalCount})
        </span>
      </div>

      {/* 弹幕输入与发送 */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex flex-1 items-center gap-2 min-w-[220px]"
      >
        <div className="relative flex-1">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
            disabled={!isAuthenticated || submitting}
            placeholder={
              isAuthenticated ? "发一条友善的弹幕..." : "登录后发送弹幕"
            }
            maxLength={MAX_LENGTH}
            className="h-9 pr-14 text-sm bg-secondary/50 border-border"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums">
            {text.length}/{MAX_LENGTH}
          </span>
        </div>

        {isAuthenticated ? (
          <Button
            type="submit"
            size="sm"
            disabled={!canSubmit}
            className="h-9 px-4 gap-1.5 shrink-0"
          >
            {submitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            <span>发送</span>
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-9 shrink-0"
            onClick={() => openAuthModal("login")}
          >
            去登录
          </Button>
        )}
      </form>
    </div>
  );
}
