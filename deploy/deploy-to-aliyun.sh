#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "用法: deploy/deploy-to-aliyun.sh user@server [remote_dir]" >&2
  echo "示例: deploy/deploy-to-aliyun.sh root@47.106.124.32 /opt/ai-thomas" >&2
  exit 1
fi

REMOTE="$1"
REMOTE_DIR="${2:-/opt/ai-thomas}"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_ID="$(date +%Y%m%d%H%M%S)"
REMOTE_RELEASE="${REMOTE_DIR}/releases/${RELEASE_ID}"
REMOTE_CURRENT="${REMOTE_DIR}/current"

echo "==> 同步 AI Thomas 到 ${REMOTE}:${REMOTE_RELEASE}"
ssh "$REMOTE" "mkdir -p '${REMOTE_DIR}/releases' '${REMOTE_DIR}/shared/logs' '${REMOTE_DIR}/shared/data'"

rsync -az --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'logs/' \
  --exclude '.data/' \
  --exclude '.DS_Store' \
  --include '.env.example' \
  --exclude '.env' \
  --exclude '.env.*' \
  "${LOCAL_DIR}/" "${REMOTE}:${REMOTE_RELEASE}/"

echo "==> 准备生产配置"
ssh "$REMOTE" "bash -s" <<EOF
set -euo pipefail
cd '${REMOTE_DIR}'
if [[ ! -f shared/.env.production ]]; then
  cp '${REMOTE_RELEASE}/.env.example' shared/.env.production
  chmod 600 shared/.env.production
fi
ln -sfn '${REMOTE_DIR}/shared/.env.production' '${REMOTE_RELEASE}/.env.production'
ln -sfn '${REMOTE_DIR}/shared/logs' '${REMOTE_RELEASE}/logs'
ln -sfn '${REMOTE_DIR}/shared/data' '${REMOTE_RELEASE}/.data'
ln -sfn '${REMOTE_RELEASE}' '${REMOTE_CURRENT}'
EOF

echo "==> 启动或重启 AI Thomas"
ssh "$REMOTE" "bash -s" <<EOF
set -euo pipefail
cd '${REMOTE_CURRENT}'
if ! command -v node >/dev/null 2>&1; then
  echo '服务器缺少 Node.js，请先安装 Node.js 20+。' >&2
  exit 2
fi
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi
mkdir -p logs
pm2 delete ai-thomas >/dev/null 2>&1 || true
pm2 start deploy/ecosystem.config.cjs --update-env
pm2 save
EOF

echo "==> 确认 Nginx /thomas/ 路由"
ssh "$REMOTE" "bash -s" <<'EOF'
set -euo pipefail
NGINX_CONF="/etc/nginx/conf.d/themescope.conf"
if [[ -f "$NGINX_CONF" ]]; then
  python3 - <<'PY'
from pathlib import Path
from datetime import datetime
path = Path("/etc/nginx/conf.d/themescope.conf")
text = path.read_text()
block = """    location = /thomas {
        return 301 /thomas/;
    }

    location ^~ /thomas/ {
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
        proxy_pass http://127.0.0.1:8787/;
    }
"""
if "location ^~ /thomas/" not in text:
    marker = "    location /api/ {"
    if marker not in text:
        raise SystemExit("Could not find /api/ insertion point in Nginx config")
    backup = path.with_name(path.name + ".bak-ai-thomas-" + datetime.now().strftime("%Y%m%d%H%M%S"))
    backup.write_text(text)
    path.write_text(text.replace(marker, block + "\n" + marker))
PY
  nginx -t
  systemctl reload nginx
fi
EOF

echo "==> 完成。当前版本: ${RELEASE_ID}"
echo "Nginx 建议路径: /thomas/ -> http://127.0.0.1:8787/"
