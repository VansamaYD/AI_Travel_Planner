# 快速修复：从 Git 历史中删除 .env 文件

## ⚠️ 警告
此操作会重写 Git 历史，请确保：
1. 已备份仓库
2. 已通知协作者（如果有）
3. 准备更换所有暴露的 API Key

## 快速执行步骤

### 1. 备份仓库
```bash
cd ..
cp -r AI_Travel_Planner AI_Travel_Planner_backup
cd AI_Travel_Planner
```

### 2. 从历史中删除 .env
```bash
git filter-repo --path .env --invert-paths --force
```

### 3. 验证删除
```bash
git log --all --full-history -- .env
# 应该没有任何输出
```

### 4. 如果已推送到远程，强制推送
```bash
git push origin --force --all
git push origin --force --tags
```

### 5. ⚠️ 立即更换暴露的 API Key
- Supabase Anon Key
- 高德地图 API Key

详细说明见 SECURITY_ALERT.md
