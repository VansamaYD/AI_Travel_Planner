# Docker 镜像多平台支持

## 问题说明

在 Apple Silicon (M1/M2/M3) Mac 上拉取 Docker 镜像时可能遇到以下错误：

```
Error response from daemon: no matching manifest for linux/arm64/v8 in the manifest list entries
```

这是因为镜像只构建了 `linux/amd64` 平台，而 Apple Silicon Mac 需要 `linux/arm64` 平台。

## 解决方案

### 方案一：临时解决方案（立即使用）

使用 `--platform linux/amd64` 强制拉取 AMD64 镜像：

```bash
# 拉取镜像
docker pull --platform linux/amd64 \
  crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com/wanyidong/ai-travel-planner:main

# 运行容器
docker run -d \
  -p 3000:3000 \
  --platform linux/amd64 \
  --name ai-travel-planner \
  --env-file .env \
  crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com/wanyidong/ai-travel-planner:main
```

**注意**：使用 `--platform linux/amd64` 会在 Rosetta 下运行，性能可能略低于原生 ARM64。

### 方案二：使用 Docker Compose

在 `docker-compose.yml` 中添加平台配置：

```yaml
services:
  web:
    platform: linux/amd64
    image: crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com/wanyidong/ai-travel-planner:main
    # ... 其他配置
```

或者使用环境变量：

```yaml
services:
  web:
    platform: ${DOCKER_PLATFORM:-linux/amd64}
```

### 方案三：多平台镜像（推荐）

项目已配置 GitHub Actions 构建多平台镜像（`linux/amd64` 和 `linux/arm64`）。

当新的镜像构建完成后，可以直接拉取，无需指定平台：

```bash
# 拉取镜像（自动选择对应平台）
docker pull crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com/wanyidong/ai-travel-planner:main

# 运行容器
docker run -d \
  -p 3000:3000 \
  --name ai-travel-planner \
  --env-file .env \
  crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com/wanyidong/ai-travel-planner:main
```

## 检查镜像支持的平台

```bash
# 查看镜像支持的平台
docker manifest inspect \
  crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com/wanyidong/ai-travel-planner:main \
  | grep -A 5 "platform"
```

## 性能对比

- **原生 ARM64**：最佳性能，在 Apple Silicon Mac 上运行
- **AMD64 + Rosetta**：性能稍低，但兼容性最好

对于大多数应用，两种方式的性能差异可以忽略不计。

## 常见问题

### Q: 为什么有些镜像只有 AMD64？

A: 大多数 CI/CD 系统默认只构建 AMD64 平台。需要显式配置多平台构建。

### Q: 如何知道我的系统架构？

A: 
```bash
# macOS
uname -m
# 输出：arm64 (Apple Silicon) 或 x86_64 (Intel)

# Docker
docker version --format '{{.Server.Arch}}'
```

### Q: 可以在本地构建 ARM64 镜像吗？

A: 可以，使用 Docker Buildx：

```bash
# 创建多平台构建器
docker buildx create --name multiplatform --use

# 构建多平台镜像
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag ai-travel-planner:latest \
  --push \
  ./apps/web
```

## 参考

- [Docker 多平台构建文档](https://docs.docker.com/build/building/multi-platform/)
- [GitHub Actions 多平台构建](https://docs.github.com/en/actions/publishing-packages/publishing-docker-images#publishing-images-to-different-registries)

