#!/bin/bash
# 导出 Docker 镜像为文件，用于上传到 GitHub Releases

set -e

IMAGE_NAME="crpi-rcdhud8zv0a9d7lr.cn-hangzhou.personal.cr.aliyuncs.com/wanyidong/ai-travel-planner:main"
OUTPUT_DIR="docker-images"
VERSION="${1:-latest}"

echo "=== 导出 Docker 镜像 ==="
echo "镜像: $IMAGE_NAME"
echo "版本: $VERSION"
echo ""

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 导出 AMD64 平台镜像
echo "1. 导出 AMD64 镜像..."
docker pull --platform linux/amd64 "$IMAGE_NAME" || echo "AMD64 镜像拉取失败，跳过"
docker save --platform linux/amd64 "$IMAGE_NAME" -o "$OUTPUT_DIR/ai-travel-planner-amd64.tar" 2>/dev/null || {
    echo "直接导出失败，尝试先拉取..."
    docker pull --platform linux/amd64 "$IMAGE_NAME"
    docker save "$IMAGE_NAME" -o "$OUTPUT_DIR/ai-travel-planner-amd64.tar"
}

# 压缩 AMD64 镜像
echo "2. 压缩 AMD64 镜像..."
gzip -f "$OUTPUT_DIR/ai-travel-planner-amd64.tar"
echo "✅ AMD64 镜像已导出: $OUTPUT_DIR/ai-travel-planner-amd64.tar.gz"

# 导出 ARM64 平台镜像
echo "3. 导出 ARM64 镜像..."
docker pull --platform linux/arm64 "$IMAGE_NAME" || echo "ARM64 镜像拉取失败，跳过"
docker save --platform linux/arm64 "$IMAGE_NAME" -o "$OUTPUT_DIR/ai-travel-planner-arm64.tar" 2>/dev/null || {
    echo "直接导出失败，尝试先拉取..."
    docker pull --platform linux/arm64 "$IMAGE_NAME"
    docker save "$IMAGE_NAME" -o "$OUTPUT_DIR/ai-travel-planner-arm64.tar"
}

# 压缩 ARM64 镜像
echo "4. 压缩 ARM64 镜像..."
gzip -f "$OUTPUT_DIR/ai-travel-planner-arm64.tar"
echo "✅ ARM64 镜像已导出: $OUTPUT_DIR/ai-travel-planner-arm64.tar.gz"

echo ""
echo "=== 导出完成 ==="
echo "文件列表:"
ls -lh "$OUTPUT_DIR"/*.tar.gz

echo ""
echo "下一步："
echo "1. 在 GitHub 创建 Release: https://github.com/VansamaYD/AI_Travel_Planner/releases/new"
echo "2. 上传以下文件："
echo "   - $OUTPUT_DIR/ai-travel-planner-amd64.tar.gz"
echo "   - $OUTPUT_DIR/ai-travel-planner-arm64.tar.gz"
echo "3. 添加发布说明，引用 DOCKER_DOWNLOAD.md"

