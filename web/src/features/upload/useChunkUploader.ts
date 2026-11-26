import { useCallback, useEffect, useRef, useState } from "react";
import { generateIdempotencyKey } from "@/lib/format";
import type { OwnerSubmission, UploadSession } from "@/lib/types";
import {
  MockUploadError,
  PART_SIZE_BYTES,
  clearLocalResume,
  mockCompleteUpload,
  mockCreateSubmission,
  mockCreateUploadSession,
  mockResumeUploadSession,
  mockUploadAndConfirmPart,
  writeLocalResume,
} from "./mock-upload-api";

export interface SelectedUploadFile {
  name: string;
  size: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  /** 真实浏览器 File；若为模拟测试文件则为 null */
  rawFile: File | null;
  /** 模拟文件固定 sha256（用于演示匹配/不匹配） */
  mockSha256?: string;
}

export type UploadStage =
  | "idle"
  | "hashing"
  | "preparing"
  | "uploading"
  | "completing"
  | "processing";

export interface UploadErrorState {
  code: string;
  message: string;
  retryable: boolean;
  failedStage: "hashing" | "preparing" | "uploading" | "completing";
}

interface HashResult {
  fileSha256: string;
  partHashes: string[];
}

const MAX_CONCURRENCY = 3;

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // 非安全上下文降级伪哈希
  const view = new Uint8Array(buffer);
  let acc = 2166136261;
  for (let i = 0; i < view.length; i += 97) {
    acc ^= view[i];
    acc = Math.imul(acc, 16777619);
  }
  return (acc >>> 0).toString(16).padStart(64, "0");
}

function sleepAbortable(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function useChunkUploader() {
  const [stage, setStage] = useState<UploadStage>("idle");
  const [hashProgress, setHashProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<UploadErrorState | null>(null);
  const [submission, setSubmission] = useState<OwnerSubmission | null>(null);
  const [session, setSession] = useState<UploadSession | null>(null);
  const [activeFile, setActiveFile] = useState<SelectedUploadFile | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const simulateErrorFlagRef = useRef(false);
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey());
  const hashResultRef = useRef<HashResult | null>(null);
  const metaRef = useRef<{
    mode: "new" | "resume";
    title: string;
    description: string;
    resumeSubmission?: OwnerSubmission;
    resumeSession?: UploadSession;
  } | null>(null);

  // 阶段 1～3（含 completing）监听 beforeunload 防止误关页面
  useEffect(() => {
    const isActive =
      stage === "hashing" ||
      stage === "preparing" ||
      stage === "uploading" ||
      stage === "completing";
    if (!isActive) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [stage]);

  // 组件卸载时中止在途请求
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const persistResume = useCallback(
    (sub: OwnerSubmission, sess: UploadSession) => {
      const confirmedBytes = sess.parts
        .filter((p) => p.uploaded)
        .reduce((sum, p) => sum + p.size_bytes, 0);
      writeLocalResume({
        submissionId: sub.id,
        uploadId: sess.id,
        title: sub.title,
        fileName: sess.file_name,
        expectedSize: sess.expected_size,
        confirmedBytes,
        idempotencyKey: idempotencyKeyRef.current,
      });
    },
    [],
  );

  // 阶段 1：按 8 MiB 边界流式计算文件与分片校验值
  const runHashing = useCallback(
    async (
      file: SelectedUploadFile,
      signal: AbortSignal,
    ): Promise<HashResult> => {
      setStage("hashing");
      setHashProgress(0);
      const partCount = Math.max(1, Math.ceil(file.size / PART_SIZE_BYTES));
      const partHashes: string[] = [];

      if (file.rawFile) {
        for (let i = 0; i < partCount; i += 1) {
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
          const start = i * PART_SIZE_BYTES;
          const end = Math.min(file.size, start + PART_SIZE_BYTES);
          const sliceBuf = await file.rawFile.slice(start, end).arrayBuffer();
          const hex = await sha256Hex(sliceBuf);
          partHashes.push(hex);
          setHashProgress(Math.round(((i + 1) / partCount) * 100));
          // 让 UI 有清晰可见的阶段反馈
          await sleepAbortable(60, signal);
        }
        const combined = new TextEncoder().encode(partHashes.join(""));
        const fileSha256 = await sha256Hex(combined.buffer);
        return { fileSha256, partHashes };
      }

      // 模拟测试大文件：按 8 MiB 分片步进模拟流式哈希
      for (let i = 0; i < partCount; i += 1) {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        await sleepAbortable(75, signal);
        partHashes.push(
          `sim${String(i + 1).padStart(4, "0")}${"a".repeat(57)}`.slice(0, 64),
        );
        setHashProgress(Math.round(((i + 1) / partCount) * 100));
      }
      return {
        fileSha256:
          file.mockSha256 ??
          `simfile${file.size.toString(16).padStart(57, "0")}`.slice(0, 64),
        partHashes,
      };
    },
    [],
  );

  // 阶段 3 & 4：上传缺失分片（3 路并发）并完成校验交接
  const runUploadAndComplete = useCallback(
    async (
      currentSub: OwnerSubmission,
      initialSession: UploadSession,
      signal: AbortSignal,
    ) => {
      setStage("uploading");
      setPaused(false);
      setError(null);

      let latestSession = initialSession;
      setSession(latestSession);
      persistResume(currentSub, latestSession);

      const pendingParts = latestSession.parts
        .filter((p) => !p.uploaded)
        .map((p) => p.part_number);

      let cursor = 0;

      const worker = async () => {
        while (cursor < pendingParts.length) {
          if (signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }
          const partNumber = pendingParts[cursor];
          cursor += 1;

          // 检查是否触发了「模拟网络中断」演示
          if (simulateErrorFlagRef.current) {
            simulateErrorFlagRef.current = false;
            throw new MockUploadError(
              "NETWORK_INTERRUPTED",
              `第 ${partNumber} 分片上传时网络中断，已对账分片已保留，点击重试可继续上传。`,
              0,
              true,
            );
          }

          const updated = await mockUploadAndConfirmPart(
            latestSession.id,
            partNumber,
            signal,
          );
          latestSession = updated;
          setSession(updated);
          persistResume(currentSub, updated);
        }
      };

      const concurrency = Math.min(MAX_CONCURRENCY, Math.max(1, pendingParts.length));
      await Promise.all(Array.from({ length: concurrency }, () => worker()));

      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      // 阶段 4：调用 U06 完成上传，确认进入 processing 才算成功
      setStage("completing");
      const completed = await mockCompleteUpload(latestSession.id, signal);
      setSubmission(completed.submission);
      setSession(completed.upload);
      clearLocalResume();
      setStage("processing");
    },
    [persistResume],
  );

  // 启动新建投稿上传
  const startNewUpload = useCallback(
    async (file: SelectedUploadFile, title: string, description: string) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setActiveFile(file);
      setError(null);
      setPaused(false);
      idempotencyKeyRef.current = generateIdempotencyKey();
      metaRef.current = { mode: "new", title, description };

      try {
        const hashRes = await runHashing(file, controller.signal);
        hashResultRef.current = hashRes;

        setStage("preparing");
        const createdSub = await mockCreateSubmission(
          title,
          description,
          idempotencyKeyRef.current,
          controller.signal,
        );
        setSubmission(createdSub);

        const createdSession = await mockCreateUploadSession(
          createdSub.id,
          {
            file_name: file.name,
            file_size: file.size,
            file_sha256: hashRes.fileSha256,
            part_hashes: hashRes.partHashes,
          },
          idempotencyKeyRef.current,
          controller.signal,
        );
        setSession(createdSession);

        await runUploadAndComplete(
          createdSub,
          createdSession,
          controller.signal,
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const uploadErr =
          err instanceof MockUploadError
            ? err
            : new MockUploadError(
                "UPLOAD_ERROR",
                err instanceof Error ? err.message : "上传过程中发生异常",
                500,
                true,
              );
        setError({
          code: uploadErr.code,
          message: uploadErr.message,
          retryable: uploadErr.retryable,
          failedStage:
            stage === "hashing" ||
            stage === "preparing" ||
            stage === "completing"
              ? stage
              : "uploading",
        });
      }
    },
    [runHashing, runUploadAndComplete, stage],
  );

  // 启动断点续传恢复（先计算哈希，再调用 U05 校验原文件）
  const startResumeUpload = useCallback(
    async (
      file: SelectedUploadFile,
      existingSubmission: OwnerSubmission,
      existingSession: UploadSession,
    ) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setActiveFile(file);
      setSubmission(existingSubmission);
      setSession(existingSession);
      setError(null);
      setPaused(false);
      metaRef.current = {
        mode: "resume",
        title: existingSubmission.title,
        description: existingSubmission.description,
        resumeSubmission: existingSubmission,
        resumeSession: existingSession,
      };

      try {
        const hashRes = await runHashing(file, controller.signal);
        hashResultRef.current = hashRes;

        setStage("preparing");
        const reconciledSession = await mockResumeUploadSession(
          existingSession.id,
          {
            file_size: file.size,
            file_sha256: hashRes.fileSha256,
          },
          controller.signal,
        );
        setSession(reconciledSession);

        await runUploadAndComplete(
          existingSubmission,
          reconciledSession,
          controller.signal,
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        if (err instanceof MockUploadError) {
          setError({
            code: err.code,
            message: err.message,
            retryable: err.retryable,
            failedStage: "preparing",
          });
          if (err.code === "UPLOAD_FILE_MISMATCH") {
            // 选错文件时回到可重新选文件的状态
            setStage("idle");
          }
          return;
        }
        setError({
          code: "RESUME_ERROR",
          message: err instanceof Error ? err.message : "续传恢复失败",
          retryable: true,
          failedStage: "uploading",
        });
      }
    },
    [runHashing, runUploadAndComplete],
  );

  const pauseUpload = useCallback(() => {
    abortControllerRef.current?.abort();
    setPaused(true);
  }, []);

  const resumeUpload = useCallback(async () => {
    if (!submission || !session) return;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setError(null);
    setPaused(false);

    try {
      await runUploadAndComplete(submission, session, controller.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const uploadErr =
        err instanceof MockUploadError
          ? err
          : new MockUploadError(
              "UPLOAD_ERROR",
              err instanceof Error ? err.message : "继续上传失败",
              500,
              true,
            );
      setError({
        code: uploadErr.code,
        message: uploadErr.message,
        retryable: uploadErr.retryable,
        failedStage: "uploading",
      });
    }
  }, [submission, session, runUploadAndComplete]);

  const triggerSimulatedNetworkError = useCallback(() => {
    simulateErrorFlagRef.current = true;
  }, []);

  const retryCurrentStep = useCallback(async () => {
    if (submission && session) {
      await resumeUpload();
      return;
    }
    const meta = metaRef.current;
    if (activeFile && meta?.mode === "new") {
      await startNewUpload(activeFile, meta.title, meta.description);
    } else if (
      activeFile &&
      meta?.mode === "resume" &&
      meta.resumeSubmission &&
      meta.resumeSession
    ) {
      await startResumeUpload(
        activeFile,
        meta.resumeSubmission,
        meta.resumeSession,
      );
    }
  }, [
    submission,
    session,
    resumeUpload,
    activeFile,
    startNewUpload,
    startResumeUpload,
  ]);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    simulateErrorFlagRef.current = false;
    setStage("idle");
    setHashProgress(0);
    setPaused(false);
    setError(null);
    setSubmission(null);
    setSession(null);
    setActiveFile(null);
    hashResultRef.current = null;
    metaRef.current = null;
    idempotencyKeyRef.current = generateIdempotencyKey();
  }, []);

  const confirmedBytes = session
    ? session.parts
        .filter((p) => p.uploaded)
        .reduce((sum, p) => sum + p.size_bytes, 0)
    : 0;
  const uploadedPartCount = session
    ? session.parts.filter((p) => p.uploaded).length
    : 0;
  const totalPartCount = session?.part_count ?? 0;
  const expectedSize = session?.expected_size ?? activeFile?.size ?? 0;
  const uploadPercent =
    expectedSize > 0
      ? Math.min(100, Math.round((confirmedBytes / expectedSize) * 100))
      : 0;

  return {
    stage,
    hashProgress,
    paused,
    error,
    clearError: () => setError(null),
    submission,
    session,
    activeFile,
    confirmedBytes,
    expectedSize,
    uploadedPartCount,
    totalPartCount,
    uploadPercent,
    startNewUpload,
    startResumeUpload,
    pauseUpload,
    resumeUpload,
    triggerSimulatedNetworkError,
    retryCurrentStep,
    reset,
  };
}
