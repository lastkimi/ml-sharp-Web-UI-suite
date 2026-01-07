# Vercel 部署指南

本文档说明如何将 ML-Sharp 项目部署到 Vercel。

## 📋 前置要求

1. **Vercel 账户**：注册 [Vercel](https://vercel.com) 账户
2. **Vercel CLI**（可选）：`npm i -g vercel`
3. **Git 仓库**：将代码推送到 GitHub/GitLab/Bitbucket

## 🚀 部署步骤

### 方法 1：通过 Vercel Dashboard（推荐）

1. **导入项目**
   - 登录 [Vercel Dashboard](https://vercel.com/dashboard)
   - 点击 "Add New..." → "Project"
   - 选择你的 Git 仓库

2. **配置项目**
   - **Framework Preset**: 选择 "Other" 或 "Python"
   - **Root Directory**: 留空（使用根目录）
   - **Build Command**: 留空（静态文件无需构建）
   - **Output Directory**: `artwork-depth-app`
   - **Install Command**: `pip install -r requirements.txt`（如果需要）

3. **环境变量**（如果需要）
   - 在项目设置中添加必要的环境变量
   - 例如：`PYTORCH_MPS_HIGH_WATERMARK_RATIO=0.0`

4. **部署**
   - 点击 "Deploy"
   - 等待部署完成

### 方法 2：通过 Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 生产环境部署
vercel --prod
```

## ⚙️ 配置说明

### `vercel.json`

项目已包含 `vercel.json` 配置文件，包含以下设置：

- **路由配置**：将 `/api/predict` 路由到无服务器函数
- **静态文件服务**：`artwork-depth-app/` 目录作为静态文件
- **CORS 头**：允许跨域请求
- **重写规则**：根路径重定向到 `index.html`

### API 函数限制

⚠️ **重要提示**：Vercel 无服务器函数有以下限制：

- **执行时间**：
  - Hobby 计划：10 秒
  - Pro 计划：60 秒
  - Enterprise：300 秒

- **内存限制**：
  - Hobby：1024 MB
  - Pro：3008 MB

- **文件大小**：上传文件限制为 4.5 MB（Hobby）或 50 MB（Pro）

**ML-Sharp 模型推理可能需要更长时间和更多资源**，建议：

1. **使用 Vercel Pro 计划**（60 秒超时）
2. **使用外部 API 服务**：将 ML 推理部署到独立的服务器（如 Railway、Render、AWS Lambda）
3. **使用 Vercel Blob Storage**：存储生成的 `.ply` 文件

## 📊 Vercel Analytics

项目已集成 Vercel Analytics：

- **自动启用**：在 Vercel 部署后自动启用
- **页面追踪**：所有页面自动追踪访问量
- **自定义事件**：可通过 `window.trackEvent()` 追踪自定义事件

### 查看分析数据

1. 登录 Vercel Dashboard
2. 选择项目
3. 进入 "Analytics" 标签页
4. 查看页面访问、性能指标等数据

## 🔧 本地开发

本地开发时，Analytics 脚本会优雅降级（不会报错）：

```bash
# 启动本地服务器
source .venv/bin/activate
python server.py
```

访问 `http://localhost:8000` 进行本地测试。

## 📁 项目结构

```
ml-sharp/
├── vercel.json              # Vercel 配置
├── .vercelignore           # 排除文件
├── api/
│   ├── predict.py          # ML 推理 API（无服务器函数）
│   └── health.py           # 健康检查端点
├── artwork-depth-app/      # 前端静态文件
│   ├── index.html
│   ├── *.html
│   ├── js/
│   │   └── analytics.js    # Analytics 集成脚本
│   └── ...
└── ...
```

## 🐛 故障排除

### 问题：API 函数超时

**解决方案**：
- 升级到 Vercel Pro 计划
- 或使用外部 API 服务处理 ML 推理

### 问题：静态文件未正确加载

**检查**：
- 确认 `vercel.json` 中的路由配置正确
- 检查文件路径是否匹配

### 问题：Analytics 未工作

**检查**：
- 确认项目已在 Vercel 上部署
- 检查浏览器控制台是否有错误
- 确认 Analytics 已在 Vercel Dashboard 中启用

## 📝 注意事项

1. **模型文件大小**：ML-Sharp 模型文件较大，首次部署可能需要较长时间
2. **冷启动**：无服务器函数首次调用可能有延迟（冷启动）
3. **存储限制**：Vercel 免费计划有存储限制，考虑使用外部存储服务
4. **环境变量**：敏感信息（如 API 密钥）应通过环境变量配置，不要提交到代码库

## 🔗 相关链接

- [Vercel 文档](https://vercel.com/docs)
- [Vercel Analytics](https://vercel.com/analytics)
- [Vercel 无服务器函数](https://vercel.com/docs/functions)
- [Python 运行时](https://vercel.com/docs/functions/runtimes/python)
