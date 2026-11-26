import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { formatDuration } from "@/lib/format";
import type { Danmaku, PlaybackInfo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DanmakuLayer } from "./DanmakuLayer";

interface HlsPlayerProps {
  playback: PlaybackInfo;
  posterUrl: string;
  danmakuItems: Danmaku[];
  danmakuEnabled: boolean;
  onToggleDanmaku: () => void;
  immediateDanmaku: Danmaku | null;
  onTimeUpdateMs: (ms: number) => void;
}

type QualityChoice = "auto" | number;

export function HlsPlayer({
  playback,
  posterUrl,
  danmakuItems,
  danmakuEnabled,
  onToggleDanmaku,
  immediateDanmaku,
  onTimeUpdateMs,
}: HlsPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const simFrameRef = useRef<number | null>(null);
  const simLastTickRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(playback.duration_ms);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<QualityChoice>("auto");
  const [seekVersion, setSeekVersion] = useState(0);

  // 进度条 hover 预览时间
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);

  const availableQualities = [...playback.qualities]
    .map((q) => q.height)
    .sort((a, b) => b - a);

  const syncTime = useCallback(
    (ms: number) => {
      setCurrentTimeMs(ms);
      onTimeUpdateMs(ms);
    },
    [onTimeUpdateMs],
  );

  // 初始化 hls.js；若网络/外链流不可达则平滑降级至本地模拟播放，保证全功能可交互
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsSimulated(false);
    setIsPlaying(false);
    setDurationMs(playback.duration_ms);
    syncTime(0);

    let destroyed = false;

    const enableSimulationFallback = () => {
      if (destroyed) return;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      setIsSimulated(true);
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hlsRef.current = hls;

      hls.loadSource(playback.manifest_url);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          enableSimulationFallback();
        }
      });

      return () => {
        destroyed = true;
        hls.destroy();
        hlsRef.current = null;
      };
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playback.manifest_url;
      const handleError = () => enableSimulationFallback();
      video.addEventListener("error", handleError);
      return () => {
        destroyed = true;
        video.removeEventListener("error", handleError);
      };
    }

    enableSimulationFallback();
    return () => {
      destroyed = true;
    };
  }, [playback.manifest_url, playback.duration_ms, syncTime]);

  // 绑定原生 video 事件（非模拟模式）
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isSimulated) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => syncTime(video.currentTime * 1000);
    const onLoadedMetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setDurationMs(video.duration * 1000);
      }
    };
    const onEnded = () => setIsPlaying(false);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("ended", onEnded);
    };
  }, [isSimulated, syncTime]);

  // 同步音量与静音
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted]);

  // 模拟播放时钟（仅在 HLS 外部流离线/受限时启用）
  useEffect(() => {
    if (!isSimulated || !isPlaying) {
      if (simFrameRef.current) cancelAnimationFrame(simFrameRef.current);
      return;
    }

    simLastTickRef.current = performance.now();
    const tick = (now: number) => {
      const delta = now - simLastTickRef.current;
      simLastTickRef.current = now;
      setCurrentTimeMs((prev) => {
        const next = prev + delta;
        if (next >= durationMs) {
          setIsPlaying(false);
          onTimeUpdateMs(durationMs);
          return durationMs;
        }
        onTimeUpdateMs(next);
        return next;
      });
      simFrameRef.current = requestAnimationFrame(tick);
    };
    simFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (simFrameRef.current) cancelAnimationFrame(simFrameRef.current);
    };
  }, [isSimulated, isPlaying, durationMs, onTimeUpdateMs]);

  // 监听全屏状态变化
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // 控制栏 2.5 秒静止自动隐藏
  const scheduleHideControls = useCallback(() => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    setControlsVisible(true);
    if (isPlaying && !qualityMenuOpen) {
      hideTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 2500);
    }
  }, [isPlaying, qualityMenuOpen]);

  useEffect(() => {
    if (!isPlaying || qualityMenuOpen) {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      setControlsVisible(true);
    } else {
      scheduleHideControls();
    }
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [isPlaying, qualityMenuOpen, scheduleHideControls]);

  const togglePlay = useCallback(() => {
    if (isSimulated) {
      setIsPlaying((prev) => {
        if (!prev && currentTimeMs >= durationMs) {
          syncTime(0);
          setSeekVersion((v) => v + 1);
        }
        return !prev;
      });
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => {
        // 若浏览器阻止播放或外链失败，平滑切换模拟播放
        setIsSimulated(true);
        setIsPlaying(true);
      });
    } else {
      video.pause();
    }
  }, [isSimulated, currentTimeMs, durationMs, syncTime]);

  const handleSeek = (ratio: number) => {
    const clamped = Math.max(0, Math.min(1, ratio));
    const targetMs = clamped * durationMs;
    if (!isSimulated && videoRef.current) {
      videoRef.current.currentTime = targetMs / 1000;
    }
    syncTime(targetMs);
    setSeekVersion((v) => v + 1);
  };

  const handleQualityChange = (choice: QualityChoice) => {
    setSelectedQuality(choice);
    setQualityMenuOpen(false);

    const hls = hlsRef.current;
    if (hls && hls.levels.length > 0) {
      if (choice === "auto") {
        hls.currentLevel = -1;
      } else {
        // 寻找最接近目标高度的 HLS 档位
        let bestIdx = 0;
        let minDiff = Number.POSITIVE_INFINITY;
        hls.levels.forEach((lvl, idx) => {
          const diff = Math.abs(lvl.height - choice);
          if (diff < minDiff) {
            minDiff = diff;
            bestIdx = idx;
          }
        });
        hls.currentLevel = bestIdx;
      }
    }

    toast.success(
      choice === "auto" ? "清晰度已切换为自动" : `清晰度已切换为 ${choice}p`,
    );
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      toast.error("当前浏览器不支持全屏模式");
    }
  };

  const progressPercent =
    durationMs > 0 ? Math.min(100, (currentTimeMs / durationMs) * 100) : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={scheduleHideControls}
      onMouseLeave={() => {
        if (isPlaying && !qualityMenuOpen) setControlsVisible(false);
      }}
      className="relative aspect-video w-full bg-black select-none overflow-hidden"
    >
      {/* 视频本体 */}
      <video
        ref={videoRef}
        poster={posterUrl}
        playsInline
        onClick={togglePlay}
        className={cn(
          "h-full w-full object-contain cursor-pointer",
          isSimulated && "hidden",
        )}
      />

      {/* 离线/演示模拟影院画面（仅当外链 HLS 流无法访问时自动接管） */}
      {isSimulated && (
        <div
          onClick={togglePlay}
          className="relative h-full w-full cursor-pointer flex items-center justify-center bg-black"
        >
          <img
            src={posterUrl}
            alt="模拟播放画面"
            className={cn(
              "h-full w-full object-cover transition-opacity duration-500",
              isPlaying ? "opacity-55" : "opacity-35",
            )}
          />
          <div className="absolute inset-0 bg-black/35 flex flex-col items-center justify-center text-white pointer-events-none">
            <span className="rounded-full border border-white/25 bg-black/50 px-3 py-1 text-xs tracking-wider uppercase backdrop-blur-xs">
              MONO 本地模拟播放 ·{" "}
              {selectedQuality === "auto" ? "自动" : `${selectedQuality}p`}
            </span>
            <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
              {formatDuration(currentTimeMs)}
            </p>
          </div>
        </div>
      )}

      {/* 弹幕滚动覆盖层 */}
      <DanmakuLayer
        items={danmakuItems}
        currentTimeMs={currentTimeMs}
        isPlaying={isPlaying}
        enabled={danmakuEnabled}
        seekVersion={seekVersion}
        immediateItem={immediateDanmaku}
      />

      {/* 暂停时的居中播放大按钮 */}
      {!isPlaying && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="播放视频"
          className="absolute inset-0 z-20 m-auto flex size-16 items-center justify-center rounded-full bg-black/65 text-white border border-white/20 backdrop-blur-xs transition-transform hover:scale-105 cursor-pointer"
        >
          <Play className="size-7 fill-white translate-x-0.5" />
        </button>
      )}

      {/* 底部极简自定义控制栏（渐变黑遮罩 + 2.5s 自动隐藏） */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pt-8 pb-3 transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        {/* 进度条 */}
        <div
          role="slider"
          aria-label="播放进度"
          aria-valuemin={0}
          aria-valuemax={Math.round(durationMs / 1000)}
          aria-valuenow={Math.round(currentTimeMs / 1000)}
          tabIndex={0}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(
              0,
              Math.min(1, (e.clientX - rect.left) / rect.width),
            );
            setHoverPercent(ratio * 100);
          }}
          onMouseLeave={() => setHoverPercent(null)}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            handleSeek((e.clientX - rect.left) / rect.width);
          }}
          className="group relative mb-2.5 flex h-3 cursor-pointer items-center"
        >
          {/* Hover 时间预览气泡 */}
          {hoverPercent !== null && (
            <div
              className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-black/85 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums border border-white/15"
              style={{ left: `${hoverPercent}%` }}
            >
              {formatDuration((hoverPercent / 100) * durationMs)}
            </div>
          )}

          {/* 轨道 */}
          <div className="relative h-1 w-full rounded-full bg-white/25 transition-all group-hover:h-1.5">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-transform scale-0 group-hover:scale-100"
              style={{ left: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* 控制按钮行 */}
        <div className="flex items-center justify-between gap-3 text-white">
          {/* 左：播放/暂停 + 时间 */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "暂停" : "播放"}
              className="flex size-8 items-center justify-center rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="size-4 fill-white" />
              ) : (
                <Play className="size-4 fill-white translate-x-0.5" />
              )}
            </button>

            <span className="text-xs font-medium text-white/90 tabular-nums">
              {formatDuration(currentTimeMs)} / {formatDuration(durationMs)}
            </span>
          </div>

          {/* 右：音量 + 弹幕快捷开关 + 清晰度菜单 + 全屏 */}
          <div className="flex items-center gap-2">
            {/* 音量控制 */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "取消静音" : "静音"}
                className="flex size-8 items-center justify-center rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="size-4" />
                ) : (
                  <Volume2 className="size-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const next = Number.parseFloat(e.target.value);
                  setVolume(next);
                  if (next > 0 && muted) setMuted(false);
                }}
                aria-label="音量"
                className="hidden sm:block w-16 h-1 accent-white cursor-pointer"
              />
            </div>

            {/* 弹幕快捷按钮 */}
            <button
              type="button"
              onClick={onToggleDanmaku}
              aria-label={danmakuEnabled ? "关闭弹幕" : "开启弹幕"}
              className={cn(
                "h-7 rounded-md px-2 text-xs font-medium transition-colors cursor-pointer",
                danmakuEnabled
                  ? "bg-white text-black"
                  : "bg-white/15 text-white/80 hover:bg-white/25",
              )}
            >
              弹
            </button>

            {/* 清晰度选择器 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setQualityMenuOpen((o) => !o)}
                className="h-7 rounded-md px-2.5 text-xs font-medium bg-white/15 hover:bg-white/25 transition-colors tabular-nums cursor-pointer"
              >
                {selectedQuality === "auto" ? "自动" : `${selectedQuality}p`}
              </button>

              {qualityMenuOpen && (
                <div className="absolute bottom-9 right-0 min-w-[88px] rounded-lg border border-white/15 bg-black/90 p-1 shadow-lg backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => handleQualityChange("auto")}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer",
                      selectedQuality === "auto"
                        ? "bg-white text-black font-medium"
                        : "text-white/85 hover:bg-white/15",
                    )}
                  >
                    <span>自动</span>
                  </button>
                  {availableQualities.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleQualityChange(q)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs tabular-nums transition-colors cursor-pointer",
                        selectedQuality === q
                          ? "bg-white text-black font-medium"
                          : "text-white/85 hover:bg-white/15",
                      )}
                    >
                      <span>{q}p</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 全屏按钮 */}
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-label={isFullscreen ? "退出全屏" : "全屏播放"}
              className="flex size-8 items-center justify-center rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize className="size-4" />
              ) : (
                <Maximize className="size-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
