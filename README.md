# AI Travel Planner

一个基于 AI 的智能旅行规划应用，使用 Next.js、Supabase 和阿里云 DashScope（通义千问）构建。

> 📖 **提交说明**：助教批改请查看 [README_SUBMISSION.md](README_SUBMISSION.md)，包含详细的运行说明和 API Key 配置。

## 功能特性

- 🤖 **AI 智能规划**：使用大语言模型（通义千问）自动生成旅行行程
- 🗺️ **地图可视化**：集成高德地图，实时显示行程地点和路线
- 💰 **预算管理**：自动计算和追踪旅行费用
- 🎤 **语音输入**：支持语音输入，快速创建和修改行程
- 📱 **响应式设计**：适配移动端和桌面端
- 🔐 **用户认证**：基于 Supabase 的用户注册和登录系统

## 技术栈

- **前端框架**：Next.js 14 (React 18 + TypeScript)
- **数据库**：Supabase (PostgreSQL)
- **AI 服务**：阿里云 DashScope (通义千问)
- **地图服务**：高德地图 (AMap)
- **状态管理**：SWR
- **语音识别**：Web Speech API

## 快速开始

### 前置要求

- Node.js 18+ 或 Docker
- Supabase 项目（用于数据库和认证）
- 阿里云 DashScope API Key（用于 AI 功能）
- 高德地图 API Key（可选，用于地图功能）

### 方法一：使用 Docker（推荐）

#### 1. 克隆项目

```bash
git clone <repository-url>
cd AI_Travel_Planner
```

#### 2. 配置环境变量

复制 `.env.example` 并创建 `.env` 文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入必要的配置：

```env
# Supabase 配置（必需）
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# 阿里云 DashScope API 配置（必需）
DASHSCOPE_API_KEY=your_dashscope_api_key

# 高德地图 API Key（可选，但推荐）
NEXT_PUBLIC_AMAP_KEY=your_amap_api_key
```

#### 3. 运行 Docker Compose

```bash
docker-compose up -d
```

应用将在 `http://localhost:3000` 启动。

#### 4. 停止服务

```bash
docker-compose down
```

### 方法二：本地开发

#### 1. 安装依赖

```bash
cd apps/web
npm install
```

#### 2. 配置环境变量

在 `apps/web` 目录下创建 `.env.local` 文件：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DASHSCOPE_API_KEY=your_dashscope_api_key
NEXT_PUBLIC_AMAP_KEY=your_amap_api_key
```

#### 3. 运行数据库迁移

在 Supabase 控制台执行以下 SQL 脚本（按顺序执行）：

1. `migrations/001_init_schema.sql` - 创建基础表结构
2. `migrations/002_seed_example.sql` - 示例数据（可选）
3. `migrations/003_budget_triggers.sql` - 预算触发器
4. `migrations/004_add_estimated_budget_remaining.sql` - 预算计算字段

或使用 Supabase 迁移功能：

```bash
# 在 Supabase 控制台中执行所有迁移
```

#### 4. 启动开发服务器

```bash
npm run dev
```

应用将在 `http://localhost:3000` 启动。

#### 5. 构建生产版本

```bash
npm run build
npm start
```

## Docker 构建

### 单独构建 Docker 镜像

```bash
cd apps/web
docker build -t ai-travel-planner:latest .
```

### 运行 Docker 容器

```bash
docker run -d \
  -p 3000:3000 \
  --name ai-travel-planner \
  --env-file .env \
  ai-travel-planner:latest
```

## 项目结构

```
AI_Travel_Planner/
├── apps/
│   └── web/                 # Next.js 应用
│       ├── components/       # React 组件
│       ├── lib/             # 工具库和 API 客户端
│       ├── pages/           # Next.js 页面和 API 路由
│       ├── public/          # 静态资源
│       └── Dockerfile       # Docker 构建文件
├── migrations/              # 数据库迁移脚本
├── docker-compose.yml       # Docker Compose 配置
├── .env.example            # 环境变量示例
└── README.md               # 项目文档
```

## API 文档

启动应用后，访问 `http://localhost:3000/dev/api-docs` 查看完整的 API 文档。

## 环境变量说明

### 必需配置

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 项目 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase 匿名密钥
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase 服务角色密钥（用于服务端操作）
- `DASHSCOPE_API_KEY`: 阿里云 DashScope API 密钥

### 可选配置

- `NEXT_PUBLIC_AMAP_KEY`: 高德地图 API Key（不配置将影响地图功能）
- `DASHSCOPE_BASE_URL`: DashScope API 基础 URL（默认已配置）
- `NEXT_PUBLIC_BASE_URL`: 应用基础 URL（默认：http://localhost:3000）
- `DEV_AUTH_FALLBACK`: 开发模式下的认证回退（默认：true）

## 数据库设置

### 使用 Supabase

1. 在 [Supabase](https://supabase.com) 创建新项目
2. 获取项目 URL 和 API 密钥
3. 在 SQL 编辑器中执行迁移脚本（位于 `migrations/` 目录）

### 迁移脚本说明

- `001_init_schema.sql`: 创建用户、行程、行程项、费用等核心表
- `002_seed_example.sql`: 插入示例数据（开发/测试用）
- `003_budget_triggers.sql`: 创建预算自动计算的触发器
- `004_add_estimated_budget_remaining.sql`: 添加预算剩余字段

## 开发指南

### 运行开发服务器

```bash
cd apps/web
npm run dev
```

### 代码结构

- `pages/`: Next.js 页面路由和 API 路由
  - `api/`: API 端点
    - `ai/`: AI 相关 API（chat、modify）
    - `dev/`: 开发用 API（CRUD 操作）
- `components/`: 可复用组件
  - `MapView.tsx`: 地图组件
  - `VoiceRecorder.tsx`: 语音录制组件
- `lib/`: 工具函数和客户端
  - `api.ts`: API 客户端封装
  - `supabaseClient.ts`: Supabase 客户端

### 构建 OpenAPI 文档

```bash
cd apps/web
npm run gen:openapi
```

生成的文档位于 `public/openapi.json`。

## 部署

### 使用 Docker 镜像（推荐）

#### 方式一：从 GitHub 源码构建

```bash
# 1. 克隆项目
git clone <repository-url>
cd AI_Travel_Planner

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入实际配置

# 3. 构建并运行
docker-compose up -d --build
```

#### 方式二：使用预构建的 Docker 镜像

**从阿里云镜像仓库拉取：**

```bash
# 登录阿里云镜像仓库
docker login registry.cn-hangzhou.aliyuncs.com

# 拉取镜像（请替换为实际的命名空间）
docker pull registry.cn-hangzhou.aliyuncs.com/YOUR_NAMESPACE/ai-travel-planner:latest

# 创建环境变量文件
cp .env.example .env
# 编辑 .env 文件，填入实际配置

# 运行容器
docker run -d \
  -p 3000:3000 \
  --name ai-travel-planner \
  --env-file .env \
  --restart unless-stopped \
  registry.cn-hangzhou.aliyuncs.com/YOUR_NAMESPACE/ai-travel-planner:latest
```

**使用导出的镜像文件：**

```bash
# 1. 导入镜像（如果提供的是 .tar 文件）
docker load -i ai-travel-planner.tar

# 2. 创建环境变量文件
cp .env.example .env
# 编辑 .env 文件，填入实际配置

# 3. 运行容器
docker run -d \
  -p 3000:3000 \
  --name ai-travel-planner \
  --env-file .env \
  --restart unless-stopped \
  ai-travel-planner:latest
```

#### 方式三：使用 Docker Compose（本地开发）

```bash
# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 构建并运行
docker-compose up -d --build
```

### 环境变量配置

**重要**：所有 API Key 必须通过环境变量配置，**切勿在代码中硬编码**。

必需的环境变量：

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase 项目 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase 匿名密钥
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase 服务角色密钥
- `DASHSCOPE_API_KEY` - 阿里云 DashScope API 密钥

详细说明请参考 `.env.example` 文件。

### GitHub Actions 自动构建

项目配置了 GitHub Actions 工作流，会在推送到 main 分支时自动构建 Docker 镜像并推送到阿里云镜像仓库。

**配置 GitHub Secrets**：

详细的配置步骤请查看 [GitHub Secrets 配置指南](docs/GITHUB_SECRETS_SETUP.md)。

**必需的 Secrets**：

- `ALIYUN_ACR_USERNAME` - 阿里云镜像仓库用户名
- `ALIYUN_ACR_PASSWORD` - 阿里云镜像仓库密码
- `ALIYUN_ACR_NAMESPACE` - 阿里云镜像仓库命名空间
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL（用于构建）
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase Anon Key（用于构建）
- `NEXT_PUBLIC_AMAP_KEY` - 高德地图 Key（用于构建，可选）

### 部署到云平台

#### 阿里云容器服务

1. 在阿里云容器服务中创建应用
2. 配置镜像地址为阿里云镜像仓库地址
3. 配置环境变量
4. 部署应用

#### 其他平台

任何支持 Docker 的平台都可以使用提供的 Dockerfile 或预构建镜像部署。

详细的部署说明请参考 [DEPLOY.md](DEPLOY.md)。

## 故障排查

### 常见问题

1. **应用无法启动**
   - 检查环境变量是否正确配置
   - 确认 Supabase 连接正常
   - 查看 Docker 日志：`docker-compose logs`

2. **地图不显示**
   - 检查高德地图 API Key 是否正确
   - 确认 API Key 已启用 Web 端服务

3. **AI 功能不可用**
   - 验证 DashScope API Key 是否有效
   - 检查 API 配额是否充足

4. **数据库连接失败**
   - 确认 Supabase 项目状态正常
   - 检查网络连接和防火墙设置

### 查看日志

使用 Docker Compose：
```bash
docker-compose logs -f web
```

直接运行容器：
```bash
docker logs -f ai-travel-planner
```

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

请查看 [LICENSE](LICENSE) 文件了解详细信息。

## 支持

如有问题，请提交 Issue 或联系维护者。

## Docker 镜像分发

### 导出镜像

```bash
# 导出镜像为 tar 文件
docker save ai-travel-planner:latest -o ai-travel-planner.tar

# 压缩镜像文件（可选）
gzip ai-travel-planner.tar
```

### 分发镜像

1. **方式一**：推送到阿里云镜像仓库（推荐）
   - 使用 GitHub Actions 自动构建和推送
   - 或手动推送：`docker push registry.cn-hangzhou.aliyuncs.com/YOUR_NAMESPACE/ai-travel-planner:latest`

2. **方式二**：导出镜像文件
   - 导出为 `.tar` 或 `.tar.gz` 文件
   - 提供 `.env.example` 模板文件
   - 提供部署说明文档

### 接收方使用步骤

1. **导入镜像**（如果提供的是文件）：
   ```bash
   gunzip ai-travel-planner.tar.gz  # 如果压缩了
   docker load -i ai-travel-planner.tar
   ```

2. **配置环境变量**：
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，填入实际配置
   ```

3. **运行容器**：
   ```bash
   docker run -d \
     -p 3000:3000 \
     --name ai-travel-planner \
     --env-file .env \
     --restart unless-stopped \
     ai-travel-planner:latest
   ```

详细说明请参考 [DEPLOY.md](DEPLOY.md)。

## 更新日志

查看 [ARCH.md](ARCH.md) 了解架构详细信息。

## GitHub 仓库

**项目地址**：[https://github.com/VansamaYD/AI_Travel_Planner](https://github.com/VansamaYD/AI_Travel_Planner)

**Docker 镜像下载**：查看 [DOCKER_DOWNLOAD.md](DOCKER_DOWNLOAD.md) 获取详细的下载和运行说明。

详细的 Git 提交记录可在 GitHub 仓库的 Commits 页面查看。
