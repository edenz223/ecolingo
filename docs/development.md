# 开发指南

本文面向需要从源码运行或修改「一句一句 · Yiju Yiju」的开发者。用户使用说明见 [README](../README.md)。

## 项目与环境

项目使用 Vue 3、TypeScript、Quasar 和 Electron。核心练习功能须离线可用，无需账号。

需要 **Node 22.22+**（开发与 CI 使用 `.nvmrc` 中的 Node 22）和 **Yarn 1**。建议在需要运行应用的目标系统上开发和打包；启动 Electron 需要桌面图形环境。

根目录管理渲染进程和工具链依赖，`src-electron/` 管理主进程依赖、Electron 和打包工具，两处分别维护 `yarn.lock`。根目录安装依赖时会自动安装主进程依赖，并生成 Quasar 的 TypeScript 配置。

文档使用新名称「一句一句」；当前源码中的包名、窗口标题与部分存储标识仍使用 EcoLingo。修改应用标识时需要考虑已有用户的设置和录音数据位置。

## 安装与启动

在项目根目录执行：

```sh
yarn install --frozen-lockfile
yarn dev
```

`yarn dev` 启动 Electron 开发模式。通过应用中的「打开课程文件夹」导入 `examples/english-shadowing/`，即可使用三组英语示例；也可以准备自己的同名音频和 LRC / SRT 字幕。

## 构建

```sh
yarn build
```

该命令构建 Electron 应用，并使用 electron-builder 打包当前平台，产物位于 `dist/electron/Packaged/`。Windows 为便携版 `.exe`，macOS 为 `.dmg`，Linux 为 `.AppImage`；具体目标见 `quasar.config.js`。

不要手动修改 `.quasar/`、`dist/` 或 `node_modules/` 中的生成文件。

## 检查改动

按改动范围选择检查：

| 改动范围                         | 检查命令                                   |
| -------------------------------- | ------------------------------------------ |
| 格式                             | `yarn format:check`                        |
| 代码                             | `yarn lint`、`yarn typecheck`、`yarn test` |
| 构建配置、主进程、preload 或依赖 | 另运行 `yarn build`                        |
| 界面布局或交互                   | 构建后在图形环境运行 `yarn test:smoke`     |
| 单个领域                         | `node --test tests/<对应文件>.test.cjs`    |

纯文档改动不需要运行无关测试。`tests/fixtures/` 中的课程供冒烟测试使用；不要修改 `.quasar/` 等生成文件来修复检查问题。

`yarn test:smoke` 依次运行四个 Electron 冒烟测试，读取 `yarn build` 产物。内存有限的机器应逐个运行浏览器或 Electron 测试，避免与构建并行。

仅格式化本次修改的文件，例如：

```sh
yarn prettier --write README.md docs/development.md
```

项目使用 Prettier 3，CI 会检查格式。自动检查不能替代真实桌面上的音频播放、麦克风权限与录音回听验收。

## CI 与发布

每个 PR 和 master 上的推送会运行格式检查、lint、类型检查、单元测试、构建及四个 Electron 冒烟测试。打包相关改动的 PR 还会构建 Windows、macOS 和 Linux 产物，供下载测试，不会发布正式版本。

发布时，先修改根目录 `package.json` 的 `version` 并合入 master，再由维护者推送对应的 `v*` tag。例如版本为 `0.1.0` 时：

```sh
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions 会为三个平台打包并创建附带安装文件的 GitHub Release。tag 必须与 `package.json` 中的版本一致；带 `-` 的 tag（如 `v0.2.0-beta.1`）发布为预发布版本。应用尚无发行者代码签名，macOS 构建使用 ad-hoc 签名。

## 实现说明

- [架构与 Electron 边界](agents/architecture.md)
- [课程导入与字幕计时](agents/lessons.md)
- [播放、跟读与会话清理](agents/practice.md)
- [录音存储](agents/recordings.md)
- [界面与交互](agents/ui.md)
- [开发与验证规范](agents/validation.md)
