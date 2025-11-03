# GitHub Secrets 配置指南

本文档说明如何配置 GitHub Secrets，以便 GitHub Actions 能够自动构建 Docker 镜像并推送到阿里云镜像仓库。

## 配置步骤

### 步骤 1: 进入 GitHub 仓库设置

1. 打开您的 GitHub 仓库
2. 点击仓库顶部的 **Settings**（设置）标签
3. 在左侧菜单中选择 **Secrets and variables** → **Actions**

### 步骤 2: 添加 Secrets

点击右上角的 **New repository secret**（新建仓库密钥）按钮，逐个添加以下 Secrets：

## 必需的 Secrets

### 1. 阿里云镜像仓库凭据

#### `ALIYUN_ACR_USERNAME`
- **说明**：阿里云容器镜像服务（ACR）的用户名
- **获取方式**：
  1. 登录 [阿里云控制台](https://ecs.console.aliyun.com/)
  2. 进入 **容器镜像服务** → **默认实例** → **访问凭证**
  3. 设置或查看固定密码，获取用户名（通常是阿里云账号的用户名）

#### `ALIYUN_ACR_PASSWORD`
- **说明**：阿里云容器镜像服务（ACR）的密码
- **获取方式**：
  1. 在 **容器镜像服务** → **访问凭证** 页面
  2. 设置固定密码（如果还没有）
  3. 复制密码并保存

#### `ALIYUN_ACR_NAMESPACE`
- **说明**：阿里云镜像仓库的命名空间
- **获取方式**：
  1. 登录 [阿里云容器镜像服务控制台](https://cr.console.aliyun.com/)
  2. 进入 **镜像仓库** → **命名空间**
  3. 创建命名空间（如果还没有），例如：`ai-travel-planner`
  4. 复制命名空间名称

**示例值**：`your-namespace`

### 2. Supabase 配置（用于构建时）

#### `NEXT_PUBLIC_SUPABASE_URL`
- **说明**：Supabase 项目 URL，用于构建 Next.js 客户端代码
- **获取方式**：
  1. 登录 [Supabase](https://app.supabase.com/)
  2. 选择您的项目
  3. 进入 **Settings** → **API**
  4. 复制 **Project URL**

**示例值**：`https://xxxxx.supabase.co`

#### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **说明**：Supabase 匿名密钥，用于构建 Next.js 客户端代码
- **获取方式**：
  1. 在 Supabase 项目的 **Settings** → **API** 页面
  2. 复制 **anon** `public` 密钥

**示例值**：`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 3. 高德地图 API Key（可选）

#### `NEXT_PUBLIC_AMAP_KEY`
- **说明**：高德地图 API Key，用于地图功能
- **获取方式**：
  1. 登录 [高德开放平台](https://console.amap.com/)
  2. 进入 **应用管理** → **我的应用**
  3. 创建应用并获取 Web 端（JS API）Key
  4. 复制 Key

**示例值**：`xxxxxxxxxxxxxxxxxxxxx`

### 4. 应用配置（可选）

#### `NEXT_PUBLIC_BASE_URL`
- **说明**：应用的基础 URL（默认：`http://localhost:3000`）
- **可选**：如果不设置，将使用默认值
- **示例值**：`https://your-domain.com`

## 完整的 Secrets 列表

| Secret 名称 | 是否必需 | 说明 |
|------------|---------|------|
| `ALIYUN_ACR_USERNAME` | ✅ | 阿里云镜像仓库用户名 |
| `ALIYUN_ACR_PASSWORD` | ✅ | 阿里云镜像仓库密码 |
| `ALIYUN_ACR_NAMESPACE` | ✅ | 阿里云镜像仓库命名空间 |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase 匿名密钥 |
| `NEXT_PUBLIC_AMAP_KEY` | ⚠️ | 高德地图 API Key（推荐配置） |
| `NEXT_PUBLIC_BASE_URL` | ❌ | 应用基础 URL（可选） |

## 配置示例

### 添加 Secret 的步骤（详细）

1. **点击 "New repository secret"**
2. **填写表单**：
   - **Name**（名称）：输入 Secret 的名称，例如 `ALIYUN_ACR_USERNAME`
   - **Secret**（密钥）：输入对应的值，例如您的阿里云用户名
3. **点击 "Add secret"**
4. **重复以上步骤**，添加所有必需的 Secrets

### 配置完成后的检查

1. 在 **Secrets and variables** → **Actions** 页面，您应该看到所有已添加的 Secrets
2. Secrets 名称旁会显示 `••••••••`（隐藏的值）
3. 可以点击 Secret 名称查看或更新值

## 测试配置

### 方式一：手动触发工作流

1. 进入 GitHub 仓库的 **Actions** 标签
2. 选择 **Build and Push Docker Image** 工作流
3. 点击 **Run workflow**
4. 选择分支（通常是 `main`）
5. 点击 **Run workflow** 按钮

### 方式二：推送代码触发

```bash
# 推送到 main 分支会自动触发构建
git push origin main

# 或创建标签触发构建
git tag v1.0.0
git push origin v1.0.0
```

### 验证构建结果

1. 在 **Actions** 标签查看工作流运行状态
2. 构建成功后，登录阿里云镜像仓库查看镜像
3. 镜像地址格式：`registry.cn-hangzhou.aliyuncs.com/YOUR_NAMESPACE/ai-travel-planner:latest`

## 常见问题

### 1. 构建失败：认证失败

**原因**：阿里云镜像仓库凭据不正确

**解决**：
- 检查 `ALIYUN_ACR_USERNAME` 和 `ALIYUN_ACR_PASSWORD` 是否正确
- 确认密码是否使用固定密码（不是临时密码）
- 检查命名空间是否正确

### 2. 构建失败：环境变量未定义

**原因**：必需的 Secrets 未配置

**解决**：
- 检查是否配置了所有必需的 Secrets
- 查看工作流日志中的错误信息，确认缺失的 Secret

### 3. 镜像推送失败：命名空间不存在

**原因**：`ALIYUN_ACR_NAMESPACE` 配置错误或命名空间不存在

**解决**：
- 在阿里云容器镜像服务控制台创建命名空间
- 确保命名空间名称与 Secret 中的值一致

### 4. 如何更新 Secret

1. 进入 **Settings** → **Secrets and variables** → **Actions**
2. 找到要更新的 Secret
3. 点击 Secret 名称右侧的 **Update**（更新）按钮
4. 修改值并保存

### 5. 如何删除 Secret

1. 进入 **Settings** → **Secrets and variables** → **Actions**
2. 找到要删除的 Secret
3. 点击 Secret 名称右侧的 **Delete**（删除）按钮
4. 确认删除

## 安全建议

1. **不要将 Secrets 值提交到代码仓库**
   - 使用 `.gitignore` 确保不提交 `.env` 文件
   - 所有敏感信息都应通过 GitHub Secrets 配置

2. **定期更新密码**
   - 建议定期更换阿里云镜像仓库密码
   - 更新后同步更新 GitHub Secrets

3. **最小权限原则**
   - 仅配置工作流必需的 Secrets
   - 不要配置不必要的 Secrets

4. **审计 Secrets 使用**
   - 定期检查工作流日志，确认 Secrets 使用正常
   - 如有异常，及时更新或删除 Secrets

## 相关文档

- [GitHub Actions Secrets 官方文档](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [阿里云容器镜像服务文档](https://help.aliyun.com/product/60716.html)
- [Supabase API 密钥文档](https://supabase.com/docs/guides/api)

## 下一步

配置完成后：

1. **触发构建**：推送代码到 main 分支或手动触发工作流
2. **查看镜像**：在阿里云镜像仓库查看构建的镜像
3. **拉取镜像**：使用 `docker pull` 命令拉取镜像
4. **部署应用**：参考 [DEPLOY.md](../DEPLOY.md) 进行部署

---

**提示**：首次配置完成后，建议先手动触发一次工作流，验证所有 Secrets 配置是否正确。

