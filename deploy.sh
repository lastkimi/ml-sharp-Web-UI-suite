#!/bin/bash

# ML-Sharp 服务器部署脚本
# 服务器信息
SERVER_IP="23.95.182.228"
SERVER_USER="root"
SERVER_PASS="R57qctsvgrzN"
SSH_PORT=22

# 项目配置
PROJECT_NAME="ml-sharp"
DEPLOY_DIR="/opt/ml-sharp"
FRONTEND_PORT=8001
BACKEND_PORT=8002

echo "=== ML-Sharp 部署脚本 ==="

# 1. 检查本地代码
if [ ! -f "server.py" ]; then
    echo "错误: 未找到 server.py，请确保在项目根目录运行此脚本"
    exit 1
fi

# 2. SSH 连接到服务器并检查端口
echo "检查服务器端口占用情况..."
ssh -o StrictHostKeyChecking=no -p $SSH_PORT $SERVER_USER@$SERVER_IP << 'ENDSSH'
    echo "=== 当前端口占用情况 ==="
    netstat -tuln | grep LISTEN | awk '{print $4}' | awk -F: '{print $NF}' | sort -n | uniq
    echo ""
    echo "=== 运行中的 Python/Node 服务 ==="
    ps aux | grep -E 'python|node|uvicorn|gunicorn' | grep -v grep || echo "无"
    echo ""
    echo "=== Nginx 配置 ==="
    ls -la /etc/nginx/sites-enabled/ 2>/dev/null || ls -la /etc/nginx/conf.d/ 2>/dev/null || echo "nginx 配置目录未找到"
ENDSSH

# 3. 创建部署目录并上传代码
echo "创建部署目录..."
ssh -o StrictHostKeyChecking=no -p $SSH_PORT $SERVER_USER@$SERVER_IP "mkdir -p $DEPLOY_DIR"

# 4. 使用 rsync 上传代码（排除不需要的文件）
echo "上传项目文件..."
rsync -avz --exclude='.git' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.venv' \
    --exclude='venv' \
    --exclude='uploads/*' \
    --exclude='output/*.ply' \
    --exclude='server.log' \
    --exclude='.DS_Store' \
    -e "ssh -o StrictHostKeyChecking=no -p $SSH_PORT" \
    ./ $SERVER_USER@$SERVER_IP:$DEPLOY_DIR/

# 5. 在服务器上设置环境
echo "在服务器上设置环境..."
ssh -o StrictHostKeyChecking=no -p $SSH_PORT $SERVER_USER@$SERVER_IP << ENDSSH
    cd $DEPLOY_DIR
    
    # 检查 Python 版本
    python3 --version || python --version
    
    # 创建虚拟环境（如果不存在）
    if [ ! -d "venv" ]; then
        python3 -m venv venv || python -m venv venv
    fi
    
    # 激活虚拟环境并安装依赖
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    
    # 创建必要的目录
    mkdir -p uploads output
    
    echo "环境设置完成"
ENDSSH

# 6. 创建 systemd 服务文件
echo "创建 systemd 服务..."
ssh -o StrictHostKeyChecking=no -p $SSH_PORT $SERVER_USER@$SERVER_IP << ENDSSH
    cat > /etc/systemd/system/ml-sharp.service << EOF
[Unit]
Description=ML-Sharp Web Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$DEPLOY_DIR
Environment="PATH=$DEPLOY_DIR/venv/bin"
ExecStart=$DEPLOY_DIR/venv/bin/python $DEPLOY_DIR/server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # 修改 server.py 以使用指定端口
    sed -i "s/port=8000/port=$BACKEND_PORT/g" $DEPLOY_DIR/server.py || \
    sed -i "s/port = 8000/port = $BACKEND_PORT/g" $DEPLOY_DIR/server.py || \
    echo "uvicorn.run(app, host=\"0.0.0.0\", port=$BACKEND_PORT)" >> $DEPLOY_DIR/server.py
ENDSSH

# 7. 创建 Nginx 配置（可选）
echo "创建 Nginx 配置..."
ssh -o StrictHostKeyChecking=no -p $SSH_PORT $SERVER_USER@$SERVER_IP << ENDSSH
    cat > /etc/nginx/sites-available/ml-sharp << EOF
server {
    listen 80;
    server_name _;  # 可以根据需要修改为具体域名
    
    # 前端静态文件
    location / {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # API 端点
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # 输出文件
    location /output/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_set_header Host \$host;
    }
}
EOF

    # 创建符号链接（如果 sites-enabled 存在）
    if [ -d "/etc/nginx/sites-enabled" ]; then
        ln -sf /etc/nginx/sites-available/ml-sharp /etc/nginx/sites-enabled/ml-sharp
        nginx -t && systemctl reload nginx || echo "Nginx 配置测试失败，请手动检查"
    else
        echo "Nginx sites-enabled 目录不存在，配置文件已创建在 /etc/nginx/sites-available/ml-sharp"
    fi
ENDSSH

# 8. 启动服务
echo "启动服务..."
ssh -o StrictHostKeyChecking=no -p $SSH_PORT $SERVER_USER@$SERVER_IP << ENDSSH
    systemctl daemon-reload
    systemctl enable ml-sharp
    systemctl start ml-sharp
    systemctl status ml-sharp --no-pager
ENDSSH

echo ""
echo "=== 部署完成 ==="
echo "服务地址: http://$SERVER_IP:$BACKEND_PORT"
echo "查看日志: ssh $SERVER_USER@$SERVER_IP 'journalctl -u ml-sharp -f'"
echo "重启服务: ssh $SERVER_USER@$SERVER_IP 'systemctl restart ml-sharp'"
