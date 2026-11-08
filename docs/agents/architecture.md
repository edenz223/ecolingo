# 架构与实现

- **前端**：Vue 3 + Composition API（`<script setup>`）、TypeScript、Quasar 2、Vite。
- **桌面**：Electron（原生标题栏、系统菜单、`contextIsolation` + 沙箱）。
- **音频**：Howler 播放课程音频；`MediaRecorder` + `getUserMedia` 录音。

| 模块                               | 职责                                                     |
| ---------------------------------- | -------------------------------------------------------- |
| `src/layouts/MainLayout.vue`       | 组装学习界面组件，绑定全局键盘与指针事件                 |
| `src/components/`                  | 标题栏、课程标题、抽屉、字幕列表、专注舞台、底栏、对话框 |
| `src/modules/learning-session.ts`  | Player / Recorder / Zen 协调、课程状态与偏好持久化       |
| `src/modules/player.ts`            | 音频播放、20 ms 轮询时钟与句子同步                       |
| `src/modules/recorder.ts`          | 麦克风录音、VAD 监控、自动停止与本地保存                 |
| `src/modules/zen.ts`               | Zen 练习状态机（三种练习方式）                           |
| `src/modules/compare.ts`           | 原声 / 录音 A/B 对比流程                                 |
| `src/utils/lyrics-util.ts`         | LRC / SRT 字幕解析                                       |
| `src/utils/settings.ts`            | 偏好设置加载与持久化（`localStorage`）                   |
| `src/utils/keyboard-shortcuts.ts`  | 单键快捷键分发（空格与 R 另有专用模块）                  |
| `src/utils/playback-options.ts`    | 循环模式、倍速预设与倍速取整                             |
| `src/utils/lesson-library.ts`      | 课程键、文件夹名、筛选与继续上次的定位                   |
| `src/utils/practice-status.ts`     | 由练习方式、Zen 阶段与录音状态推导步骤和说明文字         |
| `src/utils/voice-activity.ts`      | Web Audio RMS 语音检测与自适应阈值                       |
| `src/utils/zen-flow.ts`            | Zen 练习流程调度                                         |
| `src/types/`                       | TypeScript 类型定义                                      |
| `src-electron/electron-main.ts`    | 窗口、菜单、IPC                                          |
| `src-electron/electron-preload.ts` | 强类型 `window.fileAPI` 桥接                             |
| `src-electron/fileSystem.ts`       | 音频/字幕配对与编码检测                                  |
| `src-electron/recording-store.ts`  | SQLite 录音存储与原子写入                                |
| `quasar.config.js`                 | 构建和 Electron 打包配置                                 |

## 实现边界

- 学习逻辑放在 `learning-session.ts`，不依赖组件与 DOM（滚动等通过选项注入），以便在 node 测试中运行；组件只接收 props、发出事件。
- 组件 `<style>` 沿用全局（非 scoped）写法，与原 `MainLayout` 一致：Quasar 会把菜单与对话框传送到布局之外；跨组件复用的类（如 `.small-tooltip`）放在 `app.scss`。
- Howler 的 `playing()` 不是响应式；需要随播放状态刷新的视图读取 `player.playbackRevision`（`learning-session.isPlaybackActive()` 已处理）。

- 文件系统操作在 Electron 主进程，通过 preload 暴露窄范围方法；不暴露原始 IPC 或 Node API。
- 窗口使用原生标题栏与系统菜单，保持可调整大小和最大化。
- 格式遵循仓库的 `.editorconfig`、`.prettierrc`、`.eslintrc.cjs`。
