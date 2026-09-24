# 架构与实现

- **前端**：Vue 3 + Composition API（`<script setup>`）、TypeScript、Quasar 2、Vite。
- **桌面**：Electron（原生标题栏、系统菜单、`contextIsolation` + 沙箱）。
- **音频**：Howler 播放课程音频；`MediaRecorder` + `getUserMedia` 录音。

| 模块                               | 职责                                     |
| ---------------------------------- | ---------------------------------------- |
| `src/layouts/MainLayout.vue`       | 学习界面、键盘快捷键与事件协调           |
| `src/modules/player.ts`            | 音频播放、20 ms 轮询时钟与句子同步       |
| `src/modules/recorder.ts`          | 麦克风录音、VAD 监控、自动停止与本地保存 |
| `src/modules/zen.ts`               | Zen 练习状态机（三种练习方式）           |
| `src/utils/lyrics-util.ts`         | LRC / SRT 字幕解析                       |
| `src/utils/settings.ts`            | 偏好设置加载与持久化（`localStorage`）   |
| `src/utils/voice-activity.ts`      | Web Audio RMS 语音检测与自适应阈值       |
| `src/utils/zen-flow.ts`            | Zen 练习流程调度                         |
| `src/types/`                       | TypeScript 类型定义                      |
| `src-electron/electron-main.ts`    | 窗口、菜单、IPC                          |
| `src-electron/electron-preload.ts` | 强类型 `window.fileAPI` 桥接             |
| `src-electron/fileSystem.ts`       | 音频/字幕配对与编码检测                  |
| `src-electron/recording-store.ts`  | SQLite 录音存储与原子写入                |
| `quasar.config.js`                 | 构建和 Electron 打包配置                 |

## 实现边界

- 文件系统操作在 Electron 主进程，通过 preload 暴露窄范围方法；不暴露原始 IPC 或 Node API。
- 窗口使用原生标题栏与系统菜单，保持可调整大小和最大化。
- 格式遵循仓库的 `.editorconfig`、`.prettierrc`、`.eslintrc.cjs`。
