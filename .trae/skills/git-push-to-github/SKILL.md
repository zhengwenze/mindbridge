---
name: "git-push-to-github"
description: "Safely commits intended local changes and pushes them to a GitHub branch. 当用户明确要求提交并推送代码到 GitHub 时调用。"
---

# Git Push to GitHub

## Use this skill when

- 用户明确要求提交并推送本地代码到 GitHub。
- 用户明确指定要更新的远程分支。
- 用户要求把已经完成的提交同步到 GitHub。

不要用于只读状态查询、回滚、强制推送或未经授权的分支合并。

## Inputs

- `repo_path`: 仓库路径，默认当前目录。
- `remote`: 远程名称，默认 `origin`。
- `branch`: 目标分支，默认当前分支；不要擅自假定为 `main`。
- `commit_message`: 可选提交说明；未提供时根据本次明确范围内的变更生成简短中文说明。
- `paths`: 本次允许暂存的文件路径；应从任务范围和 `git status` 中明确得出。

## Outputs

- `success`: 是否完成。
- `branch`: 实际推送的目标分支。
- `commit_hash`: 推送后的提交哈希。
- `commit_message`: 提交说明。
- `push_result`: 推送与远程校验结果。
- `error_message`: 失败原因及安全的下一步建议。

## Safe workflow

1. 确认仓库与范围：
   - 运行 `git status --short --branch`、`git remote -v`、`git branch -vv`。
   - 确认目标远程和目标分支与用户要求一致。
   - 工作区包含无关或来源不明的改动时，保留它们且不要暂存；无法隔离时停止并说明。
2. 获取远程状态：
   - 运行 `git fetch <remote> --prune`。
   - 比较本地目标分支与 `<remote>/<branch>`，禁止在不了解远程新提交时直接推送。
3. 暂存与审查：
   - 只运行 `git add -- <明确文件路径...>`，禁止无条件使用 `git add .`、`git add -A`。
   - 用 `git diff --cached --check` 和 `git diff --cached --stat` 检查暂存内容。
   - 检查敏感文件、构建缓存和临时文件是否被意外纳入。
4. 验证：
   - 运行与改动风险相匹配的测试、类型检查、Lint 或构建。
   - 验证失败时不要提交或推送；报告失败并保留现场。
5. 提交：
   - 仅在存在已暂存变更时执行 `git commit -m "<说明>"`。
   - 若改动已经提交，复用现有提交，不创建空提交。
6. 同步目标分支：
   - 当前分支就是目标分支时，先以 `git pull --ff-only <remote> <branch>` 更新。
   - 当前分支不是目标分支且用户明确要求直接更新目标分支时，切换到目标分支，以 `--ff-only` 同步远程，再 `cherry-pick` 本次明确提交。
   - 出现冲突时停止，不自动丢弃、覆盖或重写任何一方的改动。
7. 推送：
   - 使用 `git push <remote> HEAD:<branch>`。
   - 禁止 `--force`、`--force-with-lease`，除非用户在了解风险后单独明确授权。
8. 远程校验：
   - 再次 `git fetch <remote>`。
   - 确认 `git rev-parse HEAD` 与 `git rev-parse <remote>/<branch>` 一致。
   - 输出分支、提交哈希、提交说明和验证结果。

## Failure handling

- **非 Git 仓库或远程缺失**：停止并报告；未经确认不要初始化仓库或新增远程。
- **身份缺失**：报告缺失项；不要自行设置 `user.name` 或 `user.email`。
- **远程领先或非快进**：先 fetch 并展示分叉；只使用 fast-forward、rebase 或明确的 cherry-pick 方案，冲突时停止。
- **认证或权限失败**：报告 GitHub 返回的原始错误，建议用户检查凭据和仓库权限。
- **网络、HTTP/2、SSL、SSH 失败**：先执行只读诊断；不要自动修改远程 URL、`/etc/hosts`、SSH 配置或全局 Git 配置。
- **推送后连接中断**：先 fetch 并比较远程提交，确认是否其实已经成功，避免重复操作。

## Security and repository hygiene

- 不读取或输出令牌、私钥、密码和凭据内容。
- 不关闭 SSL 校验，不修改全局 Git 配置。
- 不使用破坏性命令，例如 `git reset --hard`、`git clean -fd` 或强制推送。
- 不覆盖用户已有改动；所有暂存文件都必须属于当前任务范围。
- 修改远程地址、本地身份、代理、SSH 或系统网络配置前必须取得用户确认。

---

**Skill Version**: 1.1
