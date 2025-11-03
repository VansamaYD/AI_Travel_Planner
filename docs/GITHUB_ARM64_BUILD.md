# 在 GitHub Actions 上构建 ARM64 Docker 镜像

本文档详细说明如何在 GitHub Actions 上构建支持 ARM64 的 Docker 镜像。

## 当前配置状态

项目已配置为**同时构建多平台镜像**（`linux/amd64` 和 `linux/arm64`），这样：
- Intel/AMD 服务器可以使用 AMD64 镜像
- Apple Silicon Mac 可以使用原生 ARM64 镜像，获得更好性能

## 配置说明

### 1. 启用多平台构建支持

在 `.github/workflows/docker-build.yml` 中：

```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3
  with:
    platforms: linux/amd64,linux/arm64  # 指定要构建的平台
```

### 2. 构建时指定平台

在构建步骤中：

```yaml
- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    platforms: linux/amd64,linux/arm64  # 构建多平台镜像
    # ... 其他配置
```

## 只构建 ARM64 版本（可选）

如果您想**只构建 ARM64 版本**（节省构建时间），可以修改配置：

### 方案一：只构建 ARM64

修改 `.github/workflows/docker-build.yml`：

```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3
  with:
    platforms: linux/arm64  # 只构建 ARM64

- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    platforms: linux/arm64  # 只构建 ARM64
```

### 方案二：使用工作流矩阵（同时构建但分别输出）

可以创建两个单独的作业，每个构建一个平台：

```yaml
jobs:
  build:
    strategy:
      matrix:
        platform:
          - linux/amd64
          - linux/arm64
    runs-on: ubuntu-latest
    steps:
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          platforms: ${{ matrix.platform }}
          tags: |
            your-registry/ai-travel-planner:${{ matrix.platform == 'linux/arm64' && 'arm64' || 'amd64' }}
```

## 验证构建结果

构建完成后，检查镜像支持哪些平台：

```bash
# 查看镜像 manifest
docker manifest inspect \
  registry.cn-hangzhou.aliyuncs.com/YOUR_NAMESPACE/ai-travel-planner:main

# 或使用 API
curl -H "Accept: application/vnd.docker.distribution.manifest.list.v2+json" \
  https://registry.cn-hangzhou.aliyuncs.com/v2/YOUR_NAMESPACE/ai-travel-planner/manifests/main
```

输出应该显示两个平台：
- `linux/amd64`
- `linux/arm64`

## 常见问题

### Q: 构建 ARM64 需要特殊配置吗？

A: 不需要。GitHub Actions 的 Ubuntu runner 支持使用 QEMU 模拟器构建 ARM64 镜像，配置 `platforms: linux/arm64` 即可。

### Q: ARM64 构建会慢吗？

A: 会稍微慢一些，因为使用 QEMU 模拟器。但对于大多数项目，增加的构建时间可以接受（通常增加 20-30%）。

### Q: 如何只构建 ARM64？

A: 将 `platforms` 改为只包含 `linux/arm64`：

```yaml
platforms: linux/arm64
```

### Q: 可以并行构建多个平台吗？

A: 可以，使用策略矩阵（strategy matrix）让每个平台独立构建，这样可以并行执行，但会增加 runner 使用时间。

### Q: 构建失败怎么办？

如果 ARM64 构建失败，检查：

1. **依赖兼容性**：确保所有依赖都支持 ARM64
2. **构建日志**：查看 GitHub Actions 日志中的错误信息
3. **临时解决方案**：先只构建 AMD64，在本地测试 ARM64

```yaml
# 临时禁用 ARM64
platforms: linux/amd64
```

## 当前项目配置

当前项目的配置是**同时构建两个平台**，这是推荐的配置，因为：

✅ **兼容性最好**：支持所有类型的机器  
✅ **性能最优**：用户自动获取对应平台的镜像  
✅ **构建时间可接受**：虽然稍慢，但一次性构建多个平台更方便

## 手动触发构建

如果需要立即构建 ARM64 镜像：

1. 进入 GitHub 仓库
2. 点击 **Actions** 标签
3. 选择 **Build and Push Docker Image** 工作流
4. 点击 **Run workflow**
5. 选择分支（通常是 `main`）
6. 点击 **Run workflow**

## 使用 GitHub Actions 自带的 ARM64 runner（未来）

GitHub 正在测试 ARM64 runner（`ubuntu-latest-arm64`），将来可以使用原生 ARM64 runner 构建，速度会更快：

```yaml
runs-on: ubuntu-latest-arm64  # 目前还在测试中
```

但目前仍需要使用 QEMU 模拟器。

## 参考

- [Docker Buildx 多平台构建](https://docs.docker.com/build/building/multi-platform/)
- [GitHub Actions Docker 构建](https://docs.github.com/en/actions/publishing-packages/publishing-docker-images)
- [setup-buildx-action 文档](https://github.com/docker/setup-buildx-action)

