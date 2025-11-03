# ⚠️ 安全警报：API Key 泄露

## 问题描述

在提交 `fea7892` 中，`.env` 文件被意外提交到 Git 仓库，包含以下敏感信息：

1. **Supabase URL**: `https://rqrgizuyrttpfpdgiqar.supabase.co`
2. **Supabase Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (已暴露)
3. **高德地图 API Key**: `5c88e2820fc0165d93feaea6dca73d75` (已暴露)

## 立即行动

### 1. 从 Git 历史中删除敏感文件

```bash
# 使用 git-filter-repo（推荐）
git filter-repo --path .env --invert-paths --force

# 或使用脚本
./scripts/remove-env-from-history.sh
```

### 2. 强制推送到远程仓库

```bash
# ⚠️ 警告：会覆盖远程历史
git push origin --force --all
git push origin --force --tags
```

### 3. 更换所有暴露的 API Key ⚠️ 重要！

#### Supabase

1. 登录 [Supabase 控制台](https://app.supabase.com/)
2. 进入项目设置 → API
3. 重新生成 **anon** `public` 密钥
4. 更新所有环境变量配置

#### 高德地图

1. 登录 [高德开放平台](https://console.amap.com/)
2. 进入应用管理 → 我的应用
3. **删除或禁用**暴露的 API Key
4. 创建新的 API Key
5. 更新所有环境变量配置

#### 阿里云 DashScope（如果也暴露了）

1. 登录 [阿里云 DashScope 控制台](https://dashscope.console.aliyun.com/)
2. 删除或重新生成 API Key
3. 更新所有环境变量配置

### 4. 检查访问日志

- **Supabase**: 检查项目访问日志，确认是否有未授权的访问
- **高德地图**: 检查 API 调用日志，确认是否有异常调用
- **GitHub**: 如果仓库是公开的，检查访问统计

### 5. 通知协作者

如果仓库已推送到远程，通知所有协作者：

1. 删除本地仓库并重新克隆（推荐）
2. 或更新现有仓库：
   ```bash
   git fetch origin
   git reset --hard origin/main
   ```

## 预防措施

### 已实施的措施

1. ✅ `.gitignore` 已正确配置 `.env` 文件
2. ✅ 创建了 `.env.example` 模板文件（不包含真实密钥）
3. ✅ 添加了安全文档

### 未来注意事项

1. **提交前检查**：
   ```bash
   git status
   # 确认没有 .env 文件显示
   ```

2. **使用预提交钩子**（可选）：
   ```bash
   # 创建 .git/hooks/pre-commit
   # 检查是否意外添加了敏感文件
   ```

3. **使用 Git 安全扫描工具**：
   - GitHub 的 secret scanning
   - GitGuardian
   - TruffleHog

## 已创建的清理工具

- `scripts/remove-env-from-history.sh` - 自动化清理脚本
- `docs/REMOVE_SENSITIVE_FILES.md` - 详细清除指南

## 时间线

- **发现时间**: 2025-11-04
- **泄露提交**: `fea7892` (fix: 修复 Docker 构建时 NEXT_PUBLIC_* 环境变量传递问题)
- **状态**: 需要立即清除

---

**请立即执行上述步骤，特别是更换所有暴露的 API Key！**

