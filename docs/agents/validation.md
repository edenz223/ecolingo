# 开发与验证

命令以 `package.json` 为准。开发与 CI 使用 Node 22（`.nvmrc`）；Electron 29 内置 Node 20，主进程构建目标仍为 `node20`。包管理器为 Yarn 1，只维护 `yarn.lock`。

- `yarn dev`：启动 Electron 开发模式。
- `yarn build`：构建并用 electron-builder 打包当前平台（Windows 便携版 exe、macOS dmg、Linux AppImage），输出到 `dist/electron/Packaged/`。
- `yarn typecheck`：`vue-tsc --noEmit` 类型检查（含 `.vue`）。
- `yarn test`：运行 `tests/*.test.cjs` 全部单元测试。
- `yarn test:smoke`：Electron 冒烟测试（需图形环境；UI 冒烟测试读取 `yarn build` 产物）。

## 按改动选择检查

| 改动                         | 检查                                       |
| ---------------------------- | ------------------------------------------ |
| 代码                         | `yarn lint`、`yarn typecheck`、`yarn test` |
| 构建、主进程、preload 或依赖 | 另加 `yarn build`                          |
| 界面布局或交互               | 有图形环境时另加 `yarn test:smoke`         |
| 只需单个领域                 | `node --test tests/<对应文件>.test.cjs`    |
| 纯文档或样式                 | 不运行无关测试                             |

测试通过 `tests/helpers/` 用 esbuild 转译 TS 源码，在 `vm` 中运行，不依赖 DOM。修复易复发 bug 时优先添加回归测试。

## CI 与发布

- `.github/workflows/ci.yml`：push 到 master 和每个 PR 运行 lint、typecheck、单元测试、构建，并在 xvfb 下跑冒烟测试。
- `.github/workflows/release.yml`：推送 `v*` tag 时在三个平台打包并创建 GitHub Release；tag 须与 `package.json` 的 `version` 一致。改动打包相关文件的 PR 和手动运行只上传构建产物，不发布。
- 应用未代码签名；macOS 用 ad-hoc 签名（`identity: '-'`），录音权限说明在 `quasar.config.js` 的 `NSMicrophoneUsageDescription`。

## 交付

检查失败时先判断是否本次改动导致。交付说明改动、已运行的检查及待人工验收项；不得将自动测试描述为真实桌面交互已验证。

## 格式化

仅格式化改动文件：`npx prettier --write <文件路径...>`；避免整文件无关格式化。
