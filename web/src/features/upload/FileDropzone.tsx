import { useRef, useState, type DragEvent } from "react";
import { AlertCircle, FileVideo, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DEMO_RESUME_FILE_NAME,
  DEMO_RESUME_FILE_SHA256,
  DEMO_RESUME_FILE_SIZE,
  MAX_DURATION_SECONDS,
  MAX_FILE_SIZE_BYTES,
} from "./mock-upload-api";
import type { SelectedUploadFile } from "./useChunkUploader";

interface FileDropzoneProps {
  file: SelectedUploadFile | null;
  locked?: boolean;
  externalError?: string | null;
  mode?: "new" | "resume";
  onSelectFile: (file: SelectedUploadFile) => void;
  onClearFile: () => void;
}

interface ProbeResult {
  durationMs: number | null;
  width: number | null;
  height: number | null;
  validationError: string | null;
}

function probeVideoMetadata(file: File): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    const timer = window.setTimeout(() => {
      cleanup();
      resolve({
        durationMs: null,
        width: null,
        height: null,
        validationError: null,
      });
    }, 3000);

    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      const width = video.videoWidth || null;
      const height = video.videoHeight || null;
      cleanup();

      if (duration !== null && duration > MAX_DURATION_SECONDS) {
        resolve({
          durationMs: Math.round(duration * 1000),
          width,
          height,
          validationError: `视频时长超过 30 分钟限制（当前 ${formatDuration(duration * 1000)}）。`,
        });
        return;
      }

      if (width !== null && height !== null) {
        if (width < height) {
          resolve({
            durationMs: duration ? Math.round(duration * 1000) : null,
            width,
            height,
            validationError: `第一版仅支持普通横屏视频（当前分辨率 ${width}×${height}）。`,
          });
          return;
        }
        if (height < 360 || height > 1080) {
          resolve({
            durationMs: duration ? Math.round(duration * 1000) : null,
            width,
            height,
            validationError: `画面高度需在 360p–1080p 之间（当前 ${height}p）。`,
          });
          return;
        }
      }

      resolve({
        durationMs: duration ? Math.round(duration * 1000) : null,
        width,
        height,
        validationError: null,
      });
    };

    video.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      // 浏览器无法解码某些合法 MP4 时不阻断，交由服务端 ffprobe 终裁
      resolve({
        durationMs: null,
        width: null,
        height: null,
        validationError: null,
      });
    };

    video.src = url;
  });
}

export function FileDropzone({
  file,
  locked = false,
  externalError = null,
  mode = "new",
  onSelectFile,
  onClearFile,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [probing, setProbing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [formatHint, setFormatHint] = useState<string | null>(null);

  const errorMessage = externalError ?? localError;

  const handleRawFile = async (raw: File) => {
    setLocalError(null);
    setFormatHint(null);

    if (raw.size === 0) {
      setLocalError("所选文件为空，请重新选择有效的 MP4 视频文件。");
      return;
    }
    if (raw.size > MAX_FILE_SIZE_BYTES) {
      setLocalError(
        `文件大小超出 1 GB 限制（当前 ${formatBytes(raw.size)}）。`,
      );
      return;
    }

    const isMp4Like =
      raw.type === "video/mp4" || raw.name.toLowerCase().endsWith(".mp4");
    if (!isMp4Like) {
      setFormatHint(
        "提示：检测到非 .mp4 扩展名/MIME，第一版仅支持 MP4 (H.264/AAC)，最终合法性以服务端校验为准。",
      );
    }

    setProbing(true);
    const probe = await probeVideoMetadata(raw);
    setProbing(false);

    if (probe.validationError) {
      setLocalError(probe.validationError);
      return;
    }

    onSelectFile({
      name: raw.name,
      size: raw.size,
      durationMs: probe.durationMs,
      width: probe.width,
      height: probe.height,
      rawFile: raw,
    });
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (locked) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) void handleRawFile(dropped);
  };

  const pickSimulatedMatchingFile = () => {
    setLocalError(null);
    setFormatHint(null);
    onSelectFile({
      name:
        mode === "resume"
          ? DEMO_RESUME_FILE_NAME
          : "mono-hls-architecture-demo.mp4",
      size: DEMO_RESUME_FILE_SIZE,
      durationMs: 812000,
      width: 1920,
      height: 1080,
      rawFile: null,
      mockSha256:
        mode === "resume" ? DEMO_RESUME_FILE_SHA256 : undefined,
    });
  };

  const pickSimulatedWrongFile = () => {
    setLocalError(null);
    setFormatHint(null);
    onSelectFile({
      name: "another-video-file.mp4",
      size: 52 * 1024 * 1024,
      durationMs: 320000,
      width: 1280,
      height: 720,
      rawFile: null,
      mockSha256: "0".repeat(64),
    });
  };

  return (
    <div className="space-y-2.5">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,.mp4"
        disabled={locked}
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) void handleRawFile(picked);
          e.target.value = "";
        }}
        className="hidden"
      />

      {!file ? (
        <div
          role="button"
          tabIndex={locked ? -1 : 0}
          onClick={() => !locked && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (!locked && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!locked) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-11 text-center transition-colors cursor-pointer",
            dragging
              ? "border-foreground bg-secondary/70"
              : "border-border bg-card hover:border-foreground/40 hover:bg-secondary/30",
            locked && "opacity-60 pointer-events-none",
          )}
        >
          <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-secondary border border-border">
            <Upload className="size-5 text-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {probing
              ? "正在检测视频元数据..."
              : mode === "resume"
                ? "请重新选择原 MP4 视频文件以继续上传"
                : "拖拽 MP4 视频到这里，或点击选择文件"}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
            MP4 (H.264 / AAC) · 360p–1080p · ≤ 1 GB · ≤ 30 分钟
          </p>

          {/* 演示辅助：无本地大文件时可直接一键模拟 */}
          <div
            className="mt-5 flex flex-wrap items-center justify-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 text-xs"
              onClick={pickSimulatedMatchingFile}
            >
              {mode === "resume"
                ? "模拟选择原文件（校验通过）"
                : "使用模拟测试视频（128.4 MB · 16 分片）"}
            </Button>
            {mode === "resume" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={pickSimulatedWrongFile}
              >
                模拟选错文件（触发 MISMATCH）
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* 紧凑已选文件卡片 */
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary border border-border">
              <FileVideo className="size-5 text-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {file.name}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                <span>{formatBytes(file.size)}</span>
                {file.durationMs !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{formatDuration(file.durationMs)}</span>
                  </>
                )}
                {file.width !== null && file.height !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      {file.width}×{file.height}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {!locked && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5"
              onClick={() => {
                onClearFile();
                inputRef.current?.click();
              }}
            >
              <RefreshCw className="size-3.5" />
              <span>更换文件</span>
            </Button>
          )}
        </div>
      )}

      {formatHint && !errorMessage && (
        <p className="text-xs text-muted-foreground">{formatHint}</p>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
