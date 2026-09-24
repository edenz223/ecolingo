# 开发与验证

命令以 `package.json` 为准。构建目标为 Node 20；仓库同时保留 npm 和 Yarn 锁文件，沿用当前任务所用包管理器，避免无关锁文件变更。

- `npm run dev`：启动 Electron 开发模式。
- `npm run build`：构建 Electron 应用。
- 没有独立 typecheck 脚本。

## 按改动选择检查

| 改动                         | 检查                                        |
| ---------------------------- | ------------------------------------------- |
| 代码                         | `npm run lint`                              |
| 构建、主进程、preload 或依赖 | 另加 `npm run build`                        |
| VAD 核心逻辑                 | `node --test tests/voice-activity.test.cjs` |
| 偏好设置逻辑                 | `node --test tests/settings.test.cjs`       |
| 录音存储逻辑                 | `npm run test:recordings`                   |
| 其他已有测试覆盖的核心逻辑   | 运行对应测试文件                            |
| 纯文档或样式                 | 不运行无关测试                              |

`npm test` 只是占位脚本，不能作为测试通过的依据。修复易复发 bug 时优先添加回归测试。

## 交付

检查失败时先判断是否本次改动导致。交付说明改动、已运行的检查及待人工验收项；不得将自动测试描述为真实桌面交互已验证。

## 格式化

仅格式化改动文件：`npx prettier --write <文件路径...>`。不要使用会处理整个仓库的 `npm run format`；避免整文件无关格式化。
