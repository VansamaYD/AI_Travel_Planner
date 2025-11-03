# GitHub Releases 发布指南

本文档说明如何在 GitHub Releases 中发布 Docker 镜像文件，供用户直接下载使用。

## 准备工作

### 1. 构建 Docker 镜像

确保镜像已在阿里云镜像仓库构建完成（支持多平台：amd64 和 arm64）：

```bash
# 验证镜像是否存在
docker pull crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com/wanyidong/ai-travel-planner:main
```

### 2. 导出镜像文件

使用提供的脚本导出镜像：

```bash
# 运行导出脚本
./scripts/export-docker-images.sh v1.0.0
```

这会创建两个压缩文件：
- `docker-images/ai-travel-planner-amd64.tar.gz` - AMD64 平台镜像
- `docker-images/ai-travel-planner-arm64.tar.gz` - ARM64 平台镜像

## 创建 GitHub Release

### 步骤 1: 创建 Release

1. 访问 GitHub 仓库：[https://github.com/VansamaYD/AI_Travel_Planner](https://github.com/VansamaYD/AI_Travel_Planner)
2. 点击右侧的 **Releases** → **Create a new release**
3. 或直接访问：[https://github.com/VansamaYD/AI_Travel_Planner/releases/new](https://github.com/VansamaYD/AI_Travel_Planner/releases/new)

### 步骤 2: 填写 Release 信息

- **Tag version**: 输入版本号，例如：`v1.0.0`
- **Release title**: 例如：`AI Travel Planner v1.0.0`
- **Description**: 复制以下内容：

```markdown
## Docker 镜像下载

本次发布包含预构建的 Docker 镜像文件，支持以下平台：

- **AMD64** (`ai-travel-planner-amd64.tar.gz`) - 适用于 Intel/AMD 服务器
- **ARM64** (`ai-travel-planner-arm64.tar.gz`) - 适用于 Apple Silicon Mac

## 使用方法

详细的下载和运行说明请查看 [DOCKER_DOWNLOAD.md](https://github.com/VansamaYD/AI_Travel_Planner/blob/main/DOCKER_DOWNLOAD.md)

### 快速开始

1. 下载对应平台的镜像文件
2. 解压并导入镜像：
   ```bash
   gunzip ai-travel-planner-amd64.tar.gz  # 或 arm64
   docker load -i ai-travel-planner-amd64.tar
   ```
3. 配置环境变量（参考 `.env.example`）
4. 运行容器（参考 `DOCKER_DOWNLOAD.md`）

## 环境要求

- Docker 20.10+
- 环境变量配置文件（.env）

## 相关文档

- [完整下载指南](DOCKER_DOWNLOAD.md)
- [部署文档](DEPLOY.md)
- [项目 README](README.md)
```

### 步骤 3: 上传文件

1. 点击 **Attach binaries by dropping them here or selecting them**
2. 上传以下文件：
   - `docker-images/ai-travel-planner-amd64.tar.gz`
   - `docker-images/ai-travel-planner-arm64.tar.gz`
3. 或者拖放文件到上传区域

### 步骤 4: 发布

1. 确认信息无误
2. 选择 **Set as the latest release**（如果是最新版本）
3. 点击 **Publish release**

## 用户如何使用

用户可以通过以下方式获取镜像：

### 方式一：从 GitHub Releases 下载（推荐）

1. 访问 [Releases 页面](https://github.com/VansamaYD/AI_Travel_Planner/releases)
2. 下载对应平台的镜像文件
3. 按照 [DOCKER_DOWNLOAD.md](DOCKER_DOWNLOAD.md) 中的说明使用

### 方式二：从阿里云镜像仓库拉取

```bash
docker login crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com
docker pull crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com/wanyidong/ai-travel-planner:main
```

## 更新 Release

如果镜像有更新：

1. 重新导出镜像文件
2. 编辑现有的 Release
3. 删除旧文件，上传新文件
4. 更新 Release 描述

## 最佳实践

1. **版本命名**：使用语义化版本号（如 v1.0.0, v1.1.0）
2. **文件命名**：包含平台信息（amd64, arm64）
3. **压缩文件**：使用 .tar.gz 格式，减小文件大小
4. **文档链接**：在 Release 描述中链接到详细文档
5. **更新日志**：记录每个版本的变更

## 自动化（可选）

可以使用 GitHub Actions 自动创建 Release：

1. 创建标签触发构建
2. 构建完成后自动导出镜像
3. 自动创建 Release 并上传文件

详细配置可参考 `.github/workflows/docker-build.yml`。

---

**提示**：每次发布新版本时，确保：
- 镜像已构建完成
- 已导出多平台镜像文件
- Release 描述清晰完整
- 提供详细的下载和使用说明

