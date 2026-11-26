import type {
  Comment,
  Danmaku,
  PlaybackInfo,
  PublicSubmission,
  User,
} from "./types";

/**
 * 演示用当前登录用户（用户名保留原始大小写）
 */
export const DEMO_CURRENT_USER: User = {
  id: "u-00000000-0000-4000-8000-000000000001",
  username: "Alice",
  created_at: "2026-10-01T08:00:00Z",
};

const AUTHORS: Record<string, User> = {
  Alice: DEMO_CURRENT_USER,
  Bob: {
    id: "u-00000000-0000-4000-8000-000000000002",
    username: "Bob",
    created_at: "2026-10-05T11:20:00Z",
  },
  Kenji: {
    id: "u-00000000-0000-4000-8000-000000000003",
    username: "Kenji_Film",
    created_at: "2026-10-12T15:40:00Z",
  },
  lin: {
    id: "u-00000000-0000-4000-8000-000000000004",
    username: "lin",
    created_at: "2026-10-18T09:10:00Z",
  },
  StudioK: {
    id: "u-00000000-0000-4000-8000-000000000005",
    username: "StudioK",
    created_at: "2026-10-22T19:00:00Z",
  },
  Momo: {
    id: "u-00000000-0000-4000-8000-000000000006",
    username: "MomoDev",
    created_at: "2026-11-01T06:30:00Z",
  },
};

/**
 * 生成彩色抽象摄影风 SVG 封面（100% 本地可用，无外链加载失败风险，同时作为彩色视觉主角）
 */
function makeCoverSvg(
  c1: string,
  c2: string,
  c3: string,
  accent: string,
  motif: "horizon" | "waves" | "studio" | "grid" | "lens" | "sunset",
): string {
  const shapes: Record<typeof motif, string> = {
    horizon: `
      <circle cx="520" cy="145" r="90" fill="${accent}" opacity="0.88"/>
      <rect x="0" y="210" width="640" height="150" fill="#09090b" opacity="0.45"/>
      <line x1="0" y1="210" x2="640" y2="210" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.5"/>
    `,
    waves: `
      <path d="M0,250 Q160,160 320,235 T640,210 L640,360 L0,360 Z" fill="${accent}" opacity="0.55"/>
      <path d="M0,290 Q200,210 380,280 T640,260 L640,360 L0,360 Z" fill="#09090b" opacity="0.45"/>
    `,
    studio: `
      <rect x="70" y="60" width="220" height="240" rx="16" fill="#ffffff" opacity="0.12"/>
      <circle cx="450" cy="180" r="115" fill="${accent}" opacity="0.72"/>
      <circle cx="450" cy="180" r="52" fill="#09090b" opacity="0.5"/>
    `,
    grid: `
      <g stroke="#ffffff" stroke-opacity="0.16" stroke-width="1">
        <line x1="160" y1="0" x2="160" y2="360"/>
        <line x1="320" y1="0" x2="320" y2="360"/>
        <line x1="480" y1="0" x2="480" y2="360"/>
        <line x1="0" y1="120" x2="640" y2="120"/>
        <line x1="0" y1="240" x2="640" y2="240"/>
      </g>
      <rect x="190" y="95" width="260" height="170" rx="12" fill="${accent}" opacity="0.78"/>
    `,
    lens: `
      <circle cx="320" cy="180" r="130" fill="${accent}" opacity="0.28"/>
      <circle cx="320" cy="180" r="88" fill="${accent}" opacity="0.48"/>
      <circle cx="320" cy="180" r="44" fill="#ffffff" opacity="0.82"/>
    `,
    sunset: `
      <circle cx="210" cy="165" r="110" fill="${accent}" opacity="0.9"/>
      <polygon points="0,360 220,190 420,360" fill="#09090b" opacity="0.52"/>
      <polygon points="240,360 470,150 640,360" fill="#09090b" opacity="0.68"/>
    `,
  };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="55%" stop-color="${c2}"/>
        <stop offset="100%" stop-color="${c3}"/>
      </linearGradient>
    </defs>
    <rect width="640" height="360" fill="url(#g)"/>
    ${shapes[motif]}
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// 使用相对当前时间偏移生成稳定的发布时间
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86400 * 1000).toISOString();

export const MOCK_SUBMISSIONS: PublicSubmission[] = [
  {
    id: "v-10000000-0000-4000-8000-000000000001",
    title: "用 Go + FFmpeg 从零搭建多清晰度 HLS 视频转码管线：架构拆解与踩坑实录",
    description:
      "这一期完整拆解 MONO 视频平台的后端转码链路：\n\n1. 为什么选择 8 MiB 固定分片 + S3 Multipart 断点续传\n2. 如何使用 FFmpeg 按源视频高度动态裁剪目标清晰度（360p / 720p / 1080p）\n3. 局部失败时如何保留已就绪档位并仅重试失败任务\n4. 前端 hls.js 如何无缝切换码率与防卡顿缓冲调优\n\n所有设计文档与源码结构均在仓库 docs/ 目录中公开，欢迎在评论区讨论技术细节。",
    author: AUTHORS.Alice,
    cover_url: makeCoverSvg("#0f172a", "#1d4ed8", "#38bdf8", "#f97316", "horizon"),
    duration_ms: 596000, // 09:56 (匹配 Mux 测试流时长)
    width: 1920,
    height: 1080,
    qualities: [1080, 720, 360],
    published_at: hoursAgo(2),
    like_count: 128,
    comment_count: 6,
    liked_by_me: false,
  },
  {
    id: "v-10000000-0000-4000-8000-000000000002",
    title: "京都雨夜漫步 4K 60fps | 先斗町到鸭川的霓虹与雨声白噪音",
    description:
      "手持稳定器在雨夜穿行京都先斗町与鸭川沿岸，全程保留环境立体声收音，无背景音乐打扰。\n适合写代码、阅读或深夜放松时作为背景画面播放。",
    author: AUTHORS.Kenji,
    cover_url: makeCoverSvg("#1e1b4b", "#7c2d12", "#f59e0b", "#fb7185", "sunset"),
    duration_ms: 765000,
    width: 1920,
    height: 1080,
    qualities: [1080, 720, 360],
    published_at: hoursAgo(5),
    like_count: 342,
    comment_count: 4,
    liked_by_me: true,
  },
  {
    id: "v-10000000-0000-4000-8000-000000000003",
    title: "极简黑白 UI 设计系统复盘：如何让内容而不是界面成为主角",
    description:
      "聊一聊 MONO 视觉系统的设计取舍：为什么放弃复杂的渐变卡片和高饱和标签，改用纯中性灰阶 + 高对比黑白交互。\n\n核心原则：\n- 克制字号层级（全站仅 4 档）\n- 用 tabular-nums 消除时间轴与计数的横向抖动\n- 亮/暗双主题只切换语义变量，组件零硬编码色值",
    author: AUTHORS.StudioK,
    cover_url: makeCoverSvg("#064e3b", "#0d9488", "#2dd4bf", "#fde047", "grid"),
    duration_ms: 492000,
    width: 1920,
    height: 1080,
    qualities: [1080, 720, 360],
    published_at: hoursAgo(9),
    like_count: 89,
    comment_count: 3,
    liked_by_me: false,
  },
  {
    id: "v-10000000-0000-4000-8000-000000000004",
    title: "手冲咖啡的萃取变量实验：水温、研磨度与注水节奏对风味的影响",
    description:
      "用同一支埃塞俄比亚耶加雪菲水洗豆，在 88°C / 92°C / 95°C 三组水温下进行对照萃取，记录 TDS 与直观风味差异。",
    author: AUTHORS.lin,
    cover_url: makeCoverSvg("#451a03", "#b45309", "#f59e0b", "#fef3c7", "lens"),
    duration_ms: 348000,
    width: 1280,
    height: 720,
    qualities: [720, 360],
    published_at: hoursAgo(14),
    like_count: 64,
    comment_count: 2,
    liked_by_me: false,
  },
  {
    id: "v-10000000-0000-4000-8000-000000000005",
    title: "从 Java 转 Go 第一周：结构体组合、接口隐式实现与错误处理实战笔记",
    description:
      "面向有 Spring Boot 经验的后端工程师，用对照方式梳理 Go 的项目目录组织、Gin 中间件、pgx + sqlc 与 context 超时取消。",
    author: AUTHORS.Bob,
    cover_url: makeCoverSvg("#1e293b", "#334155", "#0ea5e9", "#38bdf8", "studio"),
    duration_ms: 1120000,
    width: 1920,
    height: 1080,
    qualities: [1080, 720, 360],
    published_at: daysAgo(1),
    like_count: 215,
    comment_count: 5,
    liked_by_me: false,
  },
  {
    id: "v-10000000-0000-4000-8000-000000000006",
    title: "冰岛环岛 1 号公路航拍延时：黑沙滩、冰河湖与午夜极光",
    description:
      "历时 11 天自驾冰岛环岛 1 号公路，精选 6 个机位的延时与航拍片段。",
    author: AUTHORS.Kenji,
    cover_url: makeCoverSvg("#082f49", "#0369a1", "#10b981", "#a7f3d0", "waves"),
    duration_ms: 284000,
    width: 1920,
    height: 1080,
    qualities: [1080, 720, 360],
    published_at: daysAgo(2),
    like_count: 410,
    comment_count: 3,
    liked_by_me: true,
  },
  {
    id: "v-10000000-0000-4000-8000-000000000007",
    title: "Tailwind CSS v4 + Radix Primitives 打造零运行时样式开销的组件库",
    description:
      "实测 Tailwind v4 的 CSS-first 配置与 @theme inline 变量映射，搭配 Radix 实现完整键盘无障碍交互。",
    author: AUTHORS.Momo,
    cover_url: makeCoverSvg("#3b0764", "#7e22ce", "#ec4899", "#f9a8d4", "grid"),
    duration_ms: 632000,
    width: 1920,
    height: 1080,
    qualities: [1080, 720, 360],
    published_at: daysAgo(3),
    like_count: 97,
    comment_count: 2,
    liked_by_me: false,
  },
  {
    id: "v-10000000-0000-4000-8000-000000000008",
    title: "胶片暗房初体验：在家冲洗第一卷柯达 Tri-X 400 黑白负片",
    description:
      "不需要专业暗房，只需要一个暗袋、显影罐和温度计，就能完成整套黑白胶片显影、停显、定影与水洗流程。",
    author: AUTHORS.Alice,
    cover_url: makeCoverSvg("#18181b", "#3f3f46", "#71717a", "#f4f4f5", "lens"),
    duration_ms: 415000,
    width: 1920,
    height: 1080,
    qualities: [1080, 720, 360],
    published_at: daysAgo(4),
    like_count: 153,
    comment_count: 2,
    liked_by_me: false,
  },
  {
    id: "v-10000000-0000-4000-8000-000000000009",
    title: "模块化合成器入门：用 3 个基础模块拼出氛围电子音景",
    description:
      "从振荡器、低通滤波到包络发生器，一步步演示 Eurorack 信号路由与调制逻辑。",
    author: AUTHORS.StudioK,
    cover_url: makeCoverSvg("#4c0519", "#be123c", "#fb923c", "#fde047", "waves"),
    duration_ms: 840000,
    width: 1920,
    height: 1080,
    qualities: [1080, 720, 360],
    published_at: daysAgo(6),
    like_count: 78,
    comment_count: 1,
    liked_by_me: false,
  },
  {
    id: "v-10000000-0000-4000-8000-000000000010",
    title: "RabbitMQ 死信队列与幂等消费：保障视频异步转码不丢不重",
    description:
      "结合数据库状态机与幂等键，演示如何在 Worker 意外重启时安全恢复任务，避免重复发布。",
    author: AUTHORS.Bob,
    cover_url: makeCoverSvg("#052e16", "#15803d", "#4ade80", "#bbf7d0", "studio"),
    duration_ms: 925000,
    width: 1920,
    height: 1080,
    qualities: [1080, 720, 360],
    published_at: daysAgo(8),
    like_count: 112,
    comment_count: 2,
    liked_by_me: false,
  },
  {
    id: "v-10000000-0000-4000-8000-000000000011",
    title: "东京建筑巡礼：安藤忠雄与妹岛和世的光影空间语言",
    description:
      "清水混凝土与玻璃幕墙在不同时段光线下的微妙变化，附各建筑开放参观时间与交通信息。",
    author: AUTHORS.lin,
    cover_url: makeCoverSvg("#172554", "#1e40af", "#60a5fa", "#e0f2fe", "horizon"),
    duration_ms: 540000,
    width: 1920,
    height: 1080,
    qualities: [1080, 720, 360],
    published_at: daysAgo(11),
    like_count: 186,
    comment_count: 2,
    liked_by_me: false,
  },
  {
    id: "v-10000000-0000-4000-8000-000000000012",
    title: "桌面极简改造计划：线缆隐藏、灯光色温与人体工学支架选型",
    description:
      "用极低预算把杂乱的书桌整理成专注工作的黑白工作台，清单与尺寸标注在视频结尾。",
    author: AUTHORS.Momo,
    cover_url: makeCoverSvg("#27272a", "#52525b", "#0284c7", "#7dd3fc", "sunset"),
    duration_ms: 378000,
    width: 1280,
    height: 720,
    qualities: [720, 360],
    published_at: daysAgo(14),
    like_count: 234,
    comment_count: 3,
    liked_by_me: false,
  },
];

// 公开测试 HLS 流（Mux Big Buck Bunny 多码率测试流）
const DEMO_HLS_MANIFEST = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

export function getMockPlayback(submission: PublicSubmission): PlaybackInfo {
  const qualityDimensions: Record<number, { width: number; height: number }> = {
    1080: { width: 1920, height: 1080 },
    720: { width: 1280, height: 720 },
    360: { width: 640, height: 360 },
  };

  return {
    manifest_url: DEMO_HLS_MANIFEST,
    qualities: submission.qualities.map(
      (h) => qualityDimensions[h] ?? { width: Math.round((h * 16) / 9), height: h },
    ),
    duration_ms: submission.duration_ms,
    danmaku_snapshot_at: new Date().toISOString(),
  };
}

export function getMockComments(
  submissionId: string,
  currentUser: User | null,
): Comment[] {
  const submission = MOCK_SUBMISSIONS.find((s) => s.id === submissionId);
  const authorId = submission?.author.id;

  const raw: Omit<Comment, "can_delete">[] = [
    {
      id: `c-${submissionId}-1`,
      submission_id: submissionId,
      author: AUTHORS.Bob,
      body: "这个黑白极简的影院播放器观感太舒服了，没有任何花里胡哨的干扰元素，专注看画面本身。",
      created_at: hoursAgo(0.2),
    },
    {
      id: `c-${submissionId}-2`,
      submission_id: submissionId,
      author: AUTHORS.Alice,
      body: "感谢大家反馈！下一期会继续演示断点续传和清晰度重试的完整链路。\n如果有想看的具体环节可以直接留言。",
      created_at: hoursAgo(1.1),
    },
    {
      id: `c-${submissionId}-3`,
      submission_id: submissionId,
      author: AUTHORS.Kenji,
      body: "清晰度切换菜单和弹幕发送条贴合在一起的设计很利落，暗色模式下沉浸感直接拉满。",
      created_at: hoursAgo(2.5),
    },
    {
      id: `c-${submissionId}-4`,
      submission_id: submissionId,
      author: AUTHORS.lin,
      body: "平铺评论区清爽多了，不会点开一层又一层楼中楼迷路。",
      created_at: hoursAgo(4.2),
    },
    {
      id: `c-${submissionId}-5`,
      submission_id: submissionId,
      author: AUTHORS.Momo,
      body: "收藏了，正好在用 Tailwind CSS v4 + shadcn/ui 做内部工具，这套语义变量方案可以直接参考。",
      created_at: hoursAgo(6.8),
    },
    {
      id: `c-${submissionId}-6`,
      submission_id: submissionId,
      author: AUTHORS.StudioK,
      body: "时间轴数字用了 tabular-nums，进度条走动的时候完全不抖动，细节好评！",
      created_at: hoursAgo(10.5),
    },
  ];

  return raw.map((c) => ({
    ...c,
    can_delete: Boolean(
      currentUser &&
        (currentUser.id === c.author.id || currentUser.id === authorId),
    ),
  }));
}

export function getMockDanmaku(submissionId: string): Danmaku[] {
  const baseTexts = [
    { position_ms: 1200, body: "前排打卡！画质真清晰" },
    { position_ms: 2800, body: "MONO 极简黑白风太帅了" },
    { position_ms: 4500, body: "这进度条和弹幕一体感绝了" },
    { position_ms: 6800, body: "1080p 丝滑流畅" },
    { position_ms: 9200, body: "来学习 HLS 多清晰度切换" },
    { position_ms: 12500, body: "纯白弹幕配描边在暗画面上好清晰" },
    { position_ms: 15800, body: "测试一下防重叠泳道效果" },
    { position_ms: 16200, body: "两条几乎同时出现也不会撞车" },
    { position_ms: 19500, body: "高能预警" },
    { position_ms: 24000, body: "这里讲得好透彻" },
    { position_ms: 30000, body: "暗色模式观看舒适度满分" },
    { position_ms: 38000, body: "期待后端 Go 接口联调" },
    { position_ms: 46000, body: "暂停的时候弹幕也会跟着停住" },
    { position_ms: 55000, body: "干净克制的社区氛围真难得" },
  ];

  return baseTexts.map((item, idx) => ({
    id: `d-${submissionId}-${idx + 1}`,
    position_ms: item.position_ms,
    body: item.body,
    created_at: hoursAgo(1),
  }));
}
