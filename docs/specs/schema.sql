-- 视频社区 v0.1 结构设计草案；供评审，不是已执行的迁移。
-- 所有 UUID 由应用生成。时间由应用/数据库写入 UTC timestamptz。
-- 分阶段引入：M1 users/submissions/idempotency_records；
-- M2 media_objects/upload_sessions/upload_parts/jobs/job_attempts/outbox_events；
-- M3 media_variants 与 submissions 媒体字段；M4 likes/comments/danmaku。
BEGIN;

CREATE TABLE users (
  id uuid PRIMARY KEY,
  username varchar(32) COLLATE "C" NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (username ~ '^[A-Za-z0-9_]{3,32}$')
);

CREATE TABLE submissions (
  id uuid PRIMARY KEY,
  author_id uuid NOT NULL REFERENCES users(id),
  title varchar(100) NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 100),
  description varchar(2000) NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'uploading'
    CHECK (state IN ('uploading','processing','published','failed','expired','deleted')),
  processing_stage text CHECK (processing_stage IN ('verifying','queued','probing','covering','transcoding','finalizing')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  media_generation bigint NOT NULL DEFAULT 1 CHECK (media_generation > 0),
  process_cycle integer NOT NULL DEFAULT 1 CHECK (process_cycle > 0),
  source_media_id uuid,
  cover_media_id uuid,
  source_verified_at timestamptz,
  duration_ms bigint CHECK (duration_ms > 0 AND duration_ms <= 1800000),
  width integer CHECK (width > 0),
  height integer CHECK (height BETWEEN 360 AND 1080),
  frame_rate numeric(10,3) CHECK (frame_rate > 0),
  video_codec text,
  audio_codec text,
  error_code text,
  error_message text,
  retryable boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (state <> 'published' OR (published_at IS NOT NULL AND source_verified_at IS NOT NULL
    AND source_media_id IS NOT NULL AND cover_media_id IS NOT NULL AND duration_ms IS NOT NULL)),
  CHECK ((state = 'deleted') = (deleted_at IS NOT NULL))
);
CREATE INDEX submissions_public_feed ON submissions(published_at DESC, id DESC) WHERE state = 'published';
CREATE INDEX submissions_author_list ON submissions(author_id, created_at DESC, id DESC) WHERE state <> 'deleted';
CREATE INDEX submissions_uploading_age ON submissions(created_at) WHERE state = 'uploading';

CREATE TABLE idempotency_records (
  actor_id uuid NOT NULL REFERENCES users(id),
  scope text NOT NULL,
  idempotency_key uuid NOT NULL,
  request_sha256 char(64) NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  response_status smallint NOT NULL CHECK (response_status BETWEEN 200 AND 299),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (actor_id, scope, idempotency_key),
  CHECK (expires_at > created_at)
);
CREATE INDEX idempotency_expiry ON idempotency_records(expires_at);

CREATE TABLE media_objects (
  id uuid PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES submissions(id),
  kind text NOT NULL CHECK (kind IN ('source','cover','playlist','segment')),
  quality_height integer CHECK (quality_height IN (360,720,1080)),
  media_generation bigint NOT NULL CHECK (media_generation > 0),
  job_id uuid,
  attempt_token uuid,
  bucket text NOT NULL DEFAULT 'bili-media',
  object_key text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'staging' CHECK (state IN ('staging','ready','cleanup_pending','deleted')),
  content_type text NOT NULL,
  size_bytes bigint CHECK (size_bytes >= 0),
  sha256 char(64) CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  etag text,
  created_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  deleted_at timestamptz,
  CHECK ((kind IN ('playlist','segment')) = (quality_height IS NOT NULL)),
  CHECK (state <> 'ready' OR (ready_at IS NOT NULL AND size_bytes IS NOT NULL AND size_bytes > 0)),
  CHECK ((state = 'deleted') = (deleted_at IS NOT NULL))
);
CREATE INDEX media_submission ON media_objects(submission_id, state);
CREATE INDEX media_staging_age ON media_objects(created_at) WHERE state IN ('staging','cleanup_pending');
ALTER TABLE submissions ADD CONSTRAINT submission_source_fk FOREIGN KEY (source_media_id) REFERENCES media_objects(id);
ALTER TABLE submissions ADD CONSTRAINT submission_cover_fk FOREIGN KEY (cover_media_id) REFERENCES media_objects(id);

CREATE TABLE upload_sessions (
  id uuid PRIMARY KEY,
  submission_id uuid NOT NULL UNIQUE REFERENCES submissions(id),
  source_media_id uuid NOT NULL UNIQUE REFERENCES media_objects(id),
  file_name varchar(255) NOT NULL,
  expected_size bigint NOT NULL CHECK (expected_size BETWEEN 1 AND 1000000000),
  file_sha256 char(64) NOT NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  part_size integer NOT NULL DEFAULT 8388608 CHECK (part_size = 8388608),
  part_count integer NOT NULL CHECK (part_count BETWEEN 1 AND 120),
  multipart_upload_id text,
  operation_token uuid,
  operation_expires_at timestamptz,
  state text NOT NULL DEFAULT 'creating'
    CHECK (state IN ('creating','uploading','completing','completed','failed','expired','aborted')),
  error_code text,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (part_count = (expected_size + part_size - 1) / part_size),
  CHECK (expires_at > last_activity_at),
  CHECK ((operation_token IS NULL) = (operation_expires_at IS NULL)),
  CHECK (state NOT IN ('uploading','completing','completed') OR multipart_upload_id IS NOT NULL),
  CHECK (state <> 'completed' OR completed_at IS NOT NULL)
);
CREATE INDEX uploads_expiry ON upload_sessions(expires_at) WHERE state IN ('creating','uploading','completing');

CREATE TABLE upload_parts (
  upload_id uuid NOT NULL REFERENCES upload_sessions(id),
  part_number integer NOT NULL CHECK (part_number BETWEEN 1 AND 120),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 8388608),
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  etag text,
  confirmed_at timestamptz,
  PRIMARY KEY (upload_id, part_number),
  CHECK ((etag IS NULL) = (confirmed_at IS NULL))
);

CREATE TABLE jobs (
  id uuid PRIMARY KEY,
  submission_id uuid REFERENCES submissions(id),
  kind text NOT NULL CHECK (kind IN ('verify_source','probe','cover','transcode','cleanup')),
  target_key text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  media_generation bigint NOT NULL CHECK (media_generation > 0),
  cycle integer NOT NULL DEFAULT 1 CHECK (cycle > 0),
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','running','retry_wait','succeeded','failed','cancelled')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer CHECK (max_attempts > 0),
  dispatch_seq bigint NOT NULL DEFAULT 1 CHECK (dispatch_seq > 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  lease_token uuid,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  available_at timestamptz NOT NULL DEFAULT now(),
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CHECK ((state = 'running') = (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CHECK ((lease_token IS NULL) = (lease_expires_at IS NULL)),
  CHECK ((kind = 'cleanup' AND max_attempts IS NULL)
    OR (kind <> 'cleanup' AND submission_id IS NOT NULL AND max_attempts IS NOT NULL AND max_attempts = 4))
);
CREATE INDEX jobs_submission ON jobs(submission_id, created_at DESC);
CREATE INDEX jobs_due ON jobs(available_at) WHERE state IN ('queued','retry_wait');
CREATE INDEX jobs_expired_lease ON jobs(lease_expires_at) WHERE state = 'running';
ALTER TABLE media_objects ADD CONSTRAINT media_job_fk FOREIGN KEY (job_id) REFERENCES jobs(id);

CREATE TABLE job_attempts (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id),
  attempt_no integer NOT NULL CHECK (attempt_no > 0),
  lease_token uuid NOT NULL UNIQUE,
  state text NOT NULL CHECK (state IN ('running','succeeded','failed','lost','cancelled')),
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  error_code text,
  error_message text,
  UNIQUE (job_id, attempt_no)
);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id),
  dispatch_seq bigint NOT NULL CHECK (dispatch_seq > 0),
  event_type text NOT NULL DEFAULT 'job.available.v1' CHECK (event_type = 'job.available.v1'),
  routing_key text NOT NULL CHECK (routing_key IN ('processing','cleanup')),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  correlation_id uuid NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  publish_attempts integer NOT NULL DEFAULT 0 CHECK (publish_attempts >= 0),
  lease_token uuid,
  lease_expires_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, dispatch_seq),
  CHECK ((lease_token IS NULL) = (lease_expires_at IS NULL))
);
CREATE INDEX outbox_pending ON outbox_events(available_at, created_at) WHERE sent_at IS NULL;

CREATE TABLE media_variants (
  submission_id uuid NOT NULL REFERENCES submissions(id),
  quality_height integer NOT NULL CHECK (quality_height IN (360,720,1080)),
  media_generation bigint NOT NULL CHECK (media_generation > 0),
  target_width integer NOT NULL CHECK (target_width > 0 AND target_width % 2 = 0),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','running','ready','failed')),
  playlist_media_id uuid REFERENCES media_objects(id),
  duration_ms bigint CHECK (duration_ms > 0),
  bandwidth_bps bigint CHECK (bandwidth_bps > 0),
  codec_string text,
  last_job_id uuid REFERENCES jobs(id),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (submission_id, quality_height),
  CHECK (state <> 'ready' OR (playlist_media_id IS NOT NULL AND duration_ms IS NOT NULL
    AND bandwidth_bps IS NOT NULL))
);

CREATE TABLE likes (
  submission_id uuid NOT NULL REFERENCES submissions(id),
  user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (submission_id, user_id)
);

CREATE TABLE comments (
  id uuid PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES submissions(id),
  author_id uuid NOT NULL REFERENCES users(id),
  body varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK ((deleted_at IS NULL AND body IS NOT NULL AND char_length(btrim(body)) BETWEEN 1 AND 1000)
    OR (deleted_at IS NOT NULL AND body IS NULL))
);
CREATE INDEX comments_feed ON comments(submission_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;

CREATE TABLE danmaku (
  id uuid PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES submissions(id),
  author_id uuid NOT NULL REFERENCES users(id),
  position_ms integer NOT NULL CHECK (position_ms >= 0),
  body varchar(100) NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX danmaku_timeline ON danmaku(submission_id, position_ms, id);

COMMIT;
