# Backend DB Mode 验收清单

## 1. 目标

启用 `APP_BACKEND_MODE=db` 后，后端应满足：
1. 运行时状态写入 `persistent_state_kv`。
2. 每次 `agent/run` 写入 `agent_task_runs` 审计记录。
3. 后端可以正常启动，不依赖本机 `psql` 可执行文件。

## 2. 环境变量

至少配置：

```bash
APP_BACKEND_MODE=db
APP_DB_HOST=127.0.0.1
APP_DB_PORT=5432
APP_DB_NAME=lol_agent
APP_DB_USER=lol_agent
APP_DB_PASSWORD=***
APP_DB_SSL_MODE=disable
```

可选：

```bash
APP_DB_URL=postgres://user:password@127.0.0.1:5432/lol_agent
```

## 3. 建表

按顺序执行：

```bash
psql "host=$APP_DB_HOST port=$APP_DB_PORT dbname=$APP_DB_NAME user=$APP_DB_USER sslmode=$APP_DB_SSL_MODE" -f migrations/20260330_entitlement_billing_schema.sql
psql "host=$APP_DB_HOST port=$APP_DB_PORT dbname=$APP_DB_NAME user=$APP_DB_USER sslmode=$APP_DB_SSL_MODE" -f migrations/20260330_phase3_real_infra_schema.sql
psql "host=$APP_DB_HOST port=$APP_DB_PORT dbname=$APP_DB_NAME user=$APP_DB_USER sslmode=$APP_DB_SSL_MODE" -f migrations/20260330_phase3_db_storage_extension.sql
```

## 4. 启动与预期

启动：

```bash
npm run backend:dev
```

预期：
1. 后端可正常启动（不再因为缺少 `psql` 客户端报错）。
2. `GET /infra/db/health` 可反映 DB 连通性。

## 5. 必跑验收

1. `GET /infra/db/health` 返回 `mode=db`，且 `ok=true`（连通时）。
2. 完成一次账号绑定后执行：
   `SELECT namespace,key,updated_at FROM persistent_state_kv ORDER BY updated_at DESC LIMIT 20;`
3. 执行一次复盘与一次 AI 追问，再查 `persistent_state_kv`，确认有更新。
4. 执行：
   `SELECT task_run_id,user_id,intent,status,created_at FROM agent_task_runs ORDER BY created_at DESC LIMIT 20;`
   可看到 `AGENT_RUN` 记录。
5. 重启后端后再查询同一用户状态，确认状态可恢复（非仅内存）。

## 6. 常见错误

1. 连接错误：检查 `APP_DB_HOST/PORT/USER/PASSWORD/NAME` 或 `APP_DB_URL`。
2. 权限错误：检查 `APP_DB_USER` 是否有目标库读写权限。
3. 缺表错误：重新执行 migration，确认连接到正确数据库。
