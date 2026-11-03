# Pet 后端部署（域名：pet.jiangker.cn）

服务器上**不要** clone 整个 Git 仓库。目录里只放 2 个文件（反代用你现有 Nginx，仓库不强制提交 Nginx 配置）。

部署目录：**`/root/docker/pet-game`**

```text
/root/docker/pet-game/
  docker-compose.yml
  .env
```

域名 **`https://pet.jiangker.cn`** → 反代到本机 **`127.0.0.1:18766`**。

---

## 0. 前置

- 服务器已装 Docker + Compose，可 SSH
- 已有 PostgreSQL，并建好库与用户（示例库名 `pet`）
- DNS：`pet.jiangker.cn` A 记录指向该服务器
- 阿里云 ACR 已有仓库 `jiangker/pet-api`（或改镜像名）
- GitHub Secrets 已配齐（见下文）

---

## 1. 创建目录

```bash
mkdir -p /root/docker/pet-game
cd /root/docker/pet-game
```

---

## 2. 文件一：`docker-compose.yml`

整文件内容（可与仓库 `deploy/docker-compose.yml` 一致）：

```yaml
# 服务器上只需本文件 + 同目录 .env（无需 git 仓库）
services:
  api:
    image: ${API_IMAGE:-registry.cn-hangzhou.aliyuncs.com/jiangker/pet-api:latest}
    container_name: pet-api
    restart: unless-stopped
    env_file: .env
    extra_hosts:
      - "host.docker.internal:host-gateway"
    ports:
      - "${HOST_PORT:-18766}:3000"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 25s
```

写入：

```bash
cat > /root/docker/pet-game/docker-compose.yml << 'EOF'
# 服务器上只需本文件 + 同目录 .env（无需 git 仓库）
services:
  api:
    image: ${API_IMAGE:-registry.cn-hangzhou.aliyuncs.com/jiangker/pet-api:latest}
    container_name: pet-api
    restart: unless-stopped
    env_file: .env
    extra_hosts:
      - "host.docker.internal:host-gateway"
    ports:
      - "${HOST_PORT:-18766}:3000"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 25s
EOF
```

说明：

- 容器内 API 固定 **3000**
- 宿主机映射 **`HOST_PORT`（默认 18766）→ 3000**
- `host.docker.internal` 方便容器访问「装在宿主机上的 Postgres」

---

## 3. 文件二：`.env`

**不要提交到 Git。** 在服务器上创建并改成真值：

```bash
cat > /root/docker/pet-game/.env << 'EOF'
API_IMAGE=registry.cn-hangzhou.aliyuncs.com/jiangker/pet-api:latest
HOST_PORT=18766

# Postgres：密码、主机按实际改
# - Postgres 在宿主机：用 host.docker.internal
# - Postgres 在别的机器/RDS：改成真实主机名
DATABASE_URL=postgres://pet:换成真实密码@host.docker.internal:5432/pet

RUST_LOG=info,sqlx=warn,tower_http=info

WX_APPID=换成小游戏AppID
WX_SECRET=换成小游戏AppSecret
JWT_SECRET=换成一串很长的随机字符

# 可选：积压扫描间隔（秒）
# PENDING_MONITOR_SECS=3600
EOF
chmod 600 /root/docker/pet-game/.env
```

| 变量 | 含义 |
|---|---|
| `API_IMAGE` | CI 推送的镜像，需与 GitHub Actions 一致 |
| `HOST_PORT` | 本机对外端口，反代指这里；**不要**再写 `PORT=` |
| `DATABASE_URL` | 连接串；库用户需有建表权限（启动时自动跑 `001_init.sql`） |
| `WX_APPID` / `WX_SECRET` | 微信登录；不配则走开发 openid（勿用于生产） |
| `JWT_SECRET` | 签发登录 token；换掉会使旧 token 全部失效 |

Postgres 若尚未建库（示例）：

```sql
CREATE USER pet WITH PASSWORD '换成真实密码';
CREATE DATABASE pet OWNER pet;
```

---

## 4. 首次拉起

若镜像在私有 ACR，先登录：

```bash
docker login registry.cn-hangzhou.aliyuncs.com
cd /root/docker/pet-game
docker compose pull
docker compose up -d
docker compose exec -T api wget -qO- http://127.0.0.1:3000/health
curl -s http://127.0.0.1:18766/health
```

期望看到类似：`{"status":"ok","api_version":"...","min_client_version":"..."}`。

表结构和 `cases`/`quality` 种子会在 API 首次启动时自动写入，无需手建表。

---

## 5. 域名 pet.jiangker.cn（Nginx 示例）

仓库不包含 Nginx；在你现有反代上增加站点即可。TLS 用 certbot 或已有证书。

```nginx
server {
    listen 443 ssl http2;
    server_name pet.jiangker.cn;

    # ssl_certificate     /path/to/fullchain.pem;
    # ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:18766;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}

server {
    listen 80;
    server_name pet.jiangker.cn;
    return 301 https://$host$request_uri;
}
```

重载后自检：

```bash
curl -s https://pet.jiangker.cn/health
```

需要通的路径：

- `GET /health`
- `POST /api/login`
- `POST /api/*`（带 `Authorization: Bearer ...`）

---

## 6. 微信小游戏

1. 公众平台 → 开发管理 → 开发设置 → **request 合法域名** 填：`pet.jiangker.cn`（不要加 `https://` 路径）
2. 客户端切到此后端（真机/开发者工具执行一次）：

```js
wx.setStorageSync('pet_api_base_v1', 'https://pet.jiangker.cn')
```

---

## 7. GitHub 自动部署

### Secrets（仓库 Settings → Secrets and variables → Actions）

| Secret | 填什么 |
|---|---|
| `ALIYUN_REGISTRY_USER` | ACR 用户名 |
| `ALIYUN_REGISTRY_PASSWORD` | ACR 密码 |
| `DEPLOY_HOST` | 这台服务器 IP/域名 |
| `DEPLOY_USER` | SSH 用户 |
| `DEPLOY_PASSWORD` | SSH 密码 |
| `DEPLOY_PORT` | SSH 端口，一般 `22` |
| `DEPLOY_PATH` | **`/root/docker/pet-game`** |

push 到 `main`/`master` 且改动 `server/**` 或 `deploy/**` 时：构建推镜像 → SSH 到 `DEPLOY_PATH` → `docker compose pull && up`。  
**无需**创建 GitHub Environment，无需人工点批准。

服务器上的 `docker-compose.yml` / `.env` **不会**被 CI 覆盖；CI 只拉新镜像并重启容器。

---

## 8. 核对清单

- [ ] `/root/docker/pet-game/docker-compose.yml` 与 `.env` 已就位，`.env` 权限 600
- [ ] `DATABASE_URL` / `JWT_SECRET` / `WX_*` 为生产真值
- [ ] `curl http://127.0.0.1:18766/health` 与 `curl https://pet.jiangker.cn/health` 均为 ok
- [ ] 微信合法域名已加 `pet.jiangker.cn`
- [ ] 客户端已设 `pet_api_base_v1` = `https://pet.jiangker.cn`
- [ ] GitHub 七项 Secrets 已填，`DEPLOY_PATH=/root/docker/pet-game`
