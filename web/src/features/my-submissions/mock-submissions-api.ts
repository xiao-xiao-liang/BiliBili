import { MOCK_SUBMISSIONS } from "@/lib/mock-data";
import type {
  ListResponse,
  OwnerSubmission,
  SubmissionState,
} from "@/lib/types";

export class MockSubmissionApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const delay = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 3600 * 1000).toISOString();
const daysAgo = (d: number) =>
  new Date(Date.now() - d * 86400 * 1000).toISOString();
const daysFromNow = (d: number) =>
  new Date(Date.now() + d * 86400 * 1000).toISOString();

const FALLBACK_PUBLISHED_COVER =
  MOCK_SUBMISSIONS[0]?.cover_url ?? "";

function formatEtag(sub: OwnerSubmission): string {
  return `"submission:${sub.id}:v${sub.version}"`;
}

function buildInitialOwnerSubmissions(): OwnerSubmission[] {
  const pub1 = MOCK_SUBMISSIONS[0];
  const pub2 = MOCK_SUBMISSIONS[7]; // 胶片暗房初体验
  const pub3 = MOCK_SUBMISSIONS[1]; // 京都雨夜漫步

  return [
    // 1. 处理中（轮询会自动推进 720p -> 1080p -> packaging -> published）
    {
      id: "sub-proc-1",
      title: "Go 并发实战：Worker Pool 与优雅停机",
      description:
        "结合 MONO 视频转码 Worker 演示 Go 并发控制、context 取消与优雅退出最佳实践。",
      state: "processing",
      version: 1,
      cover_url: null,
      duration_ms: 812000,
      created_at: hoursAgo(0.4),
      updated_at: hoursAgo(0.1),
      published_at: null,
      upload: {
        id: "upl-proc-1",
        state: "completed",
        expected_size: 118_400_000,
        confirmed_bytes: 118_400_000,
        expires_at: daysFromNow(7),
      },
      processing: {
        stage: "transcoding",
        target_qualities: [360, 720, 1080],
        completed_qualities: [360],
        current_quality: 720,
        can_retry: false,
        next_retry_at: null,
      },
      error: null,
    },
    // 2. 上传中（可跳转 /upload?submissionId=sub-resume-active 继续上传）
    {
      id: "sub-resume-active",
      title: "HLS 分片播放原理解析与码率切换实验",
      description: "拆解 m3u8 清单结构与前端 hls.js 自适应缓冲策略。",
      state: "uploading",
      version: 1,
      cover_url: null,
      duration_ms: null,
      created_at: hoursAgo(2.2),
      updated_at: hoursAgo(1.1),
      published_at: null,
      upload: {
        id: "upl-resume-active",
        state: "uploading",
        expected_size: 134_637_158,
        confirmed_bytes: 67_108_864,
        expires_at: daysFromNow(5),
      },
      processing: null,
      error: null,
    },
    // 3. 已发布（跳转真实 Mock 详情页）
    {
      id: pub1.id,
      title: pub1.title,
      description: pub1.description,
      state: "published",
      version: 2,
      cover_url: pub1.cover_url,
      duration_ms: pub1.duration_ms,
      created_at: hoursAgo(3),
      updated_at: hoursAgo(2),
      published_at: pub1.published_at,
      upload: {
        id: "upl-pub-1",
        state: "completed",
        expected_size: 215_000_000,
        confirmed_bytes: 215_000_000,
        expires_at: daysFromNow(5),
      },
      processing: {
        stage: "published",
        target_qualities: [360, 720, 1080],
        completed_qualities: [360, 720, 1080],
        current_quality: null,
        can_retry: false,
        next_retry_at: null,
      },
      error: null,
    },
    // 4. 处理失败（可手动重试，且已保留 360p 成果）
    {
      id: "sub-failed-retryable",
      title: "本地测试素材 04：多码率转码中断恢复验证",
      description: "用于验证局部转码失败时保留已完成清晰度档位并原地重试。",
      state: "failed",
      version: 1,
      cover_url: null,
      duration_ms: 485000,
      created_at: hoursAgo(6),
      updated_at: hoursAgo(5.5),
      published_at: null,
      upload: {
        id: "upl-failed-1",
        state: "completed",
        expected_size: 94_200_000,
        confirmed_bytes: 94_200_000,
        expires_at: daysFromNow(6),
      },
      processing: {
        stage: "transcoding",
        target_qualities: [360, 720, 1080],
        completed_qualities: [360],
        current_quality: null,
        can_retry: true,
        next_retry_at: null,
      },
      error: {
        code: "TRANSCODE_FAILED",
        message: "转码 720p 时发生临时处理异常，可点击重试继续处理",
        retryable: true,
      },
    },
    // 5. 处理失败（不可重试：媒体格式不合规）
    {
      id: "sub-failed-fatal",
      title: "HEVC 10-bit 原片测试（不支持的编码）",
      description: "测试服务端 ffprobe 拒绝非 H.264 编码时的不可重试反馈。",
      state: "failed",
      version: 1,
      cover_url: null,
      duration_ms: null,
      created_at: daysAgo(1),
      updated_at: daysAgo(1),
      published_at: null,
      upload: {
        id: "upl-failed-2",
        state: "completed",
        expected_size: 62_500_000,
        confirmed_bytes: 62_500_000,
        expires_at: daysFromNow(5),
      },
      processing: {
        stage: "probing",
        target_qualities: [],
        completed_qualities: [],
        current_quality: null,
        can_retry: false,
        next_retry_at: null,
      },
      error: {
        code: "INVALID_MEDIA",
        message:
          "媒体校验未通过：当前仅支持 MP4 (H.264 / AAC) 横屏视频，请重新导出后投稿",
        retryable: false,
      },
    },
    // 6. 上传已过期（不可编辑、不可继续上传，仅支持删除）
    {
      id: "sub-resume-expired",
      title: "旧版 FFmpeg 转码压测记录",
      description: "",
      state: "expired",
      version: 1,
      cover_url: null,
      duration_ms: null,
      created_at: daysAgo(9),
      updated_at: daysAgo(2),
      published_at: null,
      upload: {
        id: "upl-resume-expired",
        state: "expired",
        expected_size: 67_108_864,
        confirmed_bytes: 25_165_824,
        expires_at: daysAgo(2),
      },
      processing: null,
      error: {
        code: "UPLOAD_EXPIRED",
        message: "上传会话已超过 7 天未活动并过期清理",
        retryable: false,
      },
    },
    // 7. 第二页：已发布
    {
      id: pub2.id,
      title: pub2.title,
      description: pub2.description,
      state: "published",
      version: 1,
      cover_url: pub2.cover_url,
      duration_ms: pub2.duration_ms,
      created_at: daysAgo(4),
      updated_at: daysAgo(4),
      published_at: pub2.published_at,
      upload: {
        id: "upl-pub-2",
        state: "completed",
        expected_size: 168_000_000,
        confirmed_bytes: 168_000_000,
        expires_at: daysFromNow(3),
      },
      processing: {
        stage: "published",
        target_qualities: [360, 720, 1080],
        completed_qualities: [360, 720, 1080],
        current_quality: null,
        can_retry: false,
        next_retry_at: null,
      },
      error: null,
    },
    // 8. 第二页：已发布
    {
      id: pub3.id,
      title: pub3.title,
      description: pub3.description,
      state: "published",
      version: 1,
      cover_url: pub3.cover_url,
      duration_ms: pub3.duration_ms,
      created_at: daysAgo(5),
      updated_at: daysAgo(5),
      published_at: pub3.published_at,
      upload: {
        id: "upl-pub-3",
        state: "completed",
        expected_size: 310_000_000,
        confirmed_bytes: 310_000_000,
        expires_at: daysFromNow(2),
      },
      processing: {
        stage: "published",
        target_qualities: [360, 720, 1080],
        completed_qualities: [360, 720, 1080],
        current_quality: null,
        can_retry: false,
        next_retry_at: null,
      },
      error: null,
    },
    // 9. 第二页：带自动重试时间的失败项
    {
      id: "sub-failed-auto-retry",
      title: "RustFS 对象存储并发写入压测录屏",
      description: "记录单机 Docker 环境下 RustFS 多路分片写入延迟。",
      state: "failed",
      version: 1,
      cover_url: null,
      duration_ms: 532000,
      created_at: daysAgo(6),
      updated_at: hoursAgo(0.5),
      published_at: null,
      upload: {
        id: "upl-failed-3",
        state: "completed",
        expected_size: 142_000_000,
        confirmed_bytes: 142_000_000,
        expires_at: daysFromNow(1),
      },
      processing: {
        stage: "transcoding",
        target_qualities: [360, 720],
        completed_qualities: [360],
        current_quality: null,
        can_retry: true,
        next_retry_at: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
      },
      error: {
        code: "STORAGE_TIMEOUT",
        message: "转码结果写入对象存储超时，系统将自动重试或可立即手动重试",
        retryable: true,
      },
    },
  ];
}

let store: OwnerSubmission[] = buildInitialOwnerSubmissions();

/**
 * 每次轮询推进一次 processing 条目的模拟转码进度（360p -> 720p -> 1080p -> packaging -> published）
 */
export function advanceProcessingProgress(): void {
  const nowIso = new Date().toISOString();
  store = store.map((item) => {
    if (item.state !== "processing" || !item.processing) return item;

    const proc = item.processing;
    const completed = [...proc.completed_qualities];

    // 若当前有正在转码的清晰度，将其标记为已完成
    if (
      proc.current_quality !== null &&
      !completed.includes(proc.current_quality)
    ) {
      completed.push(proc.current_quality);
    }

    const nextPending = proc.target_qualities.find(
      (q) => !completed.includes(q),
    );

    if (nextPending !== undefined) {
      return {
        ...item,
        updated_at: nowIso,
        processing: {
          ...proc,
          stage: "transcoding",
          completed_qualities: completed,
          current_quality: nextPending,
        },
      };
    }

    // 全部清晰度完成后先进入 packaging，下一次轮询自动发布
    if (proc.stage !== "packaging") {
      return {
        ...item,
        updated_at: nowIso,
        processing: {
          ...proc,
          stage: "packaging",
          completed_qualities: completed,
          current_quality: null,
        },
      };
    }

    // 正式自动发布
    return {
      ...item,
      state: "published",
      cover_url: item.cover_url ?? FALLBACK_PUBLISHED_COVER,
      duration_ms: item.duration_ms ?? 615000,
      updated_at: nowIso,
      published_at: nowIso,
      processing: {
        ...proc,
        stage: "published",
        completed_qualities: completed,
        current_quality: null,
        can_retry: false,
      },
    };
  });
}

// S02: GET /api/v1/me/submissions
export async function mockFetchMySubmissions(params?: {
  state?: SubmissionState | "all";
  cursor?: string | null;
  limit?: number;
  isPoll?: boolean;
}): Promise<ListResponse<OwnerSubmission>> {
  if (!params?.isPoll) {
    await delay(200);
  } else {
    advanceProcessingProgress();
  }

  const limit = params?.limit ?? 6;
  const offset = params?.cursor ? Number.parseInt(params.cursor, 10) || 0 : 0;

  const filtered =
    params?.state && params.state !== "all"
      ? store.filter((s) => s.state === params.state)
      : store;

  const sorted = [...filtered].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const items = sorted.slice(offset, offset + limit).map((s) => structuredClone(s));
  const nextOffset = offset + items.length;

  return {
    items,
    next_cursor: nextOffset < sorted.length ? String(nextOffset) : null,
  };
}

// S03: GET /api/v1/me/submissions/{id}（返回 OwnerSubmission + ETag）
export async function mockFetchOwnerSubmission(
  id: string,
): Promise<{ submission: OwnerSubmission; etag: string }> {
  await delay(160);
  const found = store.find((s) => s.id === id);
  if (!found) {
    throw new MockSubmissionApiError("NOT_FOUND", "投稿不存在", 404);
  }
  return {
    submission: structuredClone(found),
    etag: formatEtag(found),
  };
}

// 辅助演示：在服务端侧模拟其他标签页修改了资料（使当前弹窗的 ETag 过期）
export function mockBumpSubmissionVersion(id: string): void {
  store = store.map((s) => {
    if (s.id !== id) return s;
    return {
      ...s,
      version: s.version + 1,
      title: s.title.includes("[远端已更新]")
        ? s.title
        : `${s.title} [远端已更新]`,
      updated_at: new Date().toISOString(),
    };
  });
}

// S04: PATCH /api/v1/submissions/{id}（携带 If-Match，支持 412 VERSION_CONFLICT）
export async function mockUpdateSubmission(
  id: string,
  payload: { title: string; description: string },
  ifMatch: string,
): Promise<{ submission: OwnerSubmission; etag: string }> {
  await delay(220);
  const idx = store.findIndex((s) => s.id === id);
  if (idx === -1) {
    throw new MockSubmissionApiError("NOT_FOUND", "投稿不存在", 404);
  }
  const current = store[idx];
  if (current.state === "expired") {
    throw new MockSubmissionApiError(
      "INVALID_STATE",
      "已过期的投稿不可编辑资料",
      409,
    );
  }
  const currentEtag = formatEtag(current);
  if (ifMatch !== currentEtag) {
    throw new MockSubmissionApiError(
      "VERSION_CONFLICT",
      "该投稿资料已在其他窗口被修改，已为您加载最新版本，请确认后再保存。",
      412,
    );
  }

  const trimmedTitle = payload.title.trim();
  if (trimmedTitle.length < 1 || trimmedTitle.length > 100) {
    throw new MockSubmissionApiError(
      "INVALID_ARGUMENT",
      "标题长度需在 1～100 字符之间",
      400,
    );
  }

  const updated: OwnerSubmission = {
    ...current,
    title: trimmedTitle,
    description: payload.description.trim(),
    version: current.version + 1,
    updated_at: new Date().toISOString(),
  };
  store[idx] = updated;

  return {
    submission: structuredClone(updated),
    etag: formatEtag(updated),
  };
}

// P06: POST /api/v1/submissions/{id}/retry（保留已有已完成清晰度，原地切回 processing）
export async function mockRetrySubmission(
  id: string,
  _idempotencyKey: string,
): Promise<OwnerSubmission> {
  await delay(240);
  const idx = store.findIndex((s) => s.id === id);
  if (idx === -1) {
    throw new MockSubmissionApiError("NOT_FOUND", "投稿不存在", 404);
  }
  const current = store[idx];
  if (current.state !== "failed" || !current.processing?.can_retry) {
    throw new MockSubmissionApiError(
      "NOT_RETRYABLE",
      "当前投稿状态不支持重试处理",
      409,
    );
  }

  const completed = current.processing.completed_qualities;
  const nextQuality =
    current.processing.target_qualities.find((q) => !completed.includes(q)) ??
    null;

  const updated: OwnerSubmission = {
    ...current,
    state: "processing",
    updated_at: new Date().toISOString(),
    error: null,
    processing: {
      ...current.processing,
      stage: "transcoding",
      current_quality: nextQuality,
      can_retry: false,
      next_retry_at: null,
    },
  };
  store[idx] = updated;
  return structuredClone(updated);
}

// S05: DELETE /api/v1/submissions/{id}
export async function mockDeleteSubmission(id: string): Promise<void> {
  await delay(200);
  store = store.filter((s) => s.id !== id);
}

// 重置 Mock 数据（方便本地多次演示）
export function resetMockOwnerSubmissions(): void {
  store = buildInitialOwnerSubmissions();
}
