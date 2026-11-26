import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  FileWarning,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, formatDate } from "@/lib/format";
import type {
  LocalUploadResume,
  OwnerSubmission,
  UploadSession,
} from "@/lib/types";
import { FileDropzone } from "./FileDropzone";
import {
  DEMO_EXPIRED_SUBMISSION_ID,
  DEMO_RESUME_SUBMISSION_ID,
  clearLocalResume,
  mockFetchResumeSubmission,
  readLocalResume,
  seedLocalResumeDemo,
} from "./mock-upload-api";
import { ResumeBanner } from "./ResumeBanner";
import { SubmissionForm } from "./SubmissionForm";
import { UploadProgressPanel } from "./UploadProgressPanel";
import {
  useChunkUploader,
  type SelectedUploadFile,
} from "./useChunkUploader";

function stripMp4Extension(filename: string): string {
  return filename.replace(/\.mp4$/i, "");
}

export function UploadPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeSubmissionId = searchParams.get("submissionId");

  const uploader = useChunkUploader();

  // 新建模式表单状态
  const [selectedFile, setSelectedFile] = useState<SelectedUploadFile | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [localResume, setLocalResume] = useState<LocalUploadResume | null>(() =>
    readLocalResume(),
  );

  // 续传恢复模式（/upload?submissionId={uuid}）远端记录状态
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeNotFound, setResumeNotFound] = useState(false);
  const [resumeData, setResumeData] = useState<{
    submission: OwnerSubmission;
    session: UploadSession;
  } | null>(null);

  // 切换 URL 参数时重置状态并按需拉取续传会话
  useEffect(() => {
    uploader.reset();
    setSelectedFile(null);

    if (!resumeSubmissionId) {
      setResumeData(null);
      setResumeNotFound(false);
      setLocalResume(readLocalResume());
      return;
    }

    let cancelled = false;
    setResumeLoading(true);
    setResumeNotFound(false);

    void mockFetchResumeSubmission(resumeSubmissionId).then((res) => {
      if (cancelled) return;
      setResumeLoading(false);
      if (!res) {
        setResumeNotFound(true);
        setResumeData(null);
      } else {
        setResumeData(res);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeSubmissionId]);

  // 未登录守卫
  if (!isAuthenticated) {
    const redirectTarget = resumeSubmissionId
      ? `/upload?submissionId=${encodeURIComponent(resumeSubmissionId)}`
      : "/upload";
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight">登录后投稿</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            当前处于游客演示态，请先登录或通过顶栏「演示：游客」切换至已登录态。
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button asChild size="sm">
              <Link
                to={`/login?redirect=${encodeURIComponent(redirectTarget)}`}
              >
                前往登录
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/">返回首页</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isUploadingFlow = uploader.stage !== "idle";

  const handleSelectNewFile = (file: SelectedUploadFile) => {
    uploader.clearError();
    setSelectedFile(file);
    if (!title.trim()) {
      setTitle(stripMp4Extension(file.name).slice(0, 100));
    }
  };

  const handleStartNew = () => {
    if (!selectedFile || !title.trim()) return;
    void uploader.startNewUpload(selectedFile, title.trim(), description);
  };

  const handleSelectResumeFile = (file: SelectedUploadFile) => {
    uploader.clearError();
    setSelectedFile(file);
    if (resumeData) {
      void uploader.startResumeUpload(
        file,
        resumeData.submission,
        resumeData.session,
      );
    }
  };

  const handleUploadAnother = () => {
    uploader.reset();
    setSelectedFile(null);
    setTitle("");
    setDescription("");
    setLocalResume(readLocalResume());
    if (resumeSubmissionId) {
      navigate("/upload", { replace: true });
    }
  };

  // ==================== 断点续传恢复模式 ====================
  if (resumeSubmissionId) {
    const isExpired =
      resumeData?.submission.state === "expired" ||
      resumeData?.session.state === "expired";

    const initialConfirmed = resumeData
      ? resumeData.session.parts
          .filter((p) => p.uploaded)
          .reduce((sum, p) => sum + p.size_bytes, 0)
      : 0;
    const initialPercent =
      resumeData && resumeData.session.expected_size > 0
        ? Math.round(
            (initialConfirmed / resumeData.session.expected_size) * 100,
          )
        : 0;

    return (
      <div className="max-w-2xl mx-auto px-6 py-8 pb-16">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">继续上传</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              重新选择原视频文件校验一致后，将仅补传剩余缺失分片。
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/upload">
              <ArrowLeft className="size-4" />
              <span>新建投稿</span>
            </Link>
          </Button>
        </div>

        {resumeLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </div>
        ) : resumeNotFound || !resumeData ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <AlertCircle className="mx-auto size-9 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">未找到该待续传投稿</p>
            <p className="mt-1 text-xs text-muted-foreground">
              该投稿可能已完成发布、已被删除或不属于当前账号。
            </p>
            <Button asChild size="sm" className="mt-5">
              <Link to="/upload">新建投稿</Link>
            </Button>
          </div>
        ) : isExpired ? (
          /* 410 UPLOAD_EXPIRED 边界态 */
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <div className="mx-auto mb-4 inline-flex size-11 items-center justify-center rounded-full bg-secondary border border-border">
              <FileWarning className="size-5 text-muted-foreground" />
            </div>
            <div className="mb-3 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground border border-border">
                <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                <span>上传已过期</span>
              </span>
            </div>
            <h2 className="text-base font-semibold">
              《{resumeData.submission.title}》上传会话已过期
            </h2>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              未完成上传连续 7 天无活动后已自动过期清理（过期于{" "}
              <span className="tabular-nums">
                {formatDate(resumeData.session.expires_at)}
              </span>
              ），无法继续上传，请重新发起投稿。
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                size="sm"
                onClick={() => {
                  clearLocalResume();
                  navigate("/upload", { replace: true });
                }}
              >
                重新投稿
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/me/submissions">返回我的投稿</Link>
              </Button>
            </div>
          </div>
        ) : isUploadingFlow ? (
          <UploadProgressPanel
            title={resumeData.submission.title}
            stage={uploader.stage}
            hashProgress={uploader.hashProgress}
            paused={uploader.paused}
            error={uploader.error}
            confirmedBytes={uploader.confirmedBytes}
            expectedSize={uploader.expectedSize}
            uploadedPartCount={uploader.uploadedPartCount}
            totalPartCount={uploader.totalPartCount}
            uploadPercent={uploader.uploadPercent}
            submissionId={resumeData.submission.id}
            onPause={uploader.pauseUpload}
            onResume={() => void uploader.resumeUpload()}
            onRetry={() => void uploader.retryCurrentStep()}
            onSimulateNetworkError={uploader.triggerSimulatedNetworkError}
            onUploadAnother={handleUploadAnother}
          />
        ) : (
          <div className="space-y-5">
            {/* 只读待续传投稿摘要卡 */}
            <div className="rounded-xl border border-border bg-secondary/40 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  《{resumeData.submission.title}》
                </h2>
                <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground border border-border">
                  <span className="size-1.5 rounded-full bg-muted-foreground" />
                  <span>上传中 / 待继续</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground tabular-nums">
                <div>
                  原文件：
                  <span className="text-foreground">
                    {resumeData.session.file_name}
                  </span>
                </div>
                <div>
                  已对账进度：
                  <span className="text-foreground font-medium">
                    {formatBytes(initialConfirmed)} /{" "}
                    {formatBytes(resumeData.session.expected_size)}（
                    {initialPercent}%）
                  </span>
                </div>
                <div className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" />
                  <span>
                    过期于 {formatDate(resumeData.session.expires_at)}
                  </span>
                </div>
              </div>
            </div>

            {/* 选择原文件触发 U05 校验 */}
            <FileDropzone
              file={selectedFile}
              mode="resume"
              externalError={
                uploader.error?.code === "UPLOAD_FILE_MISMATCH"
                  ? uploader.error.message
                  : null
              }
              onSelectFile={handleSelectResumeFile}
              onClearFile={() => {
                setSelectedFile(null);
                uploader.clearError();
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // ==================== 新建投稿模式（/upload） ====================
  return (
    <div className="max-w-2xl mx-auto px-6 py-8 pb-16">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">投稿视频</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          上传完成后后台自动转码多清晰度并发布，无需手动上架。
        </p>
      </div>

      {/* 本地断点恢复提示条（仅未进入上传态时显示） */}
      {!isUploadingFlow && localResume && (
        <ResumeBanner
          record={localResume}
          onResume={() =>
            navigate(
              `/upload?submissionId=${encodeURIComponent(localResume.submissionId)}`,
            )
          }
          onDismiss={() => {
            clearLocalResume();
            setLocalResume(null);
            toast.info("已忽略本地未完成上传提示");
          }}
        />
      )}

      {isUploadingFlow ? (
        <UploadProgressPanel
          title={title.trim()}
          stage={uploader.stage}
          hashProgress={uploader.hashProgress}
          paused={uploader.paused}
          error={uploader.error}
          confirmedBytes={uploader.confirmedBytes}
          expectedSize={uploader.expectedSize}
          uploadedPartCount={uploader.uploadedPartCount}
          totalPartCount={uploader.totalPartCount}
          uploadPercent={uploader.uploadPercent}
          submissionId={uploader.submission?.id ?? null}
          onPause={uploader.pauseUpload}
          onResume={() => void uploader.resumeUpload()}
          onRetry={() => void uploader.retryCurrentStep()}
          onSimulateNetworkError={uploader.triggerSimulatedNetworkError}
          onUploadAnother={handleUploadAnother}
        />
      ) : (
        <div className="space-y-6">
          <FileDropzone
            file={selectedFile}
            mode="new"
            onSelectFile={handleSelectNewFile}
            onClearFile={() => setSelectedFile(null)}
          />

          <SubmissionForm
            title={title}
            description={description}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
            canSubmit={selectedFile !== null && title.trim().length > 0}
            onSubmit={handleStartNew}
          />
        </div>
      )}

      {/* 轻量演示快捷入口：方便一键预览断点横幅、续传恢复与已过期边界态 */}
      <Separator className="my-10" />
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="font-medium">本地 Mock 边界态快捷预览</span>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-full border border-dashed border-border px-2.5 text-xs"
            onClick={() => {
              const seeded = seedLocalResumeDemo();
              setLocalResume(seeded);
              toast.info("已写入本地断点记录，顶部已展示 ResumeBanner");
            }}
          >
            <RotateCcw className="mr-1 size-3" />
            <span>触发顶部断点横幅</span>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 rounded-full border border-dashed border-border px-2.5 text-xs"
          >
            <Link to={`/upload?submissionId=${DEMO_RESUME_SUBMISSION_ID}`}>
              续传恢复模式
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 rounded-full border border-dashed border-border px-2.5 text-xs"
          >
            <Link to={`/upload?submissionId=${DEMO_EXPIRED_SUBMISSION_ID}`}>
              已过期态 (410)
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
