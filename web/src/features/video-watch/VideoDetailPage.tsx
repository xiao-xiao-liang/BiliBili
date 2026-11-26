import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Film, RefreshCw } from "lucide-react";
import { useAuth } from "@/app/providers";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createDanmaku,
  fetchDanmaku,
  fetchPlaybackInfo,
  fetchPublicSubmission,
} from "@/lib/mock-api";
import type { Danmaku, PlaybackInfo, PublicSubmission } from "@/lib/types";
import { CommentSection } from "./CommentSection";
import { DanmakuBar } from "./DanmakuBar";
import { HlsPlayer } from "./HlsPlayer";
import { VideoMeta } from "./VideoMeta";

export function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  // P02 视频详情态
  const [video, setVideo] = useState<PublicSubmission | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  // P03 播放信息独立状态
  const [playback, setPlayback] = useState<PlaybackInfo | null>(null);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // D01 / D02 弹幕独立状态
  const [danmakuItems, setDanmakuItems] = useState<Danmaku[]>([]);
  const [danmakuEnabled, setDanmakuEnabled] = useState(true);
  const [immediateDanmaku, setImmediateDanmaku] = useState<Danmaku | null>(null);
  const currentTimeMsRef = useRef<number>(0);

  const loadMeta = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      setMetaLoading(false);
      return;
    }
    setMetaLoading(true);
    setMetaError(null);
    setNotFound(false);
    try {
      const data = await fetchPublicSubmission(id, user);
      if (!data) {
        setNotFound(true);
        setVideo(null);
      } else {
        setVideo(data);
      }
    } catch {
      setMetaError("视频信息加载失败，请稍后重试。");
    } finally {
      setMetaLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const loadPlayback = useCallback(async (submissionId: string) => {
    setPlaybackLoading(true);
    setPlaybackError(null);
    try {
      const info = await fetchPlaybackInfo(submissionId);
      if (!info) {
        setPlaybackError("播放地址不可用");
      } else {
        setPlayback(info);
      }
    } catch {
      setPlaybackError("播放器初始化失败，请点击重试。");
    } finally {
      setPlaybackLoading(false);
    }
  }, []);

  const loadDanmaku = useCallback(async (submissionId: string) => {
    try {
      const list = await fetchDanmaku(submissionId);
      setDanmakuItems(list);
    } catch {
      // 弹幕加载失败不中断视频播放
    }
  }, []);

  // P02 成功后各自独立加载播放器与弹幕
  useEffect(() => {
    if (!video) return;
    void loadPlayback(video.id);
    void loadDanmaku(video.id);
  }, [video?.id, loadPlayback, loadDanmaku]);

  const handleSendDanmaku = async (body: string, idempotencyKey: string) => {
    if (!video) return;
    const created = await createDanmaku(
      video.id,
      currentTimeMsRef.current,
      body,
      idempotencyKey,
    );
    setDanmakuItems((prev) => {
      if (prev.some((item) => item.id === created.id)) return prev;
      return [...prev, created].sort((a, b) => a.position_ms - b.position_ms);
    });
    setImmediateDanmaku(created);
  };

  // 整页 404 状态卡片（P02 返回 404，终止后续请求）
  if (notFound) {
    return (
      <div className="max-w-[1120px] mx-auto px-6 py-20">
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-10 text-center">
          <Film className="mx-auto size-10 text-muted-foreground mb-3" />
          <h1 className="text-xl font-semibold tracking-tight">
            视频不存在或尚未发布
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            该链接可能已失效、视频已被作者删除或尚未完成处理。
          </p>
          <Button asChild size="sm" className="mt-6 gap-1.5">
            <Link to="/">
              <ArrowLeft className="size-4" />
              <span>返回首页</span>
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (metaLoading) {
    return (
      <div className="max-w-[1120px] mx-auto px-6 py-6">
        <Skeleton className="aspect-video w-full rounded-xl" />
        <div className="mt-5 space-y-3">
          <Skeleton className="h-7 w-2/3 rounded-md" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-56 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (metaError || !video) {
    return (
      <div className="max-w-[1120px] mx-auto px-6 py-20">
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-10 text-center">
          <AlertCircle className="mx-auto size-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">{metaError ?? "加载失败"}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadMeta()}
            className="mt-4 gap-1.5"
          >
            <RefreshCw className="size-3.5" />
            <span>重试</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1120px] mx-auto px-6 py-6 pb-16">
      {/* 一体化影院播放器 + 紧贴底部的弹幕发送条 */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        {playbackLoading || !playback ? (
          playbackError ? (
            <div className="aspect-video w-full bg-black flex flex-col items-center justify-center text-white px-6 text-center">
              <AlertCircle className="size-8 text-white/70 mb-2" />
              <p className="text-sm">{playbackError}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void loadPlayback(video.id)}
                className="mt-3 gap-1.5"
              >
                <RefreshCw className="size-3.5" />
                <span>重试播放</span>
              </Button>
            </div>
          ) : (
            <div className="aspect-video w-full bg-black flex items-center justify-center">
              <Skeleton className="h-full w-full rounded-none bg-zinc-900" />
            </div>
          )
        ) : (
          <HlsPlayer
            playback={playback}
            posterUrl={video.cover_url}
            danmakuItems={danmakuItems}
            danmakuEnabled={danmakuEnabled}
            onToggleDanmaku={() => setDanmakuEnabled((prev) => !prev)}
            immediateDanmaku={immediateDanmaku}
            onTimeUpdateMs={(ms) => {
              currentTimeMsRef.current = ms;
            }}
          />
        )}

        <DanmakuBar
          submissionId={video.id}
          enabled={danmakuEnabled}
          onToggleEnabled={setDanmakuEnabled}
          totalCount={danmakuItems.length}
          onSend={handleSendDanmaku}
        />
      </div>

      {/* 视频标题、作者信息、点赞按钮、可折叠简介 */}
      <VideoMeta
        video={video}
        onLikeUpdated={(liked, likeCount) =>
          setVideo((prev) =>
            prev
              ? { ...prev, liked_by_me: liked, like_count: likeCount }
              : prev,
          )
        }
      />

      {/* 平铺评论区（独立加载与错误隔离） */}
      <CommentSection
        submissionId={video.id}
        commentCount={video.comment_count}
        onCommentCountDelta={(delta) =>
          setVideo((prev) =>
            prev
              ? {
                  ...prev,
                  comment_count: Math.max(0, prev.comment_count + delta),
                }
              : prev,
          )
        }
      />
    </div>
  );
}
