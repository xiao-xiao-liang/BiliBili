import { useState } from "react";
import { toast } from "sonner";
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
import type { OwnerSubmission } from "@/lib/types";
import { mockDeleteSubmission } from "./mock-submissions-api";

interface DeleteSubmissionDialogProps {
  submission: OwnerSubmission | null;
  onClose: () => void;
  onDeleted: (submissionId: string) => void;
}

function getDeleteWarning(submission: OwnerSubmission): string {
  switch (submission.state) {
    case "published":
      return `删除《${submission.title}》后将立即下架并停止对外提供观看，相关视频与互动记录不可恢复。`;
    case "uploading":
      return `删除《${submission.title}》将立即中止当前上传会话并清理已上传分片，操作不可恢复。`;
    case "processing":
      return `删除《${submission.title}》将立即中止后台转码任务并清理媒体文件，操作不可恢复。`;
    default:
      return `确定要永久删除《${submission.title}》吗？删除后记录与关联文件将无法恢复。`;
  }
}

export function DeleteSubmissionDialog({
  submission,
  onClose,
  onDeleted,
}: DeleteSubmissionDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    if (!submission || deleting) return;
    setDeleting(true);
    try {
      await mockDeleteSubmission(submission.id);
      onDeleted(submission.id);
      toast.success("投稿已删除");
      onClose();
    } catch {
      toast.error("删除投稿失败，请稍后重试");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog
      open={submission !== null}
      onOpenChange={(open) => {
        if (!open && !deleting) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除这条投稿？</AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed">
            {submission ? getDeleteWarning(submission) : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? "删除中..." : "确认删除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
