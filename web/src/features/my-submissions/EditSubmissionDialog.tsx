import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { OwnerSubmission } from "@/lib/types";
import {
  MockSubmissionApiError,
  mockBumpSubmissionVersion,
  mockFetchOwnerSubmission,
  mockUpdateSubmission,
} from "./mock-submissions-api";

interface EditSubmissionDialogProps {
  submission: OwnerSubmission | null;
  onClose: () => void;
  onSaved: (updated: OwnerSubmission) => void;
}

const MAX_TITLE = 100;
const MAX_DESC = 2000;

export function EditSubmissionDialog({
  submission,
  onClose,
  onSaved,
}: EditSubmissionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [etag, setEtag] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [conflictSimulated, setConflictSimulated] = useState(false);

  // 打开弹窗时调用 S03 拉取最新资料与 ETag
  useEffect(() => {
    if (!submission) return;
    let cancelled = false;
    setLoading(true);
    setConflictMessage(null);
    setConflictSimulated(false);

    void mockFetchOwnerSubmission(submission.id)
      .then((res) => {
        if (cancelled) return;
        setTitle(res.submission.title);
        setDescription(res.submission.description);
        setEtag(res.etag);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("拉取投稿最新资料失败");
          onClose();
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [submission, onClose]);

  const canSave =
    !loading && !saving && title.trim().length >= 1 && title.trim().length <= MAX_TITLE;

  const handleSimulateConflict = () => {
    if (!submission) return;
    mockBumpSubmissionVersion(submission.id);
    setConflictSimulated(true);
    toast.info("已模拟其他窗口修改版本，点击「保存修改」将触发 412 冲突");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!submission || !canSave) return;

    setSaving(true);
    setConflictMessage(null);
    try {
      const res = await mockUpdateSubmission(
        submission.id,
        { title, description },
        etag,
      );
      onSaved(res.submission);
      toast.success("投稿资料已更新");
      onClose();
    } catch (err) {
      if (err instanceof MockSubmissionApiError && err.status === 412) {
        setConflictMessage(err.message);
        setConflictSimulated(false);
        // 自动刷新最新内容与新 ETag，由用户确认后重新保存
        try {
          const fresh = await mockFetchOwnerSubmission(submission.id);
          setTitle(fresh.submission.title);
          setDescription(fresh.submission.description);
          setEtag(fresh.etag);
        } catch {
          // ignore
        }
      } else {
        toast.error(err instanceof Error ? err.message : "保存失败，请重试");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={submission !== null}
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>编辑投稿资料</DialogTitle>
          <DialogDescription>
            修改标题或简介不会重新转码视频，也不会改变发布状态。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-2">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-28 w-full rounded-md" />
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {conflictMessage && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-0.5">
                  <p className="font-medium">412 VERSION_CONFLICT</p>
                  <p className="leading-relaxed">{conflictMessage}</p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="edit-title" className="text-sm font-medium">
                  标题 <span className="text-destructive">*</span>
                </label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {title.length}/{MAX_TITLE}
                </span>
              </div>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
                disabled={saving}
                maxLength={MAX_TITLE}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="edit-desc" className="text-sm font-medium">
                  简介
                </label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {description.length}/{MAX_DESC}
                </span>
              </div>
              <Textarea
                id="edit-desc"
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value.slice(0, MAX_DESC))
                }
                disabled={saving}
                rows={4}
                maxLength={MAX_DESC}
                className="resize-none leading-relaxed"
              />
            </div>

            <DialogFooter className="items-center sm:justify-between pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving || conflictSimulated}
                onClick={handleSimulateConflict}
                className="h-7 gap-1 rounded-full border border-dashed border-border px-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <ShieldAlert className="size-3" />
                <span>
                  {conflictSimulated
                    ? "已注入版本冲突"
                    : "模拟 412 并发冲突"}
                </span>
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={onClose}
                >
                  取消
                </Button>
                <Button type="submit" size="sm" disabled={!canSave}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      <span>保存中...</span>
                    </>
                  ) : (
                    <span>保存修改</span>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
