# HTTP 接口契约 v0.1

状态：设计评审稿。业务前缀 `/api/v1`；表中的路径均相对此前缀，健康检查除外。正式业务接口只在所属阶段实现后开放。

## 1. 通用约定

JSON 字段采用 snake_case。ID 为 UUID 字符串，时间为 UTC RFC3339；`?` 表示值可以为 null，`可省略`表示请求中可以不提供。未声明的写入字段返回 400，防止客户端修改 author_id、state 等服务端字段。

成功响应为 `{"data": ..., "request_id": "UUID"}`。列表 data 为 `{"items": [...], "next_cursor": "opaque-or-null"}`。204 无响应体。媒体返回原内容类型，不使用 JSON 包装。

错误响应：

```json
{"error":{"code":"UPLOAD_FILE_MISMATCH","message":"请选择原来的视频文件","fields":{}},"request_id":"00000000-0000-4000-8000-000000000001"}
```

| HTTP 状态 | 语义/常见 code |
| --- | --- |
| 400 | INVALID_ARGUMENT、INVALID_CURSOR、UNKNOWN_FIELD |
| 401 | AUTH_REQUIRED、SESSION_EXPIRED |
| 403 | CSRF_INVALID、ORIGIN_DENIED |
| 404 | NOT_FOUND；他人的私有投稿/上传统一视为不存在 |
| 409 | USERNAME_TAKEN、IDEMPOTENCY_CONFLICT、UPLOAD_STATE_CONFLICT、UPLOAD_FILE_MISMATCH、NOT_RETRYABLE |
| 410 | UPLOAD_EXPIRED、IDEMPOTENT_RESOURCE_GONE |
| 412 | VERSION_CONFLICT，资料编辑版本已变化 |
| 413 | BODY_TOO_LARGE、FILE_TOO_LARGE |
| 422 | INVALID_MEDIA、CHECKSUM_MISMATCH（通常由异步状态反馈，而非上传请求直接返回） |
| 429 | RATE_LIMITED，提供 Retry-After 秒数 |
| 503 | DEPENDENCY_UNAVAILABLE；不得伪装为请求成功 |

所有写操作需要有效 Origin / CSRF；除注册、登录外还需要 Cookie 登录态。对外公开读取可选读取当前身份以返回 liked_by_me，失效 Cookie 不阻止游客观看。

创建投稿、创建上传、手动重试、创建评论、创建弹幕要求 `Idempotency-Key: UUID`。同一用户、作用域和键保留七天；同键不同请求为 409，同键同请求返回同一资源的当前表示。已删除资源返回 410。前端在首次请求前生成并保存键，网络重试复用；用户明确发起新的操作才换键。

PATCH 投稿要求 `If-Match: "submission:{id}:v{version}"`，读取作者 DTO 和修改响应都提供该 ETag。分页游标绑定资源、筛选条件和排序，使用签名的不透明值；limit 不是总量承诺。公开投稿按 published_at DESC、id DESC；我的投稿和评论按 created_at DESC、id DESC；弹幕按 position_ms ASC、id ASC。

## 2. 公共 DTO

| 类型 | 精确字段 |
| --- | --- |
| User | id:uuid，username:string，created_at:time |
| SafeError | code:string，message:string，retryable:boolean |
| OwnerSubmission | id:uuid，title:string，description:string，state:投稿枚举，version:int64，cover_url:string?，duration_ms:int64?，created_at:time，updated_at:time，published_at:time?，upload:UploadSummary?，processing:ProcessingSummary?，error:SafeError? |
| UploadSummary | id:uuid，state:上传枚举，expected_size:int64，confirmed_bytes:int64，expires_at:time；confirmed_bytes 只表示远端已对账字节 |
| ProcessingSummary | stage:string?，target_qualities:int[]，completed_qualities:int[]，current_quality:int?，can_retry:boolean，next_retry_at:time? |
| PublicSubmission | id:uuid，title:string，description:string，author:User，cover_url:string，duration_ms:int64，width:int，height:int，qualities:int[]，published_at:time，like_count:int64，comment_count:int64，liked_by_me:boolean |
| UploadSession | id:uuid，submission_id:uuid，state:上传枚举，file_name:string，expected_size:int64，file_sha256:hex64，part_size:int，part_count:int，expires_at:time，parts:PartStatus[]，error:SafeError? |
| PartStatus | part_number:int，size_bytes:int，sha256:hex64，etag:string?，uploaded:boolean；uploaded 表示 ListParts 对账，不代表密码学验证 |
| Comment | id:uuid，submission_id:uuid，author:User，body:string，created_at:time，can_delete:boolean |
| Danmaku | id:uuid，position_ms:int，body:string，created_at:time；不向游客返回内部账号权限信息 |

PublicSubmission 的计数和 liked_by_me 从 M4 开始提供；M3 前端不渲染互动区域，M3 返回计数 0、liked_by_me=false，避免响应结构跨阶段突变。作者 DTO 不暴露 S3 密钥、对象 key、租约、SQL 或原始 FFmpeg stderr。

## 3. 接口总表

| ID | 阶段 | 方法与路径 | 权限 | 成功 |
| --- | --- | --- | --- | --- |
| H01 | M0 | GET /health/live（无前缀） | 本机 | 200 |
| H02 | M0 | GET /health/ready（无前缀） | 本机 | 200 / 503 |
| A01 | M1 | GET /auth/csrf | 公开 | 200 |
| A02 | M1 | POST /auth/register | 匿名 + CSRF | 201 |
| A03 | M1 | POST /auth/login | 匿名 + CSRF | 200 |
| A04 | M1 | GET /auth/me | 登录 | 200 |
| A05 | M1 | POST /auth/logout | 当前 Cookie + CSRF，可已失效 | 204 |
| S01 | M1 | POST /submissions | 登录 | 201 |
| S02 | M1 | GET /me/submissions | 登录 | 200 |
| S03 | M1 | GET /me/submissions/{id} | 作者 | 200 |
| U01 | M2 | POST /submissions/{id}/upload | 作者 | 201；准备中 202；重放 200 |
| U02 | M2 | GET /uploads/{id} | 作者 | 200 |
| U03 | M2 | POST /uploads/{id}/parts/sign | 作者 | 200 |
| U04 | M2 | POST /uploads/{id}/parts/confirm | 作者 | 200 |
| U05 | M2 | POST /uploads/{id}/resume | 作者 | 200 |
| U06 | M2 | POST /uploads/{id}/complete | 作者 | 202 |
| P01 | M3 | GET /submissions | 公开 | 200 |
| P02 | M3 | GET /submissions/{id} | 公开，仅已发布 | 200 |
| P03 | M3 | GET /submissions/{id}/playback | 公开，仅已发布 | 200 |
| P04 | M3 | GET /submissions/{id}/hls/master.m3u8 | 公开，仅已发布 | 200 |
| P05 | M3 | GET /media/{id} | 按资源类型/父投稿检查 | 200 / 206 |
| P06 | M3 | POST /submissions/{id}/retry | 作者 | 202 |
| S04 | M4 | PATCH /submissions/{id} | 作者 | 200 |
| S05 | M4 | DELETE /submissions/{id} | 作者 | 204 |
| C01 | M4 | PUT /submissions/{id}/like | 登录，已发布 | 200 |
| C02 | M4 | DELETE /submissions/{id}/like | 登录，已发布 | 200 |
| C03 | M4 | GET /submissions/{id}/comments | 公开，已发布 | 200 |
| C04 | M4 | POST /submissions/{id}/comments | 登录，已发布 | 201 |
| C05 | M4 | DELETE /comments/{id} | 评论作者或投稿作者 | 204 |
| D01 | M4 | GET /submissions/{id}/danmaku | 公开，已发布 | 200 |
| D02 | M4 | POST /submissions/{id}/danmaku | 登录，已发布 | 201 |

## 4. M0/M1 请求与响应

- H01 无请求体，data 为 `{status:"ok", service:"api|worker"}`。H02 data 为 `{status:"ready|degraded", checks:{postgres:"ok|failed",redis:"ok|failed|not_used",rabbitmq:"ok|failed|not_required",storage:"ok|failed|not_required"}}`。API 的 ready 取决于 PG/Redis；MQ/存储异常由具体功能反馈。Worker ready 取决于 PG/MQ/存储。日志记录细节，响应不返回连接串。
- A01 无请求体，data 为 `{csrf_token:string}`，设置校验 Cookie，Cache-Control:no-store。
- A02 body `{username:string,password:string}`，规则见总架构；username 保留大小写，唯一性区分大小写，`Alice` 与 `alice` 可分别注册。返回 User，username 按保存的原值返回，注册不自动登录。完全相同的用户名重复注册返回 `409 USERNAME_TAKEN`；不回显密码。
- A03 同样的 body；username 按大小写精确匹配，不转换大小写或回退匹配其他账号；返回 `{user:User,expires_at:time,csrf_token:string}` 并设置身份 Cookie 和新的 CSRF Cookie。错误账号或密码统一 `401 INVALID_CREDENTIALS`。
- A04 返回 `{user:User,expires_at:time}`；读取不续期。
- A05 无请求体，撤销当前 Token 并清除两个 Cookie；重复退出仍为 204。CSRF 检查不能依赖登录必须仍有效。
- S01 body `{title:string,description?:string}`；标题 trim 后 1～100 字符，简介默认空且最多 2000 字符；返回 OwnerSubmission，初始 state=uploading。此调用仅创建上传意图，不会自动公开内容。
- S02 query `cursor?:string,limit?:int,state?:投稿枚举`，不返回 deleted；返回 OwnerSubmission 列表。
- S03 返回 OwnerSubmission 和 ETag；他人或已删除投稿 404。

## 5. M2 上传契约

U01 body：

```json
{"file_name":"sample.mp4","file_size":10000000,"file_sha256":"64位小写十六进制",
 "parts":[{"part_number":1,"size_bytes":8388608,"sha256":"64位小写十六进制"},
          {"part_number":2,"size_bytes":1611392,"sha256":"64位小写十六进制"}]}
```

服务端固定分片大小 8 MiB，核验编号连续、总大小、末片长度、文件上限和哈希格式。file_name 只作展示，不能成为路径。返回 UploadSession。相同投稿同文件的重试复用会话，不同文件为 409；初始化外部存储结果未知时返回 202/creating，客户端通过 U02 查询。

- U02 无请求体；返回 UploadSession。纯轮询不延长七天期限；服务端可对账后更新 parts，但不相信客户端自报进度。
- U03 body `{part_numbers:int[]}`，最多 10 个，编号必须在清单内；data `{items:[{part_number:int,url:string,required_headers:object,expected_size:int,expires_at:time}]}`。URL 最长有效 15 分钟，客户端最多并行三片。固定长度/校验头的具体签名能力必须通过 M0；地址不用于完成 multipart。
- U04 body `{parts:[{part_number:int,etag:string}]}`，最多 120 项；后端 ListParts 核对大小与 ETag，返回更新后的 UploadSession。不能通过伪造确认把不存在的分片标为已上传。
- U05 body `{file_size:int64,file_sha256:hex64}`；必须与既有会话匹配。后端重新对账并返回 UploadSession，客户端只补缺片。文件改名但内容相同允许恢复；已完成会话返回 completed 状态，过期会话 410。
- U06 无请求体，不接受浏览器控制最终分片排序；后端使用已对账的清单完成上传并创建校验任务，data `{submission:OwnerSubmission,upload:UploadSession}`。重复完成不新建投稿/任务。若 S3 返回不确定结果，保留 completing，由 HEAD/会话恢复判定；没有确认完成前不能对用户声称上传成功。

原始 S3 PUT 由浏览器直接调用签名地址，不受 API JSON 包装或 CSRF 机制控制；权限来自签名，长期密钥只存在服务端。源文件是否符合媒体规则最终由后端检查，文件扩展名和浏览器 MIME 不是信任依据。

## 6. M3 播放契约

- P01 query `cursor?,limit?`，返回 PublicSubmission 列表。
- P02 返回单个 PublicSubmission；未发布、已删除或不存在统一 404。
- P03 返回 `{manifest_url:string,qualities:[{height:int,width:int}],duration_ms:int64,danmaku_snapshot_at:time}`，URL 指向本应用，不返回存储签名 GET。
- P04 返回 `application/vnd.apple.mpegurl`，内容仅引用本应用的已登记 variant playlist URL。每次读取重新检查 published。
- P05 根据资源 kind 输出 JPEG、M3U8 或 MPEG-TS。source 一律不对浏览器开放；cover 在已发布时公开、未发布时仅作者可见；playlist/segment 只有已发布才可读取。清单重写为资源 ID URL，支持分片 Range（单范围 206，非法范围 416），媒体响应 Cache-Control:no-store。已开始传输后出错则终止流，不再拼接 JSON。
- P06 无请求体；仅 failed 且 retryable 的作者可调用。返回 OwnerSubmission，状态回 processing；保留已有 ready 档位，重建需要重试的任务。重复键返回同一轮次，非失败状态的新请求 409。

## 7. M4 编辑、删除与互动

- S04 body 只允许 `{title?:string,description?:string}`，至少一个字段；要求 If-Match。成功返回 OwnerSubmission 和新 ETag；已过期或已删除不能编辑。修改资料不重新转码。
- S05 无请求体；在事务提交墓碑后返回 204，表示停止对外提供内容，物理文件清理异步进行。作者重复删除仍为 204；非作者 404。
- C01/C02 无请求体，data `{liked:boolean,like_count:int64}`。并发重复 PUT 只有一条关系，重复 DELETE 不会产生负数。
- C03 query `cursor?,limit?`，返回 Comment 列表；删除内容不展示占位正文。
- C04 body `{body:string}`，trim 后 1～1000 字符，返回 Comment。只按纯文本显示。
- C05 无请求体；有效权限删除后 204，重复删除按可核验的作者/投稿归属返回 204；未授权统一 404。
- D01 query `from_ms:int,to_ms:int,snapshot_at?:time,cursor?:string,limit?:int`，范围为半开区间且最长 60 秒；首次不带 snapshot_at 时由服务器确定。data `{items:Danmaku[],next_cursor:string?,snapshot_at:time}`，只返回 created_at 不晚于 snapshot_at 的弹幕。后续窗口和分页沿用同一个快照时间。
- D02 body `{position_ms:int,body:string}`；位置必须在视频范围内，文字 trim 后 1～100 字符，返回 Danmaku。发送成功后前端立即加入本地时间轴，按 ID 去重；其他观众刷新页面才切换到新快照。

## 8. 浏览器状态与错误呈现

登录失效清除当前用户展示并引导登录，不抹除上传记录。作者处理页轮询间隔初始 2 秒，页面隐藏时放慢到 10 秒，终态停止；不把 worker lease 或 MQ 字段展示给产品用户。播放器和互动使用独立加载/错误状态，一条评论失败不能令视频停止。

上传状态依次为“计算文件校验值 → 准备上传 → 上传中/可继续 → 校验处理中”。网络错误显示重试入口并保存投稿 ID、会话 ID和请求键；不把 Blob 全量存入 localStorage。发表互动期间禁用重复提交，网络重试复用幂等键。
