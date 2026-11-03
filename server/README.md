# Pet 后端（Axum + PostgreSQL）

实现 `docs/plan/接口冻结清单.md` 中的 12 个云函数契约，路径为 `POST /api/{functionName}`，返回 `{ code, msg, data, serverTime }`。

## 本地启动

```bash
cd server
docker compose up -d
# PowerShell
$env:DATABASE_URL="postgres://pet:pet@127.0.0.1:5432/pet"
cargo run
```

- 健康检查：`GET /health`
- 登录：`POST /api/login`，body 需含微信 `code`（未配 `WX_*` 时用开发 openid）
- 其余接口：`Authorization: Bearer <token>`

## Docker / GitHub Actions

`Dockerfile` 构建镜像；`.github/workflows/api-image.yml` 推送阿里云并 SSH 部署。生产目录见 [`deploy/README.md`](../deploy/README.md)。

## 与云函数的关系

本服务可替代微信云开发云函数；客户端通过 `EnvConfig` 的 `API_BASE_URL` 覆盖位切到 HTTP。云函数目录仍保留，互不影响。

## 数据库

仅一份迁移：`migrations/001_init.sql`（启动时 sqlx 自动执行）。配置与 GitHub Secrets 见 [`deploy/README.md`](../deploy/README.md)。

## 配置种子

启动时若库中无 `active` 的 `cases` / `quality`，会自动从 `seed/cases.json` 灌入（与客户端 `assets/bundles/cases/config/cases.json` 同构）。

## 数据同步侧写

`syncCaseResult` 在事务内还会：

- 幂等写入 `pets_cases` 并给 `users.resources` 入账
- 更新 `leaderboard`（reputation / collection / weekly）
- 按病例配置 upsert `pets`；`adopted=true` 时写 `adoptions`
- 成功时清除 `sync_pending`；配置缺失写 pending，供 `pendingMonitor` 扫描

## 冒烟

```powershell
cd server
docker compose up -d
$env:DATABASE_URL="postgres://pet:pet@127.0.0.1:5432/pet"
$env:PENDING_MONITOR_SECS="60"
cargo run
# 另开终端
.\scripts\smoke.ps1
```

