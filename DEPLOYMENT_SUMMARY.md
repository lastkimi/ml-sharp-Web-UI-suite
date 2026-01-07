# ML-Sharp 服务器部署总结

## 部署信息

- **服务器 IP**: 23.95.182.228
- **部署目录**: `/opt/ml-sharp`
- **服务端口**: 8001
- **服务名称**: `ml-sharp.service`
- **Nginx 配置**: `/etc/nginx/sites-available/ml-sharp`

## 访问地址

- **直接访问**: `http://23.95.182.228:8001`
- **通过 Nginx**: `http://23.95.182.228` (如果配置了域名)

## 服务管理命令

### 查看服务状态
```bash
ssh root@23.95.182.228 "systemctl status ml-sharp"
```

### 查看服务日志
```bash
ssh root@23.95.182.228 "journalctl -u ml-sharp -f"
```

### 重启服务
```bash
ssh root@23.95.182.228 "systemctl restart ml-sharp"
```

### 停止服务
```bash
ssh root@23.95.182.228 "systemctl stop ml-sharp"
```

### 启动服务
```bash
ssh root@23.95.182.228 "systemctl start ml-sharp"
```

## 文件位置

- **项目代码**: `/opt/ml-sharp`
- **虚拟环境**: `/opt/ml-sharp/venv`
- **上传文件**: `/opt/ml-sharp/uploads`
- **输出文件**: `/opt/ml-sharp/output`
- **服务配置**: `/etc/systemd/system/ml-sharp.service`
- **Nginx 配置**: `/etc/nginx/sites-available/ml-sharp`

## 端口使用情况

- **8001**: ML-Sharp 后端服务（FastAPI）
- **80**: Nginx（反向代理）

## 注意事项

1. **模型加载时间**: 首次启动时，模型需要下载和加载，可能需要几分钟时间
2. **内存使用**: 服务运行需要大量内存（约 5-8GB），请确保服务器有足够资源
3. **GPU 支持**: 当前使用 CPU 模式，如需 GPU 加速，需要安装 CUDA 和相应的 PyTorch 版本
4. **文件上传限制**: Nginx 已配置 `client_max_body_size 100M`，可根据需要调整

## 更新部署

如果需要更新代码：

```bash
# 1. 上传新代码
rsync -avz --exclude='.git' --exclude='__pycache__' --exclude='*.pyc' \
    --exclude='.venv' --exclude='venv' --exclude='uploads/*' \
    --exclude='output/*.ply' --exclude='server.log' \
    -e "sshpass -p 'R57qctsvgrzN' ssh -o StrictHostKeyChecking=no -p 22" \
    ./ root@23.95.182.228:/opt/ml-sharp/

# 2. 重启服务
sshpass -p 'R57qctsvgrzN' ssh -o StrictHostKeyChecking=no -p 22 \
    root@23.95.182.228 "systemctl restart ml-sharp"
```

## 故障排除

### 服务无法启动
1. 检查日志: `journalctl -u ml-sharp -n 50`
2. 检查端口占用: `ss -tuln | grep 8001`
3. 检查依赖: `cd /opt/ml-sharp && source venv/bin/activate && pip list`

### 模型加载失败
1. 检查网络连接
2. 检查磁盘空间: `df -h`
3. 检查模型文件: `ls -lh ~/.cache/torch/hub/checkpoints/`

### Nginx 配置问题
1. 测试配置: `nginx -t`
2. 查看错误日志: `tail -f /var/log/nginx/error.log`
3. 重新加载: `systemctl reload nginx`

## 安全建议

1. **更改默认密码**: 建议更改服务器 root 密码
2. **防火墙配置**: 确保只开放必要的端口
3. **SSL 证书**: 建议配置 HTTPS（Let's Encrypt）
4. **访问控制**: 考虑添加身份验证或 IP 白名单
