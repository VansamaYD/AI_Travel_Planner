# 作业提交说明

## GitHub 仓库地址

**项目地址**：[https://github.com/VansamaYD/AI_Travel_Planner](https://github.com/VansamaYD/AI_Travel_Planner)

## 项目概述

AI Travel Planner 是一个基于 AI 的智能旅行规划应用，支持：
- AI 智能生成旅行行程
- 地图可视化展示
- 预算管理和费用追踪
- 语音输入功能
- 用户认证系统

## 技术栈

- **前端**：Next.js 14 + React 18 + TypeScript
- **数据库**：Supabase (PostgreSQL)
- **AI 服务**：阿里云 DashScope (通义千问)
- **地图服务**：高德地图
- **部署**：Docker

## 快速开始

### 方式一：使用 Docker Compose（推荐）

```bash
# 1. 克隆项目
git clone <repository-url>
cd AI_Travel_Planner

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入配置（见下方配置说明）

# 3. 构建并运行
docker-compose up -d --build

# 4. 访问应用
# 浏览器打开 http://localhost:3000
```

### 方式二：使用预构建 Docker 镜像

如果您收到的是 Docker 镜像文件：

```bash
# 1. 导入镜像
docker load -i ai-travel-planner.tar

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入配置

# 3. 运行容器
docker run -d \
  -p 3000:3000 \
  --name ai-travel-planner \
  --env-file .env \
  --restart unless-stopped \
  ai-travel-planner:latest
```

### 方式三：从阿里云镜像仓库拉取

```bash
# 登录阿里云镜像仓库
docker login registry.cn-hangzhou.aliyuncs.com

# 拉取镜像（请替换为实际地址）
docker pull registry.cn-hangzhou.aliyuncs.com/YOUR_NAMESPACE/ai-travel-planner:latest

# 运行容器（参考方式二）
```

## 环境变量配置

### 必需配置

创建 `.env` 文件（从 `.env.example` 复制），填入以下配置：

#### Supabase 配置

1. 访问 [Supabase](https://supabase.com) 创建项目
2. 在项目设置 > API 中获取：
   - `NEXT_PUBLIC_SUPABASE_URL` - 项目 URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - 匿名密钥
   - `SUPABASE_SERVICE_ROLE_KEY` - 服务角色密钥（用于服务端操作）

#### 阿里云 DashScope API 配置

**重要**：如果使用助教的 API Key，请直接在下方的配置示例中填入。

1. 访问 [阿里云 DashScope](https://dashscope.console.aliyun.com/)
2. 获取 API Key，填入：
   - `DASHSCOPE_API_KEY` - DashScope API 密钥

#### 高德地图配置（可选）

1. 访问 [高德开放平台](https://console.amap.com/dev/key/app)
2. 创建应用并获取 Web 端 Key：
   - `NEXT_PUBLIC_AMAP_KEY` - 高德地图 API Key

### 配置示例

创建 `.env` 文件，内容如下：

```env
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# 阿里云 DashScope API 配置
# 如果使用助教的 API Key，请填入下方：
DASHSCOPE_API_KEY=<助教提供的阿里云百炼平台 API Key>
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions

# 高德地图 API Key（可选）
NEXT_PUBLIC_AMAP_KEY=your_amap_key_here

# 应用配置
NEXT_PUBLIC_BASE_URL=http://localhost:3000
DEV_AUTH_FALLBACK=false
```

### 使用助教的 API Key

如果使用助教提供的阿里云百炼平台 API Key，请在 `.env` 文件中直接填入：

```env
DASHSCOPE_API_KEY=<助教提供的 API Key>
```

**注意**：请确保 API Key 在 3 个月内有效，以便助教批改作业。

## 数据库初始化

首次运行前，需要在 Supabase 中执行数据库迁移：

1. 登录 Supabase 控制台
2. 进入 SQL Editor
3. 按顺序执行以下脚本（在 `migrations/` 目录下）：
   - `001_init_schema.sql` - 创建基础表结构
   - `003_budget_triggers.sql` - 创建预算触发器
   - `004_add_estimated_budget_remaining.sql` - 添加预算剩余字段
   - `002_seed_example.sql` - 示例数据（可选）

## 验证运行

1. **检查容器状态**：
   ```bash
   docker ps | grep ai-travel-planner
   ```

2. **查看日志**：
   ```bash
   docker logs -f ai-travel-planner
   ```

3. **访问应用**：
   - 主页：http://localhost:3000
   - API 文档：http://localhost:3000/dev/api-docs
   - 健康检查：http://localhost:3000/api/health

## 故障排查

### 常见问题

1. **容器无法启动**
   - 检查端口 3000 是否被占用
   - 确认 `.env` 文件格式正确
   - 查看日志：`docker logs ai-travel-planner`

2. **页面显示"加载中"**
   - 检查 Supabase 配置是否正确
   - 确认网络连接正常
   - 查看浏览器控制台错误信息

3. **AI 功能不可用**
   - 验证 DashScope API Key 是否有效
   - 检查 API 配额是否充足
   - 确认 API Key 在 3 个月有效期内

4. **环境变量未生效**
   - 确保 `.env` 文件在项目根目录
   - 重新构建镜像：`docker-compose build --no-cache`
   - 重启容器：`docker-compose restart`

### 查看详细日志

```bash
# Docker Compose
docker-compose logs -f web

# 直接运行容器
docker logs -f ai-travel-planner

# 检查环境变量
docker exec ai-travel-planner printenv | grep -E "SUPABASE|DASHSCOPE|AMAP"
```

## 项目结构

```
AI_Travel_Planner/
├── apps/web/              # Next.js 应用
├── migrations/            # 数据库迁移脚本
├── .github/workflows/     # GitHub Actions 配置
├── docker-compose.yml     # Docker Compose 配置
├── .env.example          # 环境变量模板
├── DEPLOY.md             # 详细部署文档
├── README.md             # 项目文档
└── README_SUBMISSION.md  # 提交说明（本文件）
```

## 详细文档

- **项目文档**：查看 [README.md](README.md)
- **部署指南**：查看 [DEPLOY.md](DEPLOY.md)
- **架构说明**：查看 [ARCH.md](ARCH.md)
- **API 文档**：启动应用后访问 http://localhost:3000/dev/api-docs

## Git 提交记录

本项目保留了详细的 Git 提交记录，可以在 GitHub 仓库的 Commits 页面查看完整的开发历史。

## 联系方式

如有问题，请通过 GitHub Issues 联系。

---

**提交日期**：2025-11-03  
**版本**：v1.0.0

