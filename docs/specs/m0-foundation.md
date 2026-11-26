# M0：环境与兼容性验证

状态：待评审，未执行。目标是证明选定技术可以组合运行，并留下可复现记录；本阶段不实现正式注册、投稿或转码业务。

## 1. 输入、架构与交付边界

输入为 [总架构](architecture.md) 中的技术栈和 V-01～V-05。输出为版本锁定记录、四个基础服务的启动配置、API/Worker 最小启动入口、前端壳和隔离的兼容性验证程序。

验证路径分别是浏览器 → 测试签名器 → RustFS、Gin 测试路由 → sa-token-go → Redis、发布器 → RabbitMQ → 测试消费者、Go 查询 → PostgreSQL。验证路由与测试账号只在测试进程存在，不混入正式业务 API。

## 2. 本阶段结构与接口

| 项目 | 设计 |
| --- | --- |
| 业务数据库表 | 无；数据库往返验证只使用临时表和事务回滚 |
| Redis 数据 | 隔离测试前缀，与后续正式身份数据隔离 |
| S3 数据 | 独立 probe 桶/前缀，每轮 run_id 隔离，验证结束按该范围清理 |
| RabbitMQ 数据 | 独立测试 vhost/队列，不使用正式投稿任务 |
| 正式 HTTP 增量 | H01 `/health/live`、H02 `/health/ready`，定义见接口契约 |
| 内部适配能力 | S3 Create/SignPart/ListParts/Complete/Abort/Get/Range；MQ PublishConfirmed/Consume/Ack；认证 Login/Check/LogoutCurrent；Clock 可替换用于到期测试 |
| 前端增量 | React/TypeScript/Vite/Tailwind/Radix 的可启动外壳；浏览器协议测试页属于测试夹具，不是新增产品页面 |

## 3. 版本、启动与资源初值

使用回环地址和总架构的端口约定。启动前先核查现有工具，安装或启动的实际动作只能在本阶段获准执行后进行。记录 Go、Node、包管理器、Docker Engine、FFmpeg/ffprobe、镜像及客户端模块的精确版本。

| 对象 | 设计约束 | 验证记录必须包含 |
| --- | --- | --- |
| Go / Gin / sa-token-go | 满足固定 sa-token-go 模块的编译要求，不混用 main 文档与另一发行版 | Go toolchain、全部 sa-token-go 子模块版本、Gin 版本 |
| PostgreSQL | 支持本文 SQL、事务与 SKIP LOCKED | 镜像标签/摘要、服务端版本、驱动版本 |
| Redis | 官方 sa-token-go adapter 可用，AOF 和数据卷启用 | 镜像摘要、重启恢复结果 |
| RabbitMQ | 单成员 quorum、confirm、mandatory、手动 ack | 镜像摘要、amqp091-go 版本、队列参数、ack 超时 |
| RustFS | 候选 1.0.6，ARM64 | 镜像摘要、S3 客户端版本、CORS/签名结果 |
| FFmpeg | 有 H.264/AAC 编码及 HLS muxer | 二进制版本、编译能力、测试样本结果 |

初始容器内存预算建议 PG 512 MiB、Redis 256 MiB、RabbitMQ 1 GiB、RustFS 2 GiB，Docker VM 总预算先按 6 GiB 评估；这些是调试起点，不是已经测出的占用或性能保证。记录各服务空载与 probe 时的实际使用、OOM/告警情况，再固定可运行配置。普通重启不得删除命名数据卷。

## 4. 四条兼容性验证流程

### 4.1 S3 与浏览器

使用至少两个分片的已知内容样本：初始化 → 为每片签名 → 浏览器 OPTIONS/PUT → 读取 ETag → ListParts 对账 → 中断并重新打开测试页 → 补齐缺片 → Complete → GET/Range → 全文件 SHA-256 比对。

另外验证私有桶匿名读取拒绝、签名过期、改动签名头、超过授权分片长度、重复 Complete、Abort 后继续上传及清理。固定签名长度无法生效或关键 CORS/续传行为不成立时，V-02 不通过，必须给出复现证据后评审上传路径。不能把 SDK 的自动 multipart 当成浏览器恢复协议的证明。

### 4.2 sa-token-go

在测试路由中使用固定测试身份，不通过真实账号接口：创建两个独立 Token，设置 HttpOnly Cookie，分别验证身份；退出 A 后 B 仍有效；重启 API 后 Redis 中状态仍可读取；等价短 TTL/可控时间验证访问不续期。检查实际 Set-Cookie 的 Path、HttpOnly、SameSite 和删除行为。

验证项目只从 Cookie 读取身份：有效 Token 放到 URL/Authorization 不能绕过项目入口规则。若绕开库的 Cookie helper，仍使用其 Token 管理能力，不另造认证框架。

### 4.3 RabbitMQ

发送持久测试消息并获得发布结果；消费者读到后先不 ack，关闭连接，确认发生重投，再 ack。测试不存在绑定的 routing key 必须返回投递失败，并验证达到 delivery-limit 后保留到指定死信队列，而不是消失。客户端不同通知通道的到达顺序不能导致“confirm 先被处理就误判成功”。

用可缩短的 ack 超时配置验证超时行为，记录固定 RabbitMQ 版本的实际语义。正常转码任务的最大执行时间和 broker ack 超时在 M3 按有余量的关系配置。

### 4.4 PostgreSQL 与生命周期

通过 pgx 执行 begin/write/read/rollback，确认数据未提交；使用测试迁移记录验证升级顺序。API 和 Worker 收到退出信号后停止接收新工作，关闭连接池。健康检查返回依赖状态但不泄露凭据。

## 5. 验收与证据

| 编号 | 操作与通过条件 | 证据 |
| --- | --- | --- |
| M0-AC-01 | 精确版本及摘要均有记录，重启基础服务后数据卷保留 | 版本清单、重启记录 |
| M0-AC-02 | API/Worker 启动并返回正确 live/ready；关闭关键依赖后状态变化符合契约 | HTTP 记录 |
| M0-AC-03 | 浏览器两片上传、ETag、恢复、完成、Range 和内容哈希全部匹配 | 浏览器测试报告和脱敏协议记录 |
| M0-AC-04 | 匿名读取、过期/篡改签名、超长分片、Abort 场景按预期拒绝或回收 | 反例测试结果 |
| M0-AC-05 | 两端 Token 独立，注销/固定有效期/API 重启行为符合登录规则 | 认证测试报告、Cookie 属性检查 |
| M0-AC-06 | MQ 发布确认、不可路由、断线重投、手动确认及死信保留均可复现 | 消息事件记录 |
| M0-AC-07 | 数据库事务回滚与连接关闭符合预期 | 集成测试结果 |
| M0-AC-08 | 记录四个基础服务资源及限制，无凭据进入日志或报告 | 资源记录、脱敏检查 |

V-01～V-05 中的失败不得标作“已知问题后续再说”然后直接推进依赖功能。阶段结束时更新版本锁定记录、验证结论及必要设计修订。
