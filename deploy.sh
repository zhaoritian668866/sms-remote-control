#!/bin/bash
#============================================================
# 飞鸽传书 - 一键部署脚本
# 适用系统：Ubuntu 22.04 / 24.04
# 使用方法：curl -sSL <脚本URL> | bash
#============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step() { echo -e "\n${CYAN}========== $1 ==========${NC}\n"; }

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then
  err "请使用 root 用户运行此脚本，或使用 sudo bash deploy.sh"
fi

#============================================================
step "1/10 系统更新"
#============================================================
apt-get update -y && apt-get upgrade -y
apt-get install -y curl wget git build-essential nginx certbot python3-certbot-nginx ufw

#============================================================
step "2/10 安装 Node.js 22"
#============================================================
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  log "Node.js $(node -v) 安装完成"
else
  log "Node.js $(node -v) 已安装"
fi

# 安装 pnpm
if ! command -v pnpm &> /dev/null; then
  npm install -g pnpm
  log "pnpm 安装完成"
fi

#============================================================
step "3/10 安装 MySQL 8.0"
#============================================================
if ! command -v mysql &> /dev/null; then
  apt-get install -y mysql-server
  systemctl start mysql
  systemctl enable mysql
  log "MySQL 安装完成"
else
  log "MySQL 已安装"
fi

# 生成随机数据库密码
DB_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 20)
DB_NAME="sms_remote"
DB_USER="smsapp"

# 创建数据库和用户
mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF
log "数据库 ${DB_NAME} 创建完成"

#============================================================
step "4/10 下载项目代码"
#============================================================
APP_DIR="/opt/sms-remote-control"
if [ -d "$APP_DIR" ]; then
  warn "项目目录已存在，备份旧版本..."
  mv "$APP_DIR" "${APP_DIR}.bak.$(date +%Y%m%d%H%M%S)"
fi

git clone https://github.com/zhaoritian668866/sms-remote-control.git "$APP_DIR"
cd "$APP_DIR"
log "代码下载完成"

#============================================================
step "5/10 安装依赖"
#============================================================
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
log "依赖安装完成"

#============================================================
step "6/10 配置环境变量"
#============================================================
JWT_SECRET=$(openssl rand -base64 32)
DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}"

cat > .env <<ENVEOF
# 数据库连接
DATABASE_URL=${DATABASE_URL}

# JWT 密钥（自动生成，请勿泄露）
JWT_SECRET=${JWT_SECRET}

# 服务端口
PORT=3000

# 以下为 Manus 平台专用变量，自建服务器可留空
VITE_APP_ID=self-hosted
OAUTH_SERVER_URL=
VITE_OAUTH_PORTAL_URL=
OWNER_OPEN_ID=self-hosted-owner
OWNER_NAME=admin
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_URL=
VITE_APP_TITLE=飞鸽传书
VITE_APP_LOGO=
ENVEOF
log "环境变量配置完成"

#============================================================
step "7/10 初始化数据库表"
#============================================================
npx drizzle-kit generate 2>/dev/null || true
npx drizzle-kit migrate
log "数据库表创建完成"

#============================================================
step "8/10 创建超级管理员账号"
#============================================================
ADMIN_USER="xiaoqiadmin"
ADMIN_PASS="xiaobai6688."
ADMIN_NICK="超级管理员"

node -e "
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { nanoid } = require('nanoid');

(async () => {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const hash = await bcrypt.hash('${ADMIN_PASS}', 10);
  const openId = nanoid(21);
  try {
    await conn.execute(
      'INSERT INTO users (open_id, name, username, password_hash, role, max_devices, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [openId, '${ADMIN_NICK}', '${ADMIN_USER}', hash, 'superadmin', 999, 1]
    );
    console.log('超级管理员账号创建成功');
  } catch(e) {
    if (e.code === 'ER_DUP_ENTRY') {
      console.log('超级管理员账号已存在，跳过');
    } else {
      throw e;
    }
  }
  await conn.end();
})();
"
log "管理员账号创建完成"

#============================================================
step "9/10 构建项目并配置系统服务"
#============================================================
# 构建前端和后端
pnpm build
log "项目构建完成"

# 创建 systemd 服务（开机自启 + 崩溃自动重启）
cat > /etc/systemd/system/sms-remote.service <<SVCEOF
[Unit]
Description=飞鸽传书 - 短信远程控制系统
After=network.target mysql.service
Wants=mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# 提高文件描述符限制（支持更多 WebSocket 连接）
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable sms-remote
systemctl start sms-remote
log "系统服务配置完成，已设置开机自启"

#============================================================
step "10/10 配置 Nginx 反向代理"
#============================================================

# 先读取域名（如果用户有的话）
echo ""
echo -e "${YELLOW}请输入您的域名（例如 fgmessage.cc），直接回车跳过使用IP访问：${NC}"
read -r DOMAIN

if [ -n "$DOMAIN" ]; then
  # 有域名，配置域名反向代理
  cat > /etc/nginx/sites-available/sms-remote <<NGXEOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    # WebSocket 支持
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # 其他请求
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGXEOF

  ln -sf /etc/nginx/sites-available/sms-remote /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  log "Nginx 域名反向代理配置完成"

  # 尝试申请 SSL 证书
  echo ""
  echo -e "${YELLOW}是否申请免费 SSL 证书（HTTPS）？[y/N]：${NC}"
  read -r SSL_CHOICE
  if [[ "$SSL_CHOICE" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}请输入您的邮箱（用于证书通知）：${NC}"
    read -r EMAIL
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" 2>/dev/null && \
      log "SSL 证书申请成功，已启用 HTTPS" || \
      warn "SSL 证书申请失败，请确认域名已解析到本服务器IP后手动执行：certbot --nginx -d $DOMAIN"
  fi
else
  # 无域名，使用IP访问
  cat > /etc/nginx/sites-available/sms-remote <<NGXEOF
server {
    listen 80 default_server;

    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGXEOF

  ln -sf /etc/nginx/sites-available/sms-remote /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  log "Nginx IP访问反向代理配置完成"
fi

#============================================================
# 配置防火墙
#============================================================
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw --force enable
log "防火墙配置完成"

#============================================================
# 部署完成
#============================================================
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   飞鸽传书 部署成功！${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
if [ -n "$DOMAIN" ]; then
  echo -e "  访问地址：  ${CYAN}http://${DOMAIN}${NC}"
else
  echo -e "  访问地址：  ${CYAN}http://${SERVER_IP}${NC}"
fi
echo ""
echo -e "  管理员账号：${CYAN}${ADMIN_USER}${NC}"
echo -e "  管理员密码：${CYAN}${ADMIN_PASS}${NC}"
echo ""
echo -e "  数据库密码：${CYAN}${DB_PASS}${NC}"
echo -e "  JWT 密钥：  ${CYAN}${JWT_SECRET}${NC}"
echo ""
echo -e "${YELLOW}  请妥善保管以上信息！${NC}"
echo ""
echo -e "  常用命令："
echo -e "    查看服务状态：${CYAN}systemctl status sms-remote${NC}"
echo -e "    重启服务：    ${CYAN}systemctl restart sms-remote${NC}"
echo -e "    查看日志：    ${CYAN}journalctl -u sms-remote -f${NC}"
echo -e "    停止服务：    ${CYAN}systemctl stop sms-remote${NC}"
echo ""
echo -e "  如需申请 SSL 证书："
echo -e "    ${CYAN}certbot --nginx -d 您的域名${NC}"
echo ""
echo -e "${GREEN}============================================${NC}"
