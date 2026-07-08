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

## Security:

- 不使用 `--force` 强制推送
- 不修改全局 git 配置
- 确保 .gitignore 排除缓存和敏感文件

---

**Skill Version**: 1.0
