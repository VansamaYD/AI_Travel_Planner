#!/bin/bash
# 从 Git 历史记录中删除 .env 文件
# 警告：这会重写 Git 历史，请确保已备份仓库

set -e

echo "⚠️  警告：此操作将重写 Git 历史记录！"
echo "请确保："
echo "1. 已备份仓库"
echo "2. 已通知所有协作者"
echo "3. 确认没有其他人基于旧历史进行开发"
echo ""
read -p "是否继续？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "操作已取消"
    exit 0
fi

# 检查 git-filter-repo 是否安装
if ! command -v git-filter-repo &> /dev/null; then
    echo "错误：git-filter-repo 未安装"
    echo "请安装：brew install git-filter-repo"
    exit 1
fi

# 备份当前状态
echo "正在创建备份..."
BACKUP_DIR="../AI_Travel_Planner_backup_$(date +%Y%m%d_%H%M%S)"
cp -r . "$BACKUP_DIR"
echo "✅ 备份已创建：$BACKUP_DIR"

# 从历史中删除 .env 文件
echo "正在从 Git 历史中删除 .env 文件..."
git filter-repo --path .env --invert-paths --force

# 同时删除可能的其他敏感文件
echo "正在检查并删除其他可能的敏感文件..."
if git log --all --full-history --name-only -- apps/web/.env.local | grep -q "\.env\.local"; then
    echo "发现 apps/web/.env.local，正在删除..."
    git filter-repo --path apps/web/.env.local --invert-paths --force
fi

echo ""
echo "✅ .env 文件已从历史记录中删除"
echo ""
echo "下一步操作："
echo "1. 验证删除结果："
echo "   git log --all --full-history -- .env"
echo ""
echo "2. 如果已推送到远程仓库，需要强制推送："
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
echo ""
echo "3. ⚠️  重要：更换所有暴露的 API Key！"
echo "   - Supabase 匿名密钥"
echo "   - 高德地图 API Key"
echo "   - 如果 DASHSCOPE_API_KEY 也暴露了，也需要更换"
echo ""
echo "4. 通知所有协作者重新克隆仓库"

