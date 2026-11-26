import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface SubmissionFormProps {
  title: string;
  description: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  canSubmit: boolean;
  disabled?: boolean;
  onSubmit: () => void;
}

const MAX_TITLE_LENGTH = 100;
const MAX_DESC_LENGTH = 2000;

export function SubmissionForm({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  canSubmit,
  disabled = false,
  onSubmit,
}: SubmissionFormProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || disabled) return;
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 标题（必填 1～100 字） */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="upload-title"
            className="text-sm font-medium text-foreground"
          >
            标题 <span className="text-destructive">*</span>
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {title.length}/{MAX_TITLE_LENGTH}
          </span>
        </div>
        <Input
          id="upload-title"
          value={title}
          onChange={(e) =>
            onTitleChange(e.target.value.slice(0, MAX_TITLE_LENGTH))
          }
          disabled={disabled}
          placeholder="选文件后若标题为空，将自动预填去掉 .mp4 后缀的文件名"
          maxLength={MAX_TITLE_LENGTH}
        />
      </div>

      {/* 简介（选填 0～2000 字） */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="upload-description"
            className="text-sm font-medium text-foreground"
          >
            简介{" "}
            <span className="text-xs font-normal text-muted-foreground">
              （选填）
            </span>
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {description.length}/{MAX_DESC_LENGTH}
          </span>
        </div>
        <Textarea
          id="upload-description"
          value={description}
          onChange={(e) =>
            onDescriptionChange(e.target.value.slice(0, MAX_DESC_LENGTH))
          }
          disabled={disabled}
          placeholder="介绍一下你的视频内容..."
          rows={4}
          maxLength={MAX_DESC_LENGTH}
          className="resize-none leading-relaxed"
        />
      </div>

      {/* 底部提示 + 提交主按钮 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted-foreground">
          封面将由系统自动截取
        </p>
        <Button type="submit" disabled={!canSubmit || disabled} className="px-5">
          上传并自动发布
        </Button>
      </div>
    </form>
  );
}
