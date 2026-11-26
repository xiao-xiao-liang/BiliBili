import { useEffect, useRef, useState } from "react";
import type { Danmaku } from "@/lib/types";

interface DanmakuLayerProps {
  items: Danmaku[];
  currentTimeMs: number;
  isPlaying: boolean;
  enabled: boolean;
  seekVersion: number;
  immediateItem: Danmaku | null;
}

interface ActiveDanmaku {
  key: string;
  id: string;
  body: string;
  lane: number;
  durationMs: number;
  isSelf?: boolean;
}

const LANE_COUNT = 7;
const LANE_HEIGHT = 34;
const BASE_DURATION_MS = 8500;

export function DanmakuLayer({
  items,
  currentTimeMs,
  isPlaying,
  enabled,
  seekVersion,
  immediateItem,
}: DanmakuLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1080);
  const [activeItems, setActiveItems] = useState<ActiveDanmaku[]>([]);

  const lastTimeRef = useRef<number>(currentTimeMs);
  const spawnedIdsRef = useRef<Set<string>>(new Set());
  const laneFreeAtRef = useRef<number[]>(Array(LANE_COUNT).fill(0));
  const lastImmediateIdRef = useRef<string | null>(null);

  // 追踪容器宽度用于平滑滚出左侧边缘
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      if (el.clientWidth > 0) setContainerWidth(el.clientWidth);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 拖动进度条或关闭弹幕时清空屏幕并重置状态
  useEffect(() => {
    setActiveItems([]);
    spawnedIdsRef.current.clear();
    laneFreeAtRef.current = Array(LANE_COUNT).fill(0);
    lastTimeRef.current = currentTimeMs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekVersion, enabled]);

  const pickLane = (now: number): number => {
    let bestLane = 0;
    let earliest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < LANE_COUNT; i += 1) {
      if (laneFreeAtRef.current[i] <= now) {
        bestLane = i;
        break;
      }
      if (laneFreeAtRef.current[i] < earliest) {
        earliest = laneFreeAtRef.current[i];
        bestLane = i;
      }
    }
    laneFreeAtRef.current[bestLane] = now + 2600;
    return bestLane;
  };

  // 用户刚发送的弹幕立即在画面滚出
  useEffect(() => {
    if (!enabled || !immediateItem) return;
    if (lastImmediateIdRef.current === immediateItem.id) return;
    lastImmediateIdRef.current = immediateItem.id;
    spawnedIdsRef.current.add(immediateItem.id);

    const now = performance.now();
    const lane = pickLane(now);
    const created: ActiveDanmaku = {
      key: `self-${immediateItem.id}-${now}`,
      id: immediateItem.id,
      body: immediateItem.body,
      lane,
      durationMs: BASE_DURATION_MS,
      isSelf: true,
    };
    setActiveItems((prev) => [...prev.slice(-35), created]);
  }, [immediateItem, enabled]);

  // 随播放时间推进触发对应时间轴弹幕
  useEffect(() => {
    if (!enabled || !isPlaying) {
      lastTimeRef.current = currentTimeMs;
      return;
    }

    const prevTime = lastTimeRef.current;
    lastTimeRef.current = currentTimeMs;

    // 正常前进窗口（避免大跨度跳转一次刷屏）
    if (currentTimeMs < prevTime || currentTimeMs - prevTime > 3000) {
      return;
    }

    const due = items.filter(
      (d) =>
        d.position_ms >= prevTime &&
        d.position_ms <= currentTimeMs &&
        !spawnedIdsRef.current.has(d.id),
    );

    if (due.length === 0) return;

    const now = performance.now();
    const spawned: ActiveDanmaku[] = due.map((d) => {
      spawnedIdsRef.current.add(d.id);
      const lane = pickLane(now);
      const extraMs = Math.min(2000, d.body.length * 45);
      return {
        key: `${d.id}-${now}`,
        id: d.id,
        body: d.body,
        lane,
        durationMs: BASE_DURATION_MS + extraMs,
      };
    });

    setActiveItems((prev) => [...prev.slice(-40), ...spawned]);
  }, [currentTimeMs, isPlaying, enabled, items]);

  if (!enabled) return null;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none"
      style={
        {
          "--danmaku-travel": `${containerWidth}px`,
        } as React.CSSProperties
      }
    >
      {activeItems.map((item) => (
        <div
          key={item.key}
          onAnimationEnd={() =>
            setActiveItems((prev) => prev.filter((x) => x.key !== item.key))
          }
          className="animate-danmaku absolute left-full whitespace-nowrap text-sm sm:text-base font-medium text-white danmaku-text will-change-transform"
          style={{
            top: `${14 + item.lane * LANE_HEIGHT}px`,
            animationDuration: `${item.durationMs}ms`,
            animationPlayState:
              item.isSelf || isPlaying ? "running" : "paused",
          }}
        >
          <span
            className={
              item.isSelf
                ? "rounded-full border border-white/80 bg-black/35 px-2.5 py-0.5"
                : undefined
            }
          >
            {item.body}
          </span>
        </div>
      ))}
    </div>
  );
}
