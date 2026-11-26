---
status: superseded by ADR-0003
---

# 使用 PostgreSQL 持久任务表调度视频处理

此决定已由 [ADR-0003](0003-rabbitmq-background-jobs.md) 替代：用户明确要求引入 MQ，并选择 RabbitMQ 派发转码和媒体清理任务。以下保留原决策背景，不再作为当前实施依据。

本项目以本地学习 Go 与可靠视频处理为目标，开发者已经了解消息队列；因此选择 PostgreSQL 持久任务表，暂不引入独立 MQ 或 Redis。后台通过短事务领取任务，在事务外执行耗时处理，并自行实现心跳、超时回收、有限重试和幂等提交；这减少本地依赖，但也意味着恢复语义由项目负责，不能将行锁误认为外部媒体操作恰好执行一次的保证。

参考：[PostgreSQL SELECT — SKIP LOCKED](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)、[显式锁](https://www.postgresql.org/docs/current/explicit-locking.html)。
