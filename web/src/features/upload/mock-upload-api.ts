import { generateIdempotencyKey } from "@/lib/format";
import type {
  LocalUploadResume,
  OwnerSubmission,
  PartStatus,
  UploadSession,
} from "@/lib/types";

export const PART_SIZE_BYTES = 8 * 1024 * 1024; // 固定 8 MiB
export const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1 GB
export const MAX_DURATION_SECONDS = 30 * 60; // 30 分钟
export const RESUME_STORAGE_KEY = "mono_upload_resume_v1";

export const DEMO_RESUME_SUBMISSION_ID = "sub-resume-active";
export const DEMO_EXPIRED_SUBMISSION_ID = "sub-resume-expired";
export const DEMO_RESUME_FILE_SIZE = 134637158; // ~128.4 MB (16 parts)
export const DEMO_RESUME_FILE_NAME = "go-concurrency-practice.mp4";
export const DEMO_RESUME_FILE_SHA256 =
  "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

export class MockUploadError extends Error {
  code: string;
  status: number;
  retryable: boolean;

  constructor(code: string, message: string, status: number, retryable = true) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

function buildParts(
  fileSize: number,
  uploadedCount = 0,
  partHashes?: string[],
): PartStatus[] {
  const partCount = Math.max(1, Math.ceil(fileSize / PART_SIZE_BYTES));
  const parts: PartStatus[] = [];
  for (let i = 0; i < partCount; i += 1) {
    const start = i * PART_SIZE_BYTES;
    const size = Math.min(PART_SIZE_BYTES, fileSize - start);
    const uploaded = i < uploadedCount;
    parts.push({
      part_number: i + 1,
      size_bytes: size,
      sha256:
        partHashes?.[i] ??
        `part${String(i + 1).padStart(4, "0")}${"0".repeat(56)}`.slice(0, 64),
      etag: uploaded ? `"etag-part-${i + 1}"` : null,
      uploaded,
    });
  }
  return parts;
}

// 内存态模拟后端投稿与上传会话仓储
const ownerSubmissions = new Map<string, OwnerSubmission>();
const uploadSessions = new Map<string, UploadSession>();

function seedDemoResumeRecords() {
  const now = Date.now();
  const inFiveDays = new Date(now + 5 * 86400 * 1000).toISOString();
  const twoDaysAgo = new Date(now - 2 * 86400 * 1000).toISOString();

  // 预置 1：可恢复的断点续传投稿（已上传 8 / 16 分片）
  const activeParts = buildParts(DEMO_RESUME_FILE_SIZE, 8);
  const confirmedActive = activeParts
    .filter((p) => p.uploaded)
    .reduce((sum, p) => sum + p.size_bytes, 0);

  const activeSession: UploadSession = {
    id: "upl-resume-active",
    submission_id: DEMO_RESUME_SUBMISSION_ID,
    state: "uploading",
    file_name: DEMO_RESUME_FILE_NAME,
    expected_size: DEMO_RESUME_FILE_SIZE,
    file_sha256: DEMO_RESUME_FILE_SHA256,
    part_size: PART_SIZE_BYTES,
    part_count: activeParts.length,
    expires_at: inFiveDays,
    parts: activeParts,
    error: null,
  };

  const activeSubmission: OwnerSubmission = {
    id: DEMO_RESUME_SUBMISSION_ID,
    title: "Go 并发实战：Context、ErrGroup 与优雅退出",
    description:
      "结合 MONO 视频转码 Worker 演示 Go 并发控制与优雅停机最佳实践。",
    state: "uploading",
    version: 1,
    cover_url: null,
    duration_ms: 812000,
    created_at: new Date(now - 3 * 3600 * 1000).toISOString(),
    updated_at: new Date(now - 1 * 3600 * 1000).toISOString(),
    published_at: null,
    upload: {
      id: activeSession.id,
      state: "uploading",
      expected_size: DEMO_RESUME_FILE_SIZE,
      confirmed_bytes: confirmedActive,
      expires_at: inFiveDays,
    },
    processing: null,
    error: null,
  };

  // 预置 2：已过期的上传会话（410 UPLOAD_EXPIRED 边界态演示）
  const expiredParts = buildParts(64 * 1024 * 1024, 3);
  const expiredSession: UploadSession = {
    id: "upl-resume-expired",
    submission_id: DEMO_EXPIRED_SUBMISSION_ID,
    state: "expired",
    file_name: "old-transcode-test.mp4",
    expected_size: 64 * 1024 * 1024,
    file_sha256: "f".repeat(64),
    part_size: PART_SIZE_BYTES,
    part_count: expiredParts.length,
    expires_at: twoDaysAgo,
    parts: expiredParts,
    error: {
      code: "UPLOAD_EXPIRED",
      message: "未完成上传超过 7 天已过期清理，请重新投稿。",
      retryable: false,
    },
  };

  const expiredSubmission: OwnerSubmission = {
    id: DEMO_EXPIRED_SUBMISSION_ID,
    title: "旧版 FFmpeg 转码压测记录",
    description: "",
    state: "expired",
    version: 1,
    cover_url: null,
    duration_ms: null,
    created_at: new Date(now - 9 * 86400 * 1000).toISOString(),
    updated_at: twoDaysAgo,
    published_at: null,
    upload: {
      id: expiredSession.id,
      state: "expired",
      expected_size: expiredSession.expected_size,
      confirmed_bytes: 3 * PART_SIZE_BYTES,
      expires_at: twoDaysAgo,
    },
    processing: null,
    error: expiredSession.error,
  };

  ownerSubmissions.set(activeSubmission.id, activeSubmission);
  uploadSessions.set(activeSession.id, activeSession);
  ownerSubmissions.set(expiredSubmission.id, expiredSubmission);
  uploadSessions.set(expiredSession.id, expiredSession);
}

seedDemoResumeRecords();

// localStorage 读写（绝不存文件 Blob）
export function readLocalResume(): LocalUploadResume | null {
  try {
    const raw = localStorage.getItem(RESUME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalUploadResume;
    if (!parsed?.submissionId || !parsed?.uploadId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLocalResume(record: LocalUploadResume): void {
  try {
    localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // 忽略隐私模式限制
  }
}

export function clearLocalResume(): void {
  try {
    localStorage.removeItem(RESUME_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function seedLocalResumeDemo(): LocalUploadResume {
  const sub = ownerSubmissions.get(DEMO_RESUME_SUBMISSION_ID)!;
  const record: LocalUploadResume = {
    submissionId: sub.id,
    uploadId: sub.upload!.id,
    title: sub.title,
    fileName: DEMO_RESUME_FILE_NAME,
    expectedSize: sub.upload!.expected_size,
    confirmedBytes: sub.upload!.confirmed_bytes,
    idempotencyKey: generateIdempotencyKey(),
  };
  writeLocalResume(record);
  return record;
}

// S03 + U02：读取作者投稿与上传会话
export async function mockFetchResumeSubmission(
  submissionId: string,
): Promise<{ submission: OwnerSubmission; session: UploadSession } | null> {
  await delay(220);
  const sub = ownerSubmissions.get(submissionId);
  if (!sub || !sub.upload) return null;
  const session = uploadSessions.get(sub.upload.id);
  if (!session) return null;
  return {
    submission: structuredClone(sub),
    session: structuredClone(session),
  };
}

// S01：创建投稿（state = uploading）
export async function mockCreateSubmission(
  title: string,
  description: string,
  _idempotencyKey: string,
  signal?: AbortSignal,
): Promise<OwnerSubmission> {
  await delay(240, signal);
  const id = `sub-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  const nowIso = new Date().toISOString();
  const submission: OwnerSubmission = {
    id,
    title: title.trim(),
    description: description.trim(),
    state: "uploading",
    version: 1,
    cover_url: null,
    duration_ms: null,
    created_at: nowIso,
    updated_at: nowIso,
    published_at: null,
    upload: null,
    processing: null,
    error: null,
  };
  ownerSubmissions.set(id, submission);
  return structuredClone(submission);
}

// U01：创建分片上传会话
export async function mockCreateUploadSession(
  submissionId: string,
  payload: {
    file_name: string;
    file_size: number;
    file_sha256: string;
    part_hashes: string[];
  },
  _idempotencyKey: string,
  signal?: AbortSignal,
): Promise<UploadSession> {
  await delay(260, signal);
  const sub = ownerSubmissions.get(submissionId);
  if (!sub) {
    throw new MockUploadError("NOT_FOUND", "投稿不存在", 404, false);
  }
  const parts = buildParts(payload.file_size, 0, payload.part_hashes);
  const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
  const session: UploadSession = {
    id: `upl-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    submission_id: submissionId,
    state: "uploading",
    file_name: payload.file_name,
    expected_size: payload.file_size,
    file_sha256: payload.file_sha256,
    part_size: PART_SIZE_BYTES,
    part_count: parts.length,
    expires_at: expiresAt,
    parts,
    error: null,
  };

  uploadSessions.set(session.id, session);
  sub.upload = {
    id: session.id,
    state: "uploading",
    expected_size: session.expected_size,
    confirmed_bytes: 0,
    expires_at: expiresAt,
  };
  return structuredClone(session);
}

// U05：恢复上传会话（校验 file_size + file_sha256）
export async function mockResumeUploadSession(
  uploadId: string,
  payload: { file_size: number; file_sha256: string },
  signal?: AbortSignal,
): Promise<UploadSession> {
  await delay(280, signal);
  const session = uploadSessions.get(uploadId);
  if (!session) {
    throw new MockUploadError("NOT_FOUND", "上传会话不存在", 404, false);
  }
  if (session.state === "expired") {
    throw new MockUploadError(
      "UPLOAD_EXPIRED",
      "上传会话已过期，请重新新建投稿。",
      410,
      false,
    );
  }
  if (
    session.expected_size !== payload.file_size ||
    session.file_sha256 !== payload.file_sha256
  ) {
    throw new MockUploadError(
      "UPLOAD_FILE_MISMATCH",
      "请选择原来的视频文件（文件大小或内容校验值与原上传会话不一致）。",
      409,
      false,
    );
  }
  return structuredClone(session);
}

// U03 + S3 PUT + U04：模拟单个分片签名、直传与服务端对账
export async function mockUploadAndConfirmPart(
  uploadId: string,
  partNumber: number,
  signal?: AbortSignal,
): Promise<UploadSession> {
  // 模拟真实网络上传耗时（380ms - 680ms）
  const simulatedMs = 380 + Math.floor(Math.random() * 300);
  await delay(simulatedMs, signal);

  const session = uploadSessions.get(uploadId);
  if (!session) {
    throw new MockUploadError("NOT_FOUND", "上传会话不存在", 404, false);
  }
  const target = session.parts.find((p) => p.part_number === partNumber);
  if (target) {
    target.uploaded = true;
    target.etag = `"etag-${uploadId}-p${partNumber}"`;
  }

  const confirmedBytes = session.parts
    .filter((p) => p.uploaded)
    .reduce((sum, p) => sum + p.size_bytes, 0);

  const sub = ownerSubmissions.get(session.submission_id);
  if (sub && sub.upload) {
    sub.upload.confirmed_bytes = confirmedBytes;
  }

  return structuredClone(session);
}

// U06：完成上传并确认进入 processing
export async function mockCompleteUpload(
  uploadId: string,
  signal?: AbortSignal,
): Promise<{ submission: OwnerSubmission; upload: UploadSession }> {
  await delay(520, signal);
  const session = uploadSessions.get(uploadId);
  if (!session) {
    throw new MockUploadError("NOT_FOUND", "上传会话不存在", 404, false);
  }
  const sub = ownerSubmissions.get(session.submission_id);
  if (!sub) {
    throw new MockUploadError("NOT_FOUND", "投稿不存在", 404, false);
  }

  session.state = "completed";
  sub.state = "processing";
  sub.updated_at = new Date().toISOString();
  if (sub.upload) {
    sub.upload.state = "completed";
    sub.upload.confirmed_bytes = session.expected_size;
  }
  sub.processing = {
    stage: "probing",
    target_qualities: [360, 720, 1080],
    completed_qualities: [],
    current_quality: null,
    can_retry: false,
    next_retry_at: null,
  };

  return {
    submission: structuredClone(sub),
    upload: structuredClone(session),
  };
}
