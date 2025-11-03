# Docker 镜像部署指南

本文档说明如何使用预构建的 Docker 镜像运行 AI Travel Planner 应用。

## 前置要求

- Docker 20.10+ 或 Docker Compose 2.0+
- 环境变量配置文件（.env）

## 方式一：使用 Docker Compose（推荐）

### 步骤 1: 准备环境变量

在项目根目录创建 `.env` 文件：

```bash
# 从模板复制
cp .env.example .env
```

编辑 `.env` 文件，填入您的配置（必需配置）：

```env
# Supabase 配置（必需）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# 阿里云 DashScope API 配置（必需）
DASHSCOPE_API_KEY=your_dashscope_api_key

# 高德地图 API Key（可选，但推荐）
NEXT_PUBLIC_AMAP_KEY=your_amap_api_key
```

### 步骤 2: 构建并运行

```bash
# 构建镜像（包含环境变量）
docker-compose build

# 运行容器
docker-compose up -d

# 查看日志
docker-compose logs -f web
```

### 步骤 3: 访问应用

打开浏览器访问：http://localhost:3000

## 方式二：使用预构建的 Docker 镜像

### 步骤 1: 从阿里云镜像仓库拉取镜像

```bash
# 登录阿里云镜像仓库（如果尚未登录）
docker login registry.cn-hangzhou.aliyuncs.com

# 拉取镜像
docker pull registry.cn-hangzhou.aliyuncs.com/YOUR_NAMESPACE/ai-travel-planner:latest
```

### 步骤 2: 创建环境变量文件

创建 `.env` 文件（参考 `.env.example`）：

```bash
cp .env.example .env
# 编辑 .env 文件，填入实际配置
```

### 步骤 3: 运行容器

```bash
docker run -d \
  -p 3000:3000 \
  --name ai-travel-planner \
  --env-file .env \
  --restart unless-stopped \
  registry.cn-hangzhou.aliyuncs.com/YOUR_NAMESPACE/ai-travel-planner:latest
```

### 步骤 4: 验证运行状态

```bash
# 检查容器状态
docker ps | grep ai-travel-planner

# 查看日志
docker logs -f ai-travel-planner

# 测试健康检查
curl http://localhost:3000/api/health
```

## 方式三：使用导出的镜像文件

如果您收到的是导出的 Docker 镜像文件（.tar 或 .tar.gz）：

### 步骤 1: 导入镜像

```bash
# 如果是压缩文件，先解压
gunzip ai-travel-planner.tar.gz

# 导入镜像
docker load -i ai-travel-planner.tar
```

### 步骤 2: 创建环境变量文件

```bash
cp .env.example .env
# 编辑 .env 文件，填入实际配置
```

### 步骤 3: 运行容器

```bash
docker run -d \
  -p 3000:3000 \
  --name ai-travel-planner \
  --env-file .env \
  --restart unless-stopped \
  ai-travel-planner:latest
```

## 重要提示

### 环境变量说明

⚠️ **重要**：`NEXT_PUBLIC_*` 开头的环境变量需要在**构建时**传入，因为它们会被 Next.js 嵌入到客户端代码中。

如果您使用的是预构建镜像，可能需要在运行时重新构建：

```bash
# 使用环境变量重新构建
docker-compose build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
  --build-arg NEXT_PUBLIC_AMAP_KEY=${NEXT_PUBLIC_AMAP_KEY}
```

### API Key 配置

**请勿在代码中硬编码 API Key！** 所有 API Key 都应通过环境变量配置：

1. **Supabase Key**：通过 `.env` 文件配置
2. **DashScope API Key**：通过 `.env` 文件配置
3. **高德地图 Key**：通过 `.env` 文件配置（可选）

应用启动后，这些 Key 会从环境变量中读取。

## 故障排查

### 检查环境变量

```bash
# 检查容器中的环境变量
docker exec ai-travel-planner printenv | grep -E "SUPABASE|DASHSCOPE|AMAP"
```

### 查看应用日志

```bash
# Docker Compose
docker-compose logs -f web

# 直接运行容器
docker logs -f ai-travel-planner
```

### 常见问题

1. **容器无法启动**
   - 检查端口 3000 是否被占用
   - 确认环境变量文件格式正确（无语法错误）
   - 查看 Docker 日志获取详细错误信息

2. **应用显示"加载中"**
   - 检查 Supabase 配置是否正确
   - 确认网络连接正常
   - 查看浏览器控制台错误信息

3. **AI 功能不可用**
   - 验证 DashScope API Key 是否有效
   - 检查 API 配额是否充足

## 数据库初始化

首次运行前，需要在 Supabase 中执行数据库迁移脚本：

1. 登录 Supabase 控制台
2. 进入 SQL Editor
3. 按顺序执行 `migrations/` 目录下的 SQL 脚本：
   - `001_init_schema.sql`
   - `003_budget_triggers.sql`
   - `004_add_estimated_budget_remaining.sql`
   - `002_seed_example.sql`（可选，用于测试数据）

## 生产环境部署建议

1. **使用 HTTPS**：配置反向代理（如 Nginx）提供 HTTPS
2. **环境变量管理**：使用 Docker Secrets 或环境变量管理服务
3. **监控和日志**：配置日志收集和监控服务
4. **备份策略**：定期备份 Supabase 数据库
5. **安全配置**：限制容器网络访问，使用只读文件系统等

## 技术支持

如有问题，请：
1. 查看项目 GitHub Issues
2. 检查 README.md 中的故障排查章节
3. 提交新的 Issue 描述您的问题

