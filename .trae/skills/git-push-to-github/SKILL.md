---
name: "git-push-to-github"
description: "Commits and pushes local code changes to GitHub remote repository. 当用户要求提交代码、推送更新到GitHub远程仓库时调用。"
---

# Git Push to GitHub

## Use this skill when:

- 用户要求将本地代码推送到 GitHub
- 用户要求提交（commit）并推送（push）代码变更
- 用户要求上传更新到远程仓库

## Do NOT use this skill when:

- 用户仅查询 git 状态或历史
- 用户要求回滚、撤销或解决分支冲突
- 用户要求修改 .gitignore 配置

## Input:

- repo_path: string # 仓库路径，默认当前目录
- remote_url: string # GitHub URL（可选）
- branch: string # 目标分支，默认 main
- commit_message: string # 提交说明，默认自动生成

## Output:

- success: boolean
- commit_hash: string
- commit_message: string
- push_result: string
- error_message: string

## Steps:

1. 检查 git 仓库状态和远程配置
2. 暂存所有变更：`git add .`
3. 生成中文提交说明：优先使用用户传入中文message；无输入则根据文件改动自动生成简短中文变更描述
4. 执行提交：`git commit -m "<中文简易变更说明>"`
5. 推送代码：`git push origin <branch>`
6. 验证推送成功，输出提交信息

## On Failure:

- **非 git 仓库**: 提示用户初始化仓库
- **远程未配置**: 使用 remote_url 添加或询问用户
- **身份缺失**: 在当前仓库级别设置 user.name/email
- **网络失败**: 检查代理配置，重置 remote URL 为官方地址
- **权限不足**: 提示检查 GitHub 凭据
- **分支冲突**: 提示先拉取远程代码解决冲突

## Troubleshooting Guide（按优先级顺序）:

### 1. HTTP2 Framing 错误 / 443 连接超时

**现象**: `Error in the HTTP2 framing layer` 或 `Couldn't connect to server port 443`
**解决方案**: 在仓库级别降级 HTTP 版本到 HTTP/1.1

```bash
git config http.version HTTP/1.1
```

### 2. HTTPS SSL 证书验证失败

**现象**: `SSL: no alternative certificate subject name matches target ipv4 address`
**原因**: 配置了 `url.<IP>.insteadOf` 使用 IP 访问导致证书不匹配
**解决方案**: 移除错误的 URL 替换配置

```bash
git config --global --unset url."https://<IP>/".insteadOf
```

### 3. /etc/hosts 拦截 GitHub 域名

**现象**: ping github.com 返回 127.0.0.1，curl 无法连接
**原因**: Steam++ 等工具将 github.com 映射到本地
**解决方案**:

- 有 sudo 权限: `sudo sed -i.bak '/github/d' /etc/hosts`
- 无 sudo 权限: 改用 SSH over HTTPS 端口 443（见下方）

### 4. SSH 连接失败（权限拒绝）

**现象**: `git@github.com: Permission denied (publickey)`
**解决方案**:

1. 检查 SSH config 是否配置正确（~/.ssh/config）:

```ssh-config
Host github.com
    HostName ssh.github.com
    Port 443
    User git
    IdentityFile ~/.ssh/id_ed25519_mindbridge
    IdentitiesOnly yes
```

2. 确认公钥已添加到 GitHub 账户
3. 测试连接: `ssh -T git@github.com`

### 5. SSH 端口受限（22端口被封）

**现象**: SSH 连接超时或拒绝
**解决方案**: 将 SSH 连接改走 443 端口

```bash
git remote set-url origin git@github.com:zhengwenze/mindbridge.git
```

配合 SSH config 中设置 `HostName ssh.github.com` 和 `Port 443`

### 6. macOS Keychain 凭据

**现象**: HTTPS 推送时提示认证失败但未弹出密码输入
**解决方案**: 检查钥匙串中是否有 GitHub PAT token

```bash
git credential-osxkeychain get
```

确保 token 有 repo 权限且未过期

### 7. 提交后推送失败（本地已 ahead）

**现象**: push 失败但本地 commit 已存在
**解决方案**: 先确认本地状态，再聚焦网络/协议层修复

```bash
git log --oneline -5
git status
```

### 8. 配置修改注意事项

- **不要**把配置修改和推送串在同一条命令中
- **优先使用仓库级配置**（不加 --global），减少对全局环境的副作用
- **避免**使用 `git config --global http.postBuffer` 等临时配置

## 推送失败处理流程:

```
推送失败
    ↓
检查错误类型
    ↓
┌─────────────────────────────────────────────┐
│ 1. HTTP2/443超时 → 降级HTTP/1.1             │
├─────────────────────────────────────────────┤
│ 2. SSL证书错误 → 移除IP替换配置              │
├─────────────────────────────────────────────┤
│ 3. 连接拒绝 → 检查hosts文件                  │
├─────────────────────────────────────────────┤
│ 4. 权限拒绝(HTTPS) → 检查Keychain凭据        │
├─────────────────────────────────────────────┤
│ 5. 权限拒绝(SSH) → 配置SSH密钥和端口         │
└─────────────────────────────────────────────┘
    ↓
重新推送
```

## Security:

- 不使用 `--force` 强制推送
- 不修改全局 git 配置
- 确保 .gitignore 排除缓存和敏感文件

---

**Skill Version**: 1.0
