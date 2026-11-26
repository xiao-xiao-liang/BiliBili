import {
  DEMO_CURRENT_USER,
  MOCK_SUBMISSIONS,
  getMockComments,
  getMockDanmaku,
  getMockPlayback,
} from "./mock-data";
import type {
  Comment,
  Danmaku,
  ListResponse,
  PlaybackInfo,
  PublicSubmission,
  User,
} from "./types";

/**
 * 内存态 Mock 仓储（与 docs/specs/api-contract.md 字段与行为完全对齐）
 * 后续切换真实 Go API 时，只需替换本文件内函数为 fetch('/api/v1/...')
 */
const delay = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

// 内存状态：保留用户在本次预览期间的点赞、评论、弹幕改动
const submissionState = new Map<string, PublicSubmission>(
  MOCK_SUBMISSIONS.map((s) => [s.id, { ...s }]),
);

const commentsStore = new Map<string, Comment[]>();
const danmakuStore = new Map<string, Danmaku[]>();

function ensureComments(submissionId: string, currentUser: User | null): Comment[] {
  const existing = commentsStore.get(submissionId);
  const submission = submissionState.get(submissionId);
  if (existing) {
    // 根据当前演示态动态刷新 can_delete
    return existing.map((c) => ({
      ...c,
      can_delete: Boolean(
        currentUser &&
          (currentUser.id === c.author.id ||
            currentUser.id === submission?.author.id),
      ),
    }));
  }
  const initial = getMockComments(submissionId, currentUser);
  commentsStore.set(submissionId, initial);
  return initial;
}

function ensureDanmaku(submissionId: string): Danmaku[] {
  const existing = danmakuStore.get(submissionId);
  if (existing) return existing;
  const initial = getMockDanmaku(submissionId);
  danmakuStore.set(submissionId, initial);
  return initial;
}

// P01: GET /api/v1/submissions
export async function fetchPublicSubmissions(params?: {
  cursor?: string | null;
  limit?: number;
}): Promise<ListResponse<PublicSubmission>> {
  await delay(260);
  const limit = params?.limit ?? 8;
  const offset = params?.cursor ? Number.parseInt(params.cursor, 10) || 0 : 0;

  const all = Array.from(submissionState.values()).sort(
    (a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  );

  const items = all.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  return {
    items,
    next_cursor: nextOffset < all.length ? String(nextOffset) : null,
  };
}

// P02: GET /api/v1/submissions/{id}
export async function fetchPublicSubmission(
  id: string,
  currentUser: User | null,
): Promise<PublicSubmission | null> {
  await delay(180);
  const item = submissionState.get(id);
  if (!item) return null;
  return {
    ...item,
    liked_by_me: currentUser ? item.liked_by_me : false,
  };
}

// P03: GET /api/v1/submissions/{id}/playback
export async function fetchPlaybackInfo(id: string): Promise<PlaybackInfo | null> {
  await delay(160);
  const item = submissionState.get(id);
  if (!item) return null;
  return getMockPlayback(item);
}

// C01 / C02: PUT / DELETE /api/v1/submissions/{id}/like
export async function toggleSubmissionLike(
  id: string,
  shouldLike: boolean,
): Promise<{ liked: boolean; like_count: number }> {
  await delay(180);
  const item = submissionState.get(id);
  if (!item) {
    throw new Error("NOT_FOUND");
  }
  if (shouldLike && !item.liked_by_me) {
    item.liked_by_me = true;
    item.like_count += 1;
  } else if (!shouldLike && item.liked_by_me) {
    item.liked_by_me = false;
    item.like_count = Math.max(0, item.like_count - 1);
  }
  return { liked: item.liked_by_me, like_count: item.like_count };
}

// C03: GET /api/v1/submissions/{id}/comments
export async function fetchComments(
  submissionId: string,
  currentUser: User | null,
  params?: { cursor?: string | null; limit?: number },
): Promise<ListResponse<Comment>> {
  await delay(200);
  const limit = params?.limit ?? 4;
  const offset = params?.cursor ? Number.parseInt(params.cursor, 10) || 0 : 0;
  const all = ensureComments(submissionId, currentUser);
  const items = all.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  return {
    items,
    next_cursor: nextOffset < all.length ? String(nextOffset) : null,
  };
}

// C04: POST /api/v1/submissions/{id}/comments
export async function createComment(
  submissionId: string,
  body: string,
  currentUser: User,
  _idempotencyKey: string,
): Promise<Comment> {
  await delay(220);
  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 1000) {
    throw new Error("评论长度需在 1～1000 字符之间");
  }
  const comment: Comment = {
    id: `c-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    submission_id: submissionId,
    author: currentUser,
    body: trimmed,
    created_at: new Date().toISOString(),
    can_delete: true,
  };
  const list = ensureComments(submissionId, currentUser);
  commentsStore.set(submissionId, [comment, ...list]);

  const submission = submissionState.get(submissionId);
  if (submission) {
    submission.comment_count += 1;
  }
  return comment;
}

// C05: DELETE /api/v1/comments/{id}
export async function deleteComment(
  submissionId: string,
  commentId: string,
): Promise<void> {
  await delay(180);
  const list = commentsStore.get(submissionId);
  if (list) {
    const next = list.filter((c) => c.id !== commentId);
    commentsStore.set(submissionId, next);
  }
  const submission = submissionState.get(submissionId);
  if (submission) {
    submission.comment_count = Math.max(0, submission.comment_count - 1);
  }
}

// D01: GET /api/v1/submissions/{id}/danmaku
export async function fetchDanmaku(submissionId: string): Promise<Danmaku[]> {
  await delay(150);
  return [...ensureDanmaku(submissionId)].sort(
    (a, b) => a.position_ms - b.position_ms,
  );
}

// D02: POST /api/v1/submissions/{id}/danmaku
export async function createDanmaku(
  submissionId: string,
  positionMs: number,
  body: string,
  _idempotencyKey: string,
): Promise<Danmaku> {
  await delay(140);
  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 100) {
    throw new Error("弹幕长度需在 1～100 字符之间");
  }
  const item: Danmaku = {
    id: `d-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    position_ms: Math.max(0, Math.round(positionMs)),
    body: trimmed,
    created_at: new Date().toISOString(),
  };
  const list = ensureDanmaku(submissionId);
  danmakuStore.set(
    submissionId,
    [...list, item].sort((a, b) => a.position_ms - b.position_ms),
  );
  return item;
}

export { DEMO_CURRENT_USER };
