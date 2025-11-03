# 从 Git 历史记录中彻底删除敏感文件

如果 `.env` 或其他包含敏感信息的文件被意外提交到 Git 历史记录中，需要从所有提交历史中彻底删除。

## ⚠️ 重要警告

**执行以下操作会重写 Git 历史记录**，这意味着：
- 所有提交的 SHA 都会改变
- 如果已经推送到远程仓库，需要使用 `git push --force`
- **所有协作者都需要重新克隆仓库**或更新本地仓库

**在执行前，请确保**：
1. 备份仓库
2. 通知所有协作者
3. 确认没有其他人基于旧历史进行开发

## 方法一：使用 git filter-repo（推荐）

### 安装 git-filter-repo

```bash
# macOS
brew install git-filter-repo

# 或使用 pip
pip install git-filter-repo
```

### 删除 .env 文件

```bash
# 进入项目目录
cd /path/to/AI_Travel_Planner

# 从整个 Git 历史中删除 .env 文件
git filter-repo --path .env --invert-paths

# 如果还有其他敏感文件，可以一起删除
git filter-repo --path .env --path apps/web/.env.local --invert-paths
```

### 强制推送到远程仓库

```bash
# ⚠️ 危险操作：会覆盖远程历史
git push origin --force --all
git push origin --force --tags
```

## 方法二：使用 git filter-branch（备选）

如果无法安装 `git-filter-repo`，可以使用 `git filter-branch`：

```bash
# 删除 .env 文件
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# 删除 apps/web/.env.local（如果存在）
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch apps/web/.env.local" \
  --prune-empty --tag-name-filter cat -- --all

# 清理引用
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

## 方法三：使用 BFG Repo-Cleaner（简单快速）

BFG 是一个更简单快速的工具：

### 安装 BFG

```bash
# macOS
brew install bfg

# 或下载 JAR 文件
# https://rtyley.github.io/bfg-repo-cleaner/
```

### 删除文件

```bash
# 删除 .env 文件
bfg --delete-files .env

# 清理引用
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

## 验证删除结果

删除后，验证文件是否已从历史中移除：

```bash
# 检查文件是否还在历史中
git log --all --full-history -- .env

# 如果没有任何输出，说明已成功删除

# 检查所有引用中是否还有该文件
git rev-list --objects --all | grep "\.env"
```

## 更新远程仓库

**重要**：删除本地历史后，需要强制推送到远程：

```bash
# 备份远程分支（可选但推荐）
git push origin --all --prune
git push origin --tags --prune

# 强制推送（覆盖远程历史）
git push origin --force --all
git push origin --force --tags
```

## 通知协作者

所有协作者需要：

1. **删除本地仓库并重新克隆**（最简单）：
   ```bash
   cd ..
   rm -rf AI_Travel_Planner
   git clone <repository-url>
   ```

2. **或更新现有仓库**：
   ```bash
   cd AI_Travel_Planner
   git fetch origin
   git reset --hard origin/main
   ```

## 防止未来再次提交

确保 `.gitignore` 正确配置：

```gitignore
# 环境变量文件
.env
.env.local
.env*.local
apps/web/.env.local
```

添加后，验证：

```bash
# 检查 .env 是否被忽略
git check-ignore -v .env

# 应该输出类似：
# .gitignore:7:.env	.env
```

## 检查命令（执行前使用）

在执行删除操作前，先检查：

```bash
# 1. 检查 .env 是否在历史中
git log --all --full-history -- .env

# 2. 检查当前是否被追踪
git ls-files | grep "\.env"

# 3. 检查 .gitignore 是否正确
cat .gitignore | grep "\.env"

# 4. 查看所有包含敏感信息的提交
git log --all --grep="API.*key\|password\|secret" -i
```

## 推荐的完整流程

```bash
# 1. 备份仓库
cp -r . ../AI_Travel_Planner_backup

# 2. 确保 .gitignore 正确配置
cat .gitignore | grep "\.env"

# 3. 从历史中删除敏感文件
git filter-repo --path .env --invert-paths

# 4. 验证删除
git log --all --full-history -- .env

# 5. 强制推送（⚠️ 危险操作）
git push origin --force --all
git push origin --force --tags

# 6. 通知协作者更新仓库
```

## 如果已经推送了敏感信息

如果敏感文件已经推送到公开的 GitHub 仓库：

1. **立即删除**：使用上述方法从历史中删除
2. **轮换密钥**：即使删除了文件，也应更换所有暴露的 API Key
3. **检查访问日志**：查看 GitHub 仓库的访问日志，确认是否有人访问

## 参考资料

- [GitHub: Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [git-filter-repo 文档](https://github.com/newren/git-filter-repo)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)

---

**再次提醒**：删除 Git 历史记录是一个不可逆的操作，请务必在执行前备份仓库并通知所有协作者！

