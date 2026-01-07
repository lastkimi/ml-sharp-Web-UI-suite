# 域名和 HTTPS 配置总结

## 域名配置

- **域名**: `3d.is-ai.app`
- **服务器 IP**: `23.95.182.228`
- **HTTP 端口**: 80 (自动重定向到 HTTPS)
- **HTTPS 端口**: 443

## SSL 证书

- **证书类型**: Let's Encrypt
- **证书路径**: `/etc/letsencrypt/live/3d.is-ai.app/`
- **证书文件**:
  - `fullchain.pem` - 完整证书链
  - `privkey.pem` - 私钥
  - `cert.pem` - 证书
  - `chain.pem` - 中间证书

## 访问地址

- **HTTPS**: `https://3d.is-ai.app`
- **HTTP**: `http://3d.is-ai.app` (自动重定向到 HTTPS)

## Nginx 配置

- **配置文件**: `/etc/nginx/sites-available/ml-sharp`
- **启用链接**: `/etc/nginx/sites-enabled/ml-sharp`

### 主要特性

1. **HTTP 到 HTTPS 重定向**: 所有 HTTP 请求自动重定向到 HTTPS
2. **SSL 优化**: 使用 TLS 1.2 和 1.3，优化的加密套件
3. **安全头**: 
   - Strict-Transport-Security (HSTS)
   - X-Frame-Options
   - X-Content-Type-Options
   - X-XSS-Protection
4. **文件上传限制**: 100MB
5. **超时设置**: 
   - 常规请求: 300秒
   - API 请求: 600秒（支持长时间 ML 推理）

## 证书自动续期

Let's Encrypt 证书有效期为 90 天，系统会自动续期。

### 手动续期

```bash
certbot renew
systemctl reload nginx
```

### 测试续期

```bash
certbot renew --dry-run
```

## 系统状态

### 内存
- **总内存**: 32GB
- **已使用**: ~13GB
- **可用**: ~18GB

### 磁盘
- **主磁盘**: 908GB (已用 86GB, 可用 776GB)
- **数据磁盘**: 1.8TB (已用 2.1MB, 可用 1.7TB)

### CPU
- **负载**: 根据系统负载动态变化
- **使用率**: 根据实际工作负载

## 故障排除

### 证书问题

1. **检查证书状态**:
   ```bash
   certbot certificates
   ```

2. **查看证书详情**:
   ```bash
   openssl x509 -in /etc/letsencrypt/live/3d.is-ai.app/cert.pem -text -noout
   ```

3. **测试 SSL 连接**:
   ```bash
   openssl s_client -connect 3d.is-ai.app:443 -servername 3d.is-ai.app
   ```

### Nginx 问题

1. **测试配置**:
   ```bash
   nginx -t
   ```

2. **查看错误日志**:
   ```bash
   tail -f /var/log/nginx/error.log
   ```

3. **查看访问日志**:
   ```bash
   tail -f /var/log/nginx/access.log
   ```

### DNS 问题

确保域名 DNS 记录指向服务器 IP:
```bash
dig 3d.is-ai.app
nslookup 3d.is-ai.app
```

## 安全建议

1. **定期更新证书**: 证书会自动续期，但建议定期检查
2. **监控服务状态**: 使用 `systemctl status ml-sharp` 检查服务
3. **查看日志**: 定期检查 Nginx 和应用程序日志
4. **防火墙配置**: 确保只开放必要的端口（80, 443）

## 更新配置

如果需要更新 Nginx 配置:

```bash
# 1. 编辑配置
nano /etc/nginx/sites-available/ml-sharp

# 2. 测试配置
nginx -t

# 3. 重新加载
systemctl reload nginx
```
