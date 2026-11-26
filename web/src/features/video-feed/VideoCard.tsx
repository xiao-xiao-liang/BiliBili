import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import {
  formatDuration,
  formatRelativeTime,
  getAvatarInitial,
} from "@/lib/format";
import type { PublicSubmission } from "@/lib/types";

interface VideoCardProps {
  video: PublicSubmission;
}

export function VideoCard({ video }: VideoCardProps) {
  return (
    <Link
      to={`/videos/${video.id}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
    >
      {/* 16:9 封面容器（暗色模式下用微弱白边托出深色封面轮廓） */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-secondary border border-border/80 dark:border-white/12">
        <img
          src={video.cover_url}
          alt={video.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
        />
        {/* 右下角时长胶囊 */}
        <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums backdrop-blur-xs">
          {formatDuration(video.duration_ms)}
        </span>
      </div>

      {/* 卡片文本区 */}
      <div className="mt-2.5 flex items-start gap-2.5">
        {/* 作者圆形首字头像（原样大小写） */}
        <span
          className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary border border-border text-xs font-medium text-foreground"
          aria-hidden="true"
        >
          {getAvatarInitial(video.author.username)}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium leading-snug text-foreground line-clamp-2 group-hover:text-foreground/80 transition-colors">
            {video.title}
          </h3>

          {/* 两行元信息：第一行作者，第二行发布时间 + 点赞，避免窄屏挤压 */}
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <p className="truncate">{video.author.username}</p>
            <div className="flex items-center gap-1.5 tabular-nums">
              <span>{formatRelativeTime(video.published_at)}</span>
              {video.like_count > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-0.5">
                    <Heart className="size-3" />
                    {video.like_count}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
