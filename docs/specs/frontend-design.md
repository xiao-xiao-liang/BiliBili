# 前端视觉与交互设计规格 v0.1

状态：设计评审稿，未初始化前端工程、未实现业务代码。本文件与 [总设计讨论](../design.md)、[HTTP 接口契约](api-contract.md) 及 [数据模型](data-model.md) 保持对齐，定义第一版（V1）的原创视觉系统、全站外壳、路由边界与前端状态约定。

---

## 1. 视觉定位与技术栈

- **产品代号与气质**：`MONO` —— 原创极简黑白视频社区。界面采用高克制的中性灰阶（亮色：白底黑交互；暗色：黑底白交互），避免高饱和装饰与信息过载，让彩色视频封面与播放画面成为视觉绝对主角。
- **核心技术栈**：
  - 构建与框架：`React` + `TypeScript` + `Vite`
  - 样式与组件：`Tailwind CSS v4` + `shadcn/ui`（底层基于 Radix Primitives）+ `lucide-react` 图标
  - 播放与路由：`hls.js` + `React Router`
- **V1 克制边界**：严格遵循后端 V1 范围，**不添加无后端支撑的假入口**（第一版不做搜索框、分区、动态、排行榜、关注、个人主页、稍后再看、私信与评论回复）。

---

## 2. 设计 Token 与主题规范

### 2.1 色彩与圆角（Tailwind CSS v4 + shadcn/ui 原生变量）

变量名与 `shadcn/ui` CLI 生成的组件完全对齐，后续安装 `Button`、`Dialog`、`DropdownMenu`、`Input`、`Badge`、`Skeleton`、`Sonner` 等组件时自动继承黑白主题，无需二次覆写颜色。圆角基准为 `0.75rem`（12px）。

```css
/* src/index.css */
@import "tailwindcss";

/* 基于 html.dark 的暗黑模式切换 */
@custom-variant dark (&:where(.dark, .dark *));

/* 默认：亮色模式（白底黑交互） */
:root {
  --background: #ffffff;
  --foreground: #09090b;

  --card: #ffffff;
  --card-foreground: #09090b;

  --popover: #ffffff;
  --popover-foreground: #09090b;

  --primary: #09090b;
  --primary-foreground: #ffffff;

  --secondary: #f4f4f5;
  --secondary-foreground: #18181b;

  --muted: #f4f4f5;
  --muted-foreground: #71717a;

  --accent: #f4f4f5;
  --accent-foreground: #09090b;

  --destructive: #ef4444;
  --destructive-foreground: #fafafa;

  --border: #e4e4e7;
  --input: #e4e4e7;
  --ring: #09090b;

  --radius: 0.75rem;
}

/* 暗色模式（黑底白交互） */
.dark {
  --background: #09090b;
  --foreground: #fafafa;

  --card: #121215;
  --card-foreground: #fafafa;

  --popover: #18181b;
  --popover-foreground: #fafafa;

  --primary: #fafafa;
  --primary-foreground: #09090b;

  --secondary: #18181b;
  --secondary-foreground: #fafafa;

  --muted: #18181b;
  --muted-foreground: #a1a1aa;

  --accent: #27272a;
  --accent-foreground: #fafafa;

  --destructive: #dc2626;
  --destructive-foreground: #fafafa;

  --border: #27272a;
  --input: #27272a;
  --ring: #d4d4d8;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --font-sans: "Inter", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
}
```

**防闪烁初始化脚本**（置于 `index.html` 的 `<head>` 中，避免暗色模式刷新时闪白）：

```html
<script>
  if (
    localStorage.theme === "dark" ||
    (!("theme" in localStorage) &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  }
</script>
```

### 2.2 状态语义微标（用于投稿与转码状态）

为保持 MONO 黑白克制感，状态徽章统一使用 `bg-secondary text-foreground border border-border` 的中性胶囊，仅通过左侧 `6px` 圆点区分状态：

| 投稿状态 (`OwnerSubmission.state`) | 展示文案 | 圆点样式 | 允许的主要操作 |
| --- | --- | --- | --- |
| `uploading` | 上传中 / 待继续 | 灰色静态点 `bg-muted-foreground` | 继续上传、编辑资料、删除 |
| `processing` | 处理中（可附当前阶段/清晰度） | 琥珀色脉冲点 `bg-amber-500 animate-pulse` | 编辑资料、删除 |
| `published` | 已发布 | 低饱和绿点 `bg-emerald-500` | 观看、编辑资料、删除 |
| `failed` | 处理失败 | 红色点 `bg-destructive` | 重试（当 `processing.can_retry=true`）、编辑资料、删除 |
| `expired` | 上传已过期 | 浅灰点 `bg-muted-foreground/50` | 删除（不可编辑、不可继续上传） |

### 2.3 排版与容器宽度约定

- **字号层级**（全站严格控制在 4 档）：
  - 页面标题：`text-xl font-semibold tracking-tight`
  - 卡片/区块标题：`text-sm font-medium leading-snug`（卡片标题固定 `line-clamp-2`）
  - 正文/表单：`text-sm leading-relaxed`
  - 辅助元信息：`text-xs text-muted-foreground`
- **数字对齐**：视频时长、上传百分比、字节数、清晰度标签、点赞数、评论数、弹幕时间轴统一使用 `tabular-nums`。
- **容器宽度档位**：
  - 标准容器（首页、我的投稿）：`max-w-7xl mx-auto px-6`
  - 单栏影院容器（视频详情页）：`max-w-[1120px] mx-auto px-6`（V2 引入推荐流后可扩展为 `max-w-[1440px]` 左右双栏）
  - 聚焦表单容器（投稿页）：`max-w-2xl mx-auto`
  - 居中认证卡片（登录页、注册页）：`max-w-sm mx-auto`

---

## 3. 路由表、权限守卫与全站外壳

### 3.1 V1 路由清单

| 路径 | 页面 | 访问权限 | 对应后端阶段与接口 |
| --- | --- | --- | --- |
| `/` | 首页（视频流） | 公开（游客可看） | M3: `P01` |
| `/videos/:id` | 视频详情页 | 公开（仅已发布，否则 404 页） | M3: `P02` `P03` `P04` `P05`；M4: `C01`-`C05` `D01`-`D02` |
| `/upload` | 投稿页（新建 / 续传） | 需登录（未登录跳 `/login?redirect=/upload`） | M1: `S01` `S03`；M2: `U01`-`U06` |
| `/me/submissions` | 我的投稿 | 需登录 | M1: `S02`；M3: `P06`；M4: `S04` `S05` |
| `/login` | 登录页 | 匿名（已登录可重定向 `/`） | M1: `A01` `A03` |
| `/register` | 注册页 | 匿名 | M1: `A01` `A02` |

> 说明：`/upload` 支持可选查询参数 `?submissionId={uuid}`，用于从“我的投稿”点击「继续上传」时恢复既有未完成上传会话。

### 3.2 全站外壳（`Layout.tsx`）

采用纯顶栏居中布局（无左侧常驻菜单栏），吸顶高度 `h-14`、毛玻璃背景 `bg-background/80 backdrop-blur-md`、底部分割线 `border-b border-border`：

- **左侧**：`MONO` 黑白 Logo（点击回 `/`）+ 主导航 `首页` + `我的投稿`（仅登录态显示）。
- **右侧**：
  - **已登录**：`投稿` 主按钮（纯黑/纯白高对比）+ 亮暗切换按钮 + 用户头像下拉菜单（显示原样大小写的 `username`、`我的投稿`、`退出登录`）。
  - **未登录**：亮暗切换按钮 + `登录`（次级按钮）+ `注册`（主按钮）。

---

## 4. 前端状态、契约与交互约定

严格对齐 [HTTP 接口契约 §1 与 §8](api-contract.md)：

1. **鉴权与 CSRF**：
   - 应用启动时调用 `GET /api/v1/auth/me`（`A04`）恢复登录态；失效 Cookie 返回 `401` 时静默回退为游客态，不弹窗打扰浏览。
   - 写操作（除注册、登录外的写请求，以及注册、登录本身）通过 `GET /api/v1/auth/csrf`（`A01`）获取并携带 CSRF Token；登录成功（`A03`）后立即更新内存中的 CSRF Token。
   - 会话在操作中途过期（`401 SESSION_EXPIRED`）时，清除当前用户展示并引导跳转 `/login?redirect=...`，**不清除本地保存的上传会话恢复记录**。
   - 用户名按大小写精确展示与提交，前端不做 `toLowerCase()` 处理。
2. **幂等键（`Idempotency-Key`）**：
   - `S01`（创建投稿）、`U01`（创建上传）、`P06`（手动重试）、`C04`（发表评论）、`D02`（发送弹幕）在用户发起一次新操作前生成 UUID，网络失败重试时复用同一个键；用户明确发起下一次新操作时再重新生成。
3. **乐观并发编辑（`ETag` / `If-Match`）**：
   - 编辑投稿资料（`S04`）必须携带服务端返回的 `ETag` 作为 `If-Match` 请求头；遇到 `412 VERSION_CONFLICT` 时提示内容已变化并刷新最新数据。
4. **独立加载与错误隔离**：
   - 视频详情页中，播放器（`P03`/`P04`/`P05`）、点赞（`C01`/`C02`）、评论（`C03`-`C05`）、弹幕（`D01`-`D02`）各自维护独立的加载态与错误态，互动接口失败不得中断视频播放。
   - M3 阶段前端暂不渲染点赞、评论与弹幕区域，M4 阶段开启。
5. **四态完整覆盖**：
   - 每个数据区域均须具备：加载态（`Skeleton`，宽高与真实内容一致防抖动）、空状态（图标 + 简短文案 + 引导动作）、错误态（内联提示或 `Toast` + 重试按钮）、进行中态（按钮禁用 + loading 防重复提交）。
6. **状态轮询与本地存储**：
   - 作者查看处理中投稿（`uploading` / `processing`）时轮询 `S02` 或 `S03`：页面可见时 2 秒一次，页面不可见（`document.hidden`）放慢到 10 秒，进入终态（`published` / `failed` / `expired`）后停止。
   - `localStorage` 仅保存主题偏好（`theme`）与断点续传元数据（`submissionId`、`uploadId`、`idempotencyKey`），**绝不写入视频文件 Blob**。

---

## 5. 建议目录结构

```text
web/
├── index.html
└── src/
    ├── index.css                    # Tailwind v4 + shadcn/ui 黑白主题变量
    ├── main.tsx
    ├── app/
    │   ├── router.tsx               # 路由表与登录守卫
    │   └── providers.tsx            # AuthProvider / Theme / Toaster
    ├── lib/
    │   ├── api/                     # 统一 fetch 封装、CSRF、Idempotency-Key、错误映射
    │   ├── format.ts                # 时长(duration_ms)、相对时间、字节大小格式化
    │   └── utils.ts                 # cn() 工具函数
    ├── components/
    │   ├── ui/                      # shadcn/ui 生成的基础组件
    │   └── layout/
    │       └── Layout.tsx           # 全站顶栏与居中容器
    └── features/
        ├── auth/                    # LoginPage / RegisterPage / useAuth
        ├── video-feed/              # HomePage / VideoCard / VideoCardSkeleton
        ├── video-watch/             # VideoDetailPage / HlsPlayer / DanmakuLayer / CommentSection
        ├── upload/                  # UploadPage / FileDropzone / ChunkUploader / ResumeBanner
        └── my-submissions/          # MySubmissionsPage / SubmissionRow / StatusBadge / EditDialog
```

---

## 6. 核心组件基线（已确认）

### 6.1 `VideoCard` 数据映射（对齐 `PublicSubmission`）

卡片严格保持 `16:9` 封面比例（`aspect-video`）防布局抖动，Hover 时封面轻微缩放（`scale-[1.03]`）。使用 `<Link to={/videos/${video.id}}>` 包裹以支持新标签页打开。

| 视觉元素 | 来源字段（`PublicSubmission`） | 格式约定 |
| --- | --- | --- |
| 封面图 | `cover_url` | `object-cover`，`loading="lazy"` |
| 右下角时长胶囊 | `duration_ms` | `mm:ss`（超过 1 小时为 `hh:mm:ss`），`tabular-nums` |
| 标题 | `title` | 最多两行截断 `line-clamp-2` |
| 作者头像占位 | `author.username` | 圆形中性底色，取首字符原样展示（V1 无自定义头像） |
| 作者名 | `author.username` | 单行截断 `truncate`，保留原始大小写 |
| 辅助元信息 | `published_at`（M4 可选附 `like_count`） | 如 `3 小时前` 或 `2026-11-25`（V1 无播放量字段，不伪造播放次数） |

---

## 7. 六大页面详细结构索引

> 以下为各页职责总览，具体区块布局、状态流转与组件骨架将在后续逐页定稿并补充至本节（或独立子章节）：

1. **首页（`/`）**：`Layout` 标准宽 + 顶栏「最新发布」标题 + 4 列响应式 `VideoCard` 网格（`sm:2 / lg:4`）+ 游标分页「加载更多 / 下一页」+ 骨架屏与空状态。
2. **视频详情页（`/videos/:id`）**：已定稿，见下方 **7.1 节**（`max-w-[1120px]` 单栏影院流）。
3. **投稿页（`/upload`）**：已定稿，见下方 **7.2 节**（`max-w-2xl` 聚焦单栏，支持新建与断点续传）。
4. **我的投稿（`/me/submissions`）**：已定稿，见下方 **7.3 节**（`max-w-7xl` 横向卡片流 + 视觉降噪操作区 + 2s/10s 自动轮询）。
5. **登录页（`/login`）**：已定稿，见下方 **7.4 节**（`max-w-sm` 居中认证卡片，支持 `redirect` 回跳与注册成功引导）。
6. **注册页（`/register`）**：已定稿，见下方 **7.4 节**（`max-w-sm` 居中认证卡片，严格校验规则，成功后跳登录页）。

### 7.1 视频详情页（`/videos/:id`）详细设计

采用 **`max-w-[1120px]` 单栏影院流布局**（V1 无推荐视频侧栏，砍掉右侧假数据栏与“宽屏/标准”切换按钮，仅保留全屏；V2 有推荐接口后可扩展为 `max-w-[1440px]` 左右双栏）。

#### 线框结构

```text
+-------------------------------------------------------------------+
|  [顶部吸顶导航栏 Layout]                                            |
+-------------------------------------------------------------------+
|  +-------------------------------------------------------------+  |
|  |                 16:9 纯黑影院播放器 (hls.js)                 |  |
|  |                 + 弹幕滚动覆盖层 (M4)                        |  |
|  |  [▶] ━━━━━━━━●──────────── 03:12 / 12:45  [🔊] [弹] [720p] [⛶]|  |
|  +-------------------------------------------------------------+  |
|  | [弹幕开关]  [ 发一条友善的弹幕... (0/100)          ]  [ 发送 ] |  | <-- M4 一体化弹幕条
|  +-------------------------------------------------------------+  |
|                                                                   |
|  视频标题（最多两行，text-xl font-semibold）                        |
|  [U] Alice · 发布于 2026-11-25 · 1080p            [ ♡ 点赞 42 ]   | <-- M4 黑白反色点赞
|                                                                   |
|  +-------------------------------------------------------------+  |
|  | 视频简介（有内容时才显示，纯文本，超过 3 行可点击展开/收起）     |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  ─────────────────────────── 分割线 ────────────────────────────  |
|  评论 (18)                                                        | <-- M4 平铺评论区
|  +-------------------------------------------------------------+  |
|  | 写下你的想法...（未登录时显示“登录后参与讨论” + 去登录按钮）     |  |
|  +-------------------------------------------------------------+  |
|                                                  0/1000  [ 发表 ] |
|  [B] Bob · 10 分钟前                                      [删除]  | <-- can_delete
|      评论正文纯文本展示，支持换行，不做回复和楼中楼。                |
|                        [ 加载更多评论 ]                            | <-- next_cursor
+-------------------------------------------------------------------+
```

#### 区块与接口映射

1. **一体化影院播放器（`HlsPlayer` + `DanmakuLayer` + `DanmakuBar`）**
   - 播放器与底部弹幕发送条共用外层 `rounded-xl border border-border overflow-hidden` 边框，形成一体影院控制台。
   - 调用 `P03` 获取 `manifest_url`、`qualities`、`duration_ms`、`danmaku_snapshot_at`，通过 `hls.js` 播放 `P04`/`P05`。
   - **自定义极简控制栏**（底部渐变黑遮罩，鼠标静止 2.5 秒自动隐藏）：播放/暂停、进度条（拖拽与时间预览）、`当前时间 / 总时长`（`tabular-nums`）、音量静音与滑块、弹幕开关（M4）、清晰度选择器（`自动` + 后端实际提供的降序清晰度，如 `1080p / 720p / 360p`）、全屏按钮。
   - **弹幕滚动层（M4）**：以 `P03` 返回的 `danmaku_snapshot_at` 为固定快照，按 60 秒半开窗口懒加载 `D01`；纯白文字配细黑描边投影，分泳道防重叠；暂停同步暂停，拖动进度条清空屏幕并重排。
   - **弹幕发送条（M4）**：`trim` 后 1～100 字，携带 `Idempotency-Key` 与当前 `position_ms` 调用 `D02`；成功后立即插入本地时间轴并按 `id` 去重。未登录时输入框置灰并显示「登录后发送弹幕」。
2. **视频信息与点赞区（`VideoMeta`）**
   - 来自 `P02`（`PublicSubmission`）：标题、作者圆形首字头像 + 原样大小写 `username`、发布时间、最高可用清晰度标签。
   - **点赞按钮（M4，`C01`/`C02`）**：未点赞为 `outline` 样式，已点赞切换为 `bg-primary text-primary-foreground` 黑白反色实心态；请求中禁用防连点；游客点击提示并引导跳转 `/login?redirect=/videos/:id`。
   - **简介区**：`description` 非空时展示在 `bg-secondary/50 rounded-xl p-4` 中，纯文本渲染（`whitespace-pre-wrap break-words`），超过 3 行折叠并提供「展开 / 收起」。
3. **平铺评论区（`CommentSection`，M4）**
   - 调用 `C03` 游标分页加载（最新优先，无回复与楼中楼），底部 `next_cursor !== null` 时显示「加载更多评论」。
   - 发表框：已登录显示 `Textarea`（1～1000 字计数 + `Idempotency-Key` 调用 `C04`，成功后插至列表顶部并令本地 `comment_count + 1`）；未登录显示占位引导条。
   - 删除控制：仅当 `comment.can_delete === true` 时显示 `删除` 按钮，点击通过 `AlertDialog` 二次确认后调用 `C05` 并移除该条评论。
4. **M3/M4 开关与错误隔离**
   - M3 阶段仅渲染播放器 + 视频信息区；M4 阶段开启弹幕层、弹幕条、点赞按钮与评论区。
   - `P02` 返回 `404` 时渲染整页极简 404 状态卡片（“视频不存在或尚未发布” + 「返回首页」），终止后续 `P03`/`C03`/`D01` 请求。
   - 播放器、弹幕、点赞、评论各自拥有独立的加载态与错误重试区，任意互动接口失败均不中断视频播放。

### 7.2 投稿页（`/upload`）详细设计

采用 **`max-w-2xl`（672px）聚焦单栏布局**，支持 **新建投稿（`/upload`）** 与 **断点续传恢复（`/upload?submissionId={uuid}`）** 两种模式，复用同一套表单与四阶段上传状态机。

#### 线框结构

**模式 A：新建投稿**

```text
+-------------------------------------------------------------------+
|  [顶部吸顶导航栏 Layout]                                            |
+-------------------------------------------------------------------+
|  投稿视频                                                          |
|  上传完成后后台自动转码多清晰度并发布，无需手动上架。                  |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  | ⓘ 检测到未完成的投稿《Go 并发实战》，已上传 48%   [继续上传] [忽略]| <-- 有本地断点时显示
|  +-------------------------------------------------------------+  |
|                                                                   |
|  + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +  |
|  |                         [ ↑ 图标 ]                          |  |
|  |               拖拽 MP4 视频到这里，或点击选择文件             |  |
|  |     MP4 (H.264 / AAC) · 360p–1080p · ≤ 1 GB · ≤ 30 分钟     |  |
|  + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +  |
|  （选完文件后变为紧凑已选文件卡片：文件名 · 大小 · 时长 · [更换]）   |
|                                                                   |
|  标题 *                                                    12/100 |
|  +-------------------------------------------------------------+  |
|  | 选文件后若标题为空，自动预填去掉 .mp4 后缀的文件名              |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  简介（选填）                                              0/2000 |
|  +-------------------------------------------------------------+  |
|  | 介绍一下你的视频内容...                                       |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  封面将由系统自动截取                        [ 上传并自动发布 ]   |
+-------------------------------------------------------------------+
```

**模式 B：上传进行中 / 断点续传**

```text
+-------------------------------------------------------------------+
|  《Go 并发实战》                                     128.4 MB      |
|  ● 1.计算校验值  →  ● 2.准备上传  →  ◉ 3.上传中  →  ○ 4.校验处理中  |
|                                                                   |
|  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░  62%           |
|  已对账 80.0 MB / 128.4 MB · 10 / 16 分片（3 路并发）              |
|                                                                   |
|  [ 暂停上传 ]                                                      |
|  （网络失败时变为：错误提示 + [ 重试当前步骤 ]，不丢失已传分片）      |
+-------------------------------------------------------------------+
```

确认进入 `processing` 后切换为交接完成卡片（「上传完成，正在后台校验与转码」+ **「查看我的投稿」** 主按钮 + **「再投一个」** 次级按钮）。

#### 交互规则与契约对齐

1. **客户端轻量前置校验**
   - 选文件时立即拦截空文件与 `size > 1 GB`；尝试通过本地 `<video>` 读取元数据，若发现时长 `> 30 分钟`、画面高度 `< 360px` / `> 1080px` 或非横屏，给出明确内联错误提示。
   - 文件扩展名与浏览器 MIME 仅作友好提示，最终合法性以服务端 `ffprobe` 为准。
2. **四阶段上传状态机（对齐 `api-contract.md` §5 & §8）**
   - **阶段 1 · 计算文件校验值**：按固定 **8 MiB** 分片边界流式计算全文件 `file_sha256` 与每片 `sha256`，显示计算进度百分比（`tabular-nums`）。
   - **阶段 2 · 准备上传**：
     - 新建模式：依次调用 `S01`（带 `Idempotency-Key`）→ `U01`（带 `Idempotency-Key`）；若 `U01` 返回 `202 creating`，轮询 `U02` 直到进入 `uploading`。
     - 续传模式（`/upload?submissionId=`）：先调用 `S03` + `U02` 展示只读标题、已对账进度与过期时间；用户重选原文件并完成哈希后调用 `U05`（`file_size` + `file_sha256`）。遇到 `409 UPLOAD_FILE_MISMATCH` 内联提示「请选择原来的视频文件」并允许重选；遇到 `410 UPLOAD_EXPIRED` 显示过期状态卡片并引导新建投稿。
   - **阶段 3 · 上传中 / 可继续**：
     - 仅上传 `UploadSession.parts` 中 `uploaded === false` 的缺片。
     - 批量调用 `U03` 申请签名 URL（单次最多 10 片），浏览器最多 **3 路并发** 直接 `PUT` 到对象存储，拿到 `ETag` 后调用 `U04` 完成服务端 `ListParts` 对账。
     - 进度以服务端返回的 `confirmed_bytes` 为权威基准；支持「暂停上传」（中止在途分片请求，保留已确认分片）与「继续上传」。
   - **阶段 4 · 校验处理中**：
     - 全部分片对账完成后调用 `U06`；若返回 `completing` 则轮询确认，**在确认进入 `processing` 前绝不声称上传成功**。
3. **断点存储、防误关与登录过期兜底**
   - `localStorage` 仅存 `{ submissionId, uploadId, title, fileName, expectedSize, idempotencyKey }`，绝不存文件 Blob；进入 `processing` 或主动放弃后清理。
   - 中途 `401 SESSION_EXPIRED` 不清除本地上传记录，面板内提示重新登录后可继续，并提供按钮跳转 `/login?redirect=/upload?submissionId={id}`。
   - 处于阶段 1～3 时监听 `beforeunload` 防止误关页面。

#### 组件拆分（`src/features/upload/`）

- `UploadPage.tsx`：新建 / 续传模式分发与 `ResumeBanner`
- `FileDropzone.tsx`：拖拽选文件 + 客户端轻量预检 + 已选文件摘要卡
- `SubmissionForm.tsx`：标题（1～100 字）/ 简介（0～2000 字）表单与「上传并自动发布」按钮
- `UploadProgressPanel.tsx`：四阶段步骤条、进度条、暂停/重试与完成后交接卡片
- `useChunkUploader.ts`：8 MiB 分片哈希、3 并发直传、对账确认与断点恢复状态机 Hook

### 7.3 我的投稿页（`/me/submissions`）详细设计

采用 **`max-w-7xl` 标准宽容器 + 横向卡片列表**（与首页顶部导航栏左右严格对齐，卡片内部采用 `p-4 gap-5` 舒展留白），兼顾多清晰度转码/断点续传等硬核能力展示与 MONO 极简视觉克制感。

#### 线框结构

```text
+-------------------------------------------------------------------+
|  [顶部吸顶导航栏 Layout]                                            |
+-------------------------------------------------------------------+
|  我的投稿   ● 自动刷新中（仅存在上传/处理中任务时显示）  [ + 新建投稿 ] |
|                                                                   |
|  [ 全部 ]  [ 上传中 ]  [ 处理中 ]  [ 已发布 ]  [ 处理失败 ]  [ 已过期 ] |
|  ───────────────────────────────────────────────────────────────  |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  | [ 16:9 ◌ ]  Go 并发实战：Worker Pool        [● 处理中]       |  |
|  |             正在转码 720p · [360p ✓] [720p ◌] [1080p]        |  |
|  |             创建于 2026-11-25 18:10                  ✎  🗑  |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  | [ 16:9 ↑ ]  HLS 分片播放原理解析            [● 上传中]       |  |
|  |             ━━━━━━━━░░░░░ 48% · 48.0 / 100.0 MB             |  |
|  |             过期时间 2026-12-02           [继续上传] ✎  🗑  |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  | [ 16:9封面] RustFS 对象存储初体验           [● 已发布]       |  |
|  |  [ 08:24 ]  360p · 720p · 1080p · 发布于 2026-11-24         |  |
|  |             创建于 2026-11-24 20:05           [观看] ✎  🗑  |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  | [ 16:9 ! ]  本地测试素材 04                 [● 处理失败]     |  |
|  |             转码 720p 失败，可重试（已保留 360p 成果）        |  |
|  |             创建于 2026-11-24 15:00       [重试处理] ✎  🗑  |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|                          [ 加载更多 ]                              | <-- next_cursor
+-------------------------------------------------------------------+
```

#### 视觉降噪与状态呈现规范

1. **16:9 缩略图与状态强绑定（`w-44 aspect-video shrink-0 rounded-lg`）**
   - `published`：展示真实封面 + 右下角 `tabular-nums` 时长胶囊，点击封面或标题直接跳转 `/videos/:id`。
   - `uploading` / `processing` / `failed` / `expired`：中性灰 `bg-muted` 占位框内居中展示极简状态图标（`uploading` 上传/断点图标、`processing` 旋转加载环、`failed` 警示图标、`expired` 时钟图标），避免纯空白灰块。
2. **右侧操作区视觉收敛（防按钮扎堆）**
   - 每行最多保留 **1 个主按钮**（`继续上传` / `观看` / `重试处理`，使用 MONO 黑白反色或清晰边框突出当前首要动作）。
   - **编辑（`Pencil`）**与 **删除（`Trash2`）**统一降级为无边框图标按钮 + `Tooltip`，默认低饱和度（`text-muted-foreground`），Hover 时高亮（删除按钮 Hover 变为 `text-destructive`）。
3. **五种投稿状态与动作矩阵（对齐 `OwnerSubmission` DTO）**

| 状态 (`state`) | 中间动态进度/反馈区 | 右侧主按钮 + 图标动作 |
| --- | --- | --- |
| `uploading` | 细进度条 + `confirmed_bytes / expected_size`（`tabular-nums`）+ `expires_at` 过期提示 | 主按钮「继续上传」（跳 `/upload?submissionId={id}`）+ 编辑 + 删除 |
| `processing` | `processing.stage` 阶段文案 + `QualityChips` 多清晰度胶囊（`completed_qualities` 标 `✓`，`current_quality` 脉冲 `◌`，其余弱化） | 无主按钮；编辑 + 删除 |
| `published` | 已生成清晰度列表 + `published_at` | 主按钮「观看」（跳 `/videos/:id`）+ 编辑 + 删除 |
| `failed` | 红色内联展示脱敏 `error.message`；若有 `completed_qualities` 提示已保留已完成档位；若有 `next_retry_at` 提示自动重试时间 | 主按钮「重试处理」（仅 `processing.can_retry=true`，带 `Idempotency-Key` 调 `P06`）+ 编辑 + 删除 |
| `expired` | 弱化提示「上传会话已超过 7 天未活动并过期，无法继续上传或编辑」 | 无主按钮、无编辑；仅保留删除图标 |

> 严禁向用户暴露内部 `worker lease`、RabbitMQ 字段、对象存储 key 或原始 FFmpeg stderr。

#### 弹窗、轮询与四态

1. **编辑资料弹窗（`EditSubmissionDialog`，M4：`S03` + `S04`）**
   - 打开弹窗先调用 `S03` 拉取最新资料与 `ETag`；支持编辑标题（trim 后 1～100 字）与简介（0～2000 字），提示「修改资料不会重新转码视频」。
   - 提交携带 `If-Match: ETag` 调用 `S04`；遇 `412 VERSION_CONFLICT` 时在弹窗内提示并刷新最新内容，由用户确认后重新保存。
2. **删除确认弹窗（`DeleteSubmissionDialog`，M4：`S05`）**
   - 使用 shadcn `AlertDialog`，按状态区分不可恢复警告文案（`published` 强调立即下架停止观看，`uploading`/`processing` 强调立即中止上传或转码）；确认按钮用 `destructive` 样式，提交中禁用防连点；`204` 后移除行并提示 Toast。
3. **可见性感知轮询与游标分页**
   - 当前列表存在 `uploading` 或 `processing` 条目时自动轮询 `S02`（页面可见 2 秒 / `document.hidden` 10 秒），全部进入终态后自动停止。
   - 切换状态筛选 Tab 重置 `cursor` 并重新请求 `S02`；底部 `next_cursor !== null` 显示「加载更多」。
4. **空状态与阶段开关**
   - 「全部」Tab 为空：居中图标 + 「还没有投稿过视频」+「去投稿」主按钮；特定筛选 Tab 为空：「当前筛选下暂无投稿」+「查看全部」次级按钮。
   - M1 展示基础列表与状态；M3 开放封面/观看跳转与 `P06` 重试；M4 开放 `S04` 编辑与 `S05` 删除。

#### 组件拆分（`src/features/my-submissions/`）

- `MySubmissionsPage.tsx`：页头、状态筛选 Tabs、游标分页与可见性感知轮询（2s / 10s）
- `SubmissionRow.tsx`：横向投稿卡片（`p-4 gap-5`、状态缩略图/封面、进度/错误区、收敛后的单主按钮 + 图标动作区）
- `StatusBadge.tsx`：MONO 中性胶囊 + 6px 语义圆点
- `QualityChips.tsx`：多清晰度转码进度胶囊（已完成 / 转码中 / 待处理）
- `EditSubmissionDialog.tsx`：拉取 `ETag`、表单校验与 `412` 冲突处理
- `DeleteSubmissionDialog.tsx`：按状态区分警告文案的不可恢复二次确认弹窗

### 7.4 登录页（`/login`）与注册页（`/register`）详细设计

采用 **`max-w-sm`（384px）极简居中认证卡片**（复用全站 `Layout` 顶栏，垂直居中留白），完全去除第三方登录、短信验证码与找回密码等 V1 范围外元素。已登录用户访问 `/login` 或 `/register` 时自动重定向至 `/`。

#### 线框结构

```text
+-------------------------------------------------------------------+
|  [顶部吸顶导航栏 Layout]                                            |
+-------------------------------------------------------------------+
|                                                                   |
|                 +-------------------------------+                 |
|                 |          [ ▶ ] MONO           |                 |
|                 |         登录你的账号           |                 |
|                 |                               |                 |
|                 |  ✓ 注册成功，请使用新账号登录   | <-- 仅注册跳转时 |
|                 |                               |                 |
|                 |  用户名                        |                 |
|                 |  +-------------------------+  |                 |
|                 |  | Alice                   |  |                 |
|                 |  +-------------------------+  |                 |
|                 |  用户名区分大小写               |                 |
|                 |                               |                 |
|                 |  密码                          |                 |
|                 |  +---------------------+---+  |                 |
|                 |  | •••••••••••••••     |👁 |  |                 |
|                 |  +---------------------+---+  |                 |
|                 |                               |                 |
|                 |  （注册页多一个「确认密码」框）  |                 |
|                 |                               |                 |
|                 |  [          登 录          ]  | <-- bg-primary  |
|                 |                               |                 |
|                 |      还没有账号？去注册         |                 |
|                 +-------------------------------+                 |
|                                                                   |
+-------------------------------------------------------------------+
```

#### 字段校验与契约对齐（严格对齐 `architecture.md` §4 & `api-contract.md` §4）

1. **用户名（`username`）**
   - 规则：`3～32` 个 ASCII 字母、数字或下划线（`^[A-Za-z0-9_]{3,32}$`）。
   - **严格区分大小写**：表单提示「区分大小写，`Alice` 与 `alice` 为不同账号」，前端绝不做 `toLowerCase()`。
2. **密码（`password`）**
   - 规则：**绝不做 `.trim()`**，按 UTF-8 字节数校验 `8～128` 字节（`new TextEncoder().encode(pwd).length`）。
   - 右侧提供无边框眼睛图标按钮（`Eye` / `EyeOff`）切换明文/密文显示。
   - 注册页额外包含「确认密码」字段，仅做客户端一致性校验，不提交给后端。
3. **提交流程与反馈**
   - **登录（`A01` + `A03`）**：
     - 提交期间按钮禁用并显示加载状态，防重复提交。
     - 凭据错误（`401 INVALID_CREDENTIALS`）在表单顶部统一显示内联错误「用户名或密码错误」，不区分账号是否存在。
     - 触发限流（`429 RATE_LIMITED`）时读取 `Retry-After` 友好提示稍后再试。
     - 登录成功后写入内存登录态与新 `csrf_token`：若 URL 存在合法站内相对路径 `redirect`（以 `/` 开头且非 `//`），跳回原页面（如 `/upload?submissionId=...` 或 `/videos/:id`）；否则默认进入 `/me/submissions`。
   - **注册（`A01` + `A02`）**：
     - 用户名已存在（`409 USERNAME_TAKEN`）直接在用户名输入框下方标红提示。
     - **注册不自动登录**：`201` 成功后跳转 `/login`（通过路由 state 传递 `registered: true` 与原样 `username`），登录页顶部显示中性成功提示条并自动预填用户名。
4. **退出登录（顶栏菜单，`A05`）**
   - 点击顶栏头像下拉菜单「退出登录」调用 `A05`（携带 CSRF），清除内存登录态并保留本地未完成上传的断点元数据（不清空 `localStorage` 上传记录）；若当前位于需登录页面（`/upload`、`/me/submissions`），自动跳转 `/` 或 `/login`。

#### 组件拆分（`src/features/auth/`）

- `AuthCard.tsx`：共用 MONO 居中卡片外壳（Logo、标题、底部切换链接）
- `LoginPage.tsx`：登录表单、注册成功横幅、`redirect` 安全回跳
- `RegisterPage.tsx`：注册表单、ASCII 用户名与 UTF-8 字节长度校验、注册后跳登录页
- `PasswordInput.tsx`：带 `Eye` / `EyeOff` 显隐切换的密码输入框
- `useAuth.ts`：全局登录态管理（启动 `A04` 静默恢复、登录/退出状态同步、CSRF 维护）
