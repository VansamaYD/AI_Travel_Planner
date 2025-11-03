# Docker 镜像下载和运行指南

本文档说明如何下载和运行预构建的 Docker 镜像。

## 方式一：从阿里云镜像仓库拉取（推荐）

### 步骤 1: 登录阿里云镜像仓库

```bash
# 登录阿里云个人镜像仓库
docker login crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com
```

**用户名和密码**：使用您的阿里云账号信息登录。

### 步骤 2: 拉取镜像

```bash
# 拉取最新版本的镜像（支持多平台：amd64 和 arm64）
docker pull crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com/wanyidong/ai-travel-planner:main
```

**注意**：
- 在 Apple Silicon (M1/M2/M3) Mac 上，会自动拉取 ARM64 版本，获得最佳性能
- 在 Intel/AMD 服务器上，会自动拉取 AMD64 版本

### 步骤 3: 配置环境变量

从项目仓库下载 `.env.example` 文件，或创建 `.env` 文件：

```bash
# 创建环境变量文件
cat > .env << 'EOF'
# Supabase 配置（必需）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# 阿里云 DashScope API 配置（必需）
DASHSCOPE_API_KEY=your_dashscope_api_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions

# 高德地图 API Key（可选，但推荐）
NEXT_PUBLIC_AMAP_KEY=your_amap_api_key

# 应用配置
NEXT_PUBLIC_BASE_URL=http://localhost:3000
DEV_AUTH_FALLBACK=false
EOF
```

编辑 `.env` 文件，填入实际的配置值。

### 步骤 4: 运行容器

```bash
docker run -d \
  -p 3000:3000 \
  --name ai-travel-planner \
  --env-file .env \
  --restart unless-stopped \
  crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com/wanyidong/ai-travel-planner:main
```

### 步骤 5: 验证运行

```bash
# 检查容器状态
docker ps | grep ai-travel-planner

# 查看日志
docker logs -f ai-travel-planner

# 测试应用
curl http://localhost:3000/api/health
```

### 步骤 6: 访问应用

在浏览器中打开：http://localhost:3000

## 方式二：从 GitHub Releases 下载镜像文件

### 步骤 1: 下载镜像文件

在 GitHub 仓库的 [Releases 页面](https://github.com/VansamaYD/AI_Travel_Planner/releases) 下载：

- `ai-travel-planner-amd64.tar.gz` - AMD64 平台镜像（适用于 Intel/AMD 服务器）
- `ai-travel-planner-arm64.tar.gz` - ARM64 平台镜像（适用于 Apple Silicon Mac）

根据您的系统架构选择对应的文件。

### 步骤 2: 导入镜像

```bash
# 解压镜像文件（如果下载的是 .tar.gz）
gunzip ai-travel-planner-amd64.tar.gz  # 或 ai-travel-planner-arm64.tar.gz

# 导入镜像
docker load -i ai-travel-planner-amd64.tar  # 或 ai-travel-planner-arm64.tar
```

**验证导入**：

```bash
# 检查镜像是否存在
docker images | grep ai-travel-planner

# 应该看到类似：
# crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com/wanyidong/ai-travel-planner   main    xxxxx   2 minutes ago    xxxMB
```

### 步骤 3: 配置环境变量

参考方式一的步骤 3，创建 `.env` 文件。

### 步骤 4: 运行容器

```bash
# 使用导入的镜像运行（注意镜像名称可能不同，请使用 docker images 查看）
docker run -d \
  -p 3000:3000 \
  --name ai-travel-planner \
  --env-file .env \
  --restart unless-stopped \
  crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com/wanyidong/ai-travel-planner:main
```

## 环境变量配置说明

### 必需配置

| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | [Supabase 控制台](https://app.supabase.com/) → 项目设置 → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名密钥 | Supabase 控制台 → 项目设置 → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务角色密钥 | Supabase 控制台 → 项目设置 → API |
| `DASHSCOPE_API_KEY` | 阿里云 DashScope API 密钥 | [阿里云 DashScope 控制台](https://dashscope.console.aliyun.com/) |

### 可选配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NEXT_PUBLIC_AMAP_KEY` | 高德地图 API Key（地图功能需要） | 无 |
| `NEXT_PUBLIC_BASE_URL` | 应用基础 URL | `http://localhost:3000` |
| `DEV_AUTH_FALLBACK` | 开发认证回退 | `false` |

## 快速启动脚本

创建 `run.sh` 文件：

```bash
#!/bin/bash

# 检查环境变量文件
if [ ! -f .env ]; then
    echo "错误：.env 文件不存在"
    echo "请从 .env.example 复制并配置："
    echo "  cp .env.example .env"
    exit 1
fi

# 停止并删除旧容器（如果存在）
docker stop ai-travel-planner 2>/dev/null
docker rm ai-travel-planner 2>/dev/null

# 拉取最新镜像（如果需要）
docker pull crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com/wanyidong/ai-travel-planner:main

# 运行容器
docker run -d \
  -p 3000:3000 \
  --name ai-travel-planner \
  --env-file .env \
  --restart unless-stopped \
  crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com/wanyidong/ai-travel-planner:main

echo "容器已启动！"
echo "访问 http://localhost:3000"
```

使用：

```bash
chmod +x run.sh
./run.sh
```

## 常见问题

### Q: 如何知道我的系统架构？

```bash
# macOS/Linux
uname -m
# 输出：arm64 (Apple Silicon) 或 x86_64 (Intel/AMD)
```

### Q: ARM64 Mac 拉取镜像失败？

使用 `--platform` 强制拉取 AMD64 版本：

```bash
docker pull --platform linux/amd64 \
  crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com/wanyidong/ai-travel-planner:main
```

### Q: 容器无法启动？

1. 检查端口 3000 是否被占用：
   ```bash
   lsof -i :3000
   ```

2. 查看容器日志：
   ```bash
   docker logs ai-travel-planner
   ```

3. 检查环境变量配置：
   ```bash
   docker exec ai-travel-planner printenv | grep -E "SUPABASE|DASHSCOPE"
   ```

### Q: 如何更新镜像？

```bash
# 停止并删除旧容器
docker stop ai-travel-planner
docker rm ai-travel-planner

# 拉取最新镜像
docker pull crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com/wanyidong/ai-travel-planner:main

# 重新运行
./run.sh  # 或使用上面的 docker run 命令
```

### Q: 如何查看镜像大小？

```bash
docker images | grep ai-travel-planner
```

## 数据库初始化

首次运行前，需要在 Supabase 中执行数据库迁移：

1. 登录 [Supabase 控制台](https://app.supabase.com/)
2. 进入项目的 SQL Editor
3. 按顺序执行以下 SQL 脚本（在项目仓库的 `migrations/` 目录）：
   - `001_init_schema.sql` - 创建基础表结构
   - `003_budget_triggers.sql` - 创建预算触发器
   - `004_add_estimated_budget_remaining.sql` - 添加预算剩余字段
   - `002_seed_example.sql` - 示例数据（可选）

## 技术支持

如有问题：
1. 查看项目 [README.md](README.md)
2. 查看 [故障排查文档](DEPLOY.md#故障排查)
3. 提交 [GitHub Issue](https://github.com/VansamaYD/AI_Travel_Planner/issues)

---

**项目地址**：[https://github.com/VansamaYD/AI_Travel_Planner](https://github.com/VansamaYD/AI_Travel_Planner)

