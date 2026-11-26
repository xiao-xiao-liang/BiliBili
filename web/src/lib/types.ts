// 对齐 docs/specs/api-contract.md §2 公共 DTO（snake_case）

export interface User {
  id: string;
  username: string;
  created_at: string;
}

export interface SafeError {
  code: string;
  message: string;
  retryable: boolean;
}

export type SubmissionState =
  | "uploading"
  | "processing"
  | "published"
  | "failed"
  | "expired";

export type UploadState =
  | "creating"
  | "uploading"
  | "completing"
  | "completed"
  | "expired"
  | "failed";

export interface UploadSummary {
  id: string;
  state: UploadState;
  expected_size: number;
  confirmed_bytes: number;
  expires_at: string;
}

export interface ProcessingSummary {
  stage: string | null;
  target_qualities: number[];
  completed_qualities: number[];
  current_quality: number | null;
  can_retry: boolean;
  next_retry_at: string | null;
}

export interface PartStatus {
  part_number: number;
  size_bytes: number;
  sha256: string;
  etag: string | null;
  uploaded: boolean;
}

export interface UploadSession {
  id: string;
  submission_id: string;
  state: UploadState;
  file_name: string;
  expected_size: number;
  file_sha256: string;
  part_size: number;
  part_count: number;
  expires_at: string;
  parts: PartStatus[];
  error: SafeError | null;
}

export interface LocalUploadResume {
  submissionId: string;
  uploadId: string;
  title: string;
  fileName: string;
  expectedSize: number;
  confirmedBytes: number;
  idempotencyKey: string;
}

export interface OwnerSubmission {
  id: string;
  title: string;
  description: string;
  state: SubmissionState;
  version: number;
  cover_url: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  upload: UploadSummary | null;
  processing: ProcessingSummary | null;
  error: SafeError | null;
}

export interface PublicSubmission {
  id: string;
  title: string;
  description: string;
  author: User;
  cover_url: string;
  duration_ms: number;
  width: number;
  height: number;
  qualities: number[];
  published_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

export interface PlaybackQuality {
  height: number;
  width: number;
}

export interface PlaybackInfo {
  manifest_url: string;
  qualities: PlaybackQuality[];
  duration_ms: number;
  danmaku_snapshot_at: string;
}

export interface Comment {
  id: string;
  submission_id: string;
  author: User;
  body: string;
  created_at: string;
  can_delete: boolean;
}

export interface Danmaku {
  id: string;
  position_ms: number;
  body: string;
  created_at: string;
}

export interface ListResponse<T> {
  items: T[];
  next_cursor: string | null;
}
