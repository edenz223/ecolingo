# EcoLingo Agent 指南

## 产品定位

EcoLingo 是一款桌面语言学习应用，使用本地音频和带时间轴的字幕练习影子跟读。核心流程：打开课程文件夹 → 听一句原音 → 跟读复述 → 回放录音。

优先保证句子计时准确、播放和录音可靠、字幕清晰、键盘操作快捷。核心功能本地可用，无需账号或网络。仅在明确要求时引入云服务或语音评测。

## 技术栈与代码结构

- **前端**：Vue 3 + Composition API（`<script setup>`）、TypeScript、Quasar 2、Vite。
- **桌面**：Electron（原生标题栏、系统菜单、`contextIsolation` + 沙箱）。
- **音频**：Howler 播放课程音频；`MediaRecorder` + `getUserMedia` 录音。

| 模块 | 职责 |
|---|---|
| `src/layouts/MainLayout.vue` | 学习界面、键盘快捷键与事件协调 |
| `src/modules/player.ts` | 音频播放、20 ms 轮询时钟与句子同步 |
| `src/modules/recorder.ts` | 麦克风录音、VAD 监控、自动停止与本地保存 |
| `src/modules/zen.ts` | Zen 练习状态机（三种练习方式） |
| `src/utils/lyrics-util.ts` | LRC / SRT 字幕解析 |
| `src/utils/settings.ts` | 偏好设置加载与持久化（`localStorage`） |
| `src/utils/voice-activity.ts` | Web Audio RMS 语音检测与自适应阈值 |
| `src/utils/zen-flow.ts` | Zen 练习流程调度 |
| `src/types/` | TypeScript 类型定义 |
| `src-electron/electron-main.ts` | 窗口、菜单、IPC |
| `src-electron/electron-preload.ts` | 强类型 `window.fileAPI` 桥接 |
| `src-electron/fileSystem.ts` | 音频/字幕配对与编码检测 |
| `src-electron/recording-store.ts` | SQLite 录音存储与原子写入 |
| `quasar.config.js` | 构建和 Electron 打包配置 |

## 开发命令

以 `package.json` 为准。

| 命令 | 用途 |
|---|---|
| `npm install` | 安装依赖 |
| `npm run dev` | Electron 开发模式 |
| `npm run lint` | 检查代码 |
| `npm run build` | 构建打包 |
| `npm run format` | 格式化（优先改动文件） |

构建目标 Node 20。仓库含 `package-lock.json` 和 `yarn.lock`，沿用当前包管理器，避免无关锁文件变更。

## 实现规范

- 聚焦当前任务，保留无关改动，避免整文件格式化。
- 遵循 `.editorconfig`、`.prettierrc`、`.eslintrc.cjs`：两空格缩进、LF、分号、单引号。
- 文件系统操作在 Electron 主进程，通过 preload 暴露窄范围方法；不暴露原始 IPC 或 Node API。
- 使用原生窗口标题栏与系统菜单；窗口保持可调整大小和最大化。
- 不要修改 `.quasar/`、`dist/`、`node_modules/` 中的生成文件。

## 课程与计时

- 课程按文件名配对音频（MP3/WAV/OGG/AAC/FLAC/M4A）和字幕（LRC/SRT）。
- 句子格式 `{ start, end, text }`，单位秒。LRC 的 `end` 取下一句 `start`；最后一句用音频时长补齐。
- 保留 Unicode 与编码检测；字幕按文本渲染，不作为 HTML 执行。
- 导入须处理空文件、错误时间戳、缺失配对和特殊文件名，错误提示可操作且不崩溃。
- 句子切换使用 20 ms 轮询音频时钟，最后一句由音频结束回调处理。
- 切换课程时取消过期异步任务，防止旧会话干扰。

## 播放与录音

### 循环模式

顺序播放 → 列表循环 → 单句循环，点击切换。单句循环默认无限（repeatCount=0），滚轮调次数（0–99）。列表循环末句后自动播下一课。暂停/导航/切课/切换模式清零计数。偏好用 `loopMode` 保存。

### 跟读与 Zen 练习

底栏"跟读"总开关，开启后选择练习方式（保存在 `practiceMethod`）：

| 方式 | 流程 | 录音保存 |
|---|---|---|
| 先听后读 | 原声 → 500 ms → 录音 | 保存 |
| 听读回听 | 原声 → 500 ms → 录音 → 回听 | 保存 |
| 先读再听（Zen） | 首次录音 → 原声 → 500 ms → 第二次录音 → 回听 | 仅第二次 |

- 切换方式或开关均暂停，不立即申请麦克风。
- 仅在 `MediaRecorder` 最终停止事件后推进或重复。
- Zen 中暂停/导航/切课/退出取消当前流程并释放麦克风；重试从首次录音开始。异步保存和回听须校验会话，禁止取消后续播。

### 语音检测（VAD）

`voice-activity.ts` 使用 Web Audio RMS + 自适应阈值：连续 120 ms 语音视为开口，尾部静音 1.2 s 结束，最长等待 8 s，录音上限 10 s。无语音暂停不保存；不设手动完成按钮。

### 录音存储

- 录音保存到 `userData/recordings`（音频文件 + `index.sqlite`），每条有 UUID。
- 课程标识由音频和字幕内容哈希生成，移动文件夹后仍可关联。
- 存储操作在主进程，先写音频再原子替换索引。录音须同时关联课程和句子标识。
- 录音保留在本地，不提供导出或云同步。

### 播放偏好

通过 `settings.ts` 保存到 `localStorage` 的 `ecolingo.settings.v1`（速度、跟读、循环模式等）。启动恢复偏好时不请求麦克风。

### UI 与交互

- 苹果风格半透明玻璃材质。页面顶部单行呈现课程标题、句子计数与侧边栏开关。
- 句子切换自动滚动居中；用户手动滚动后暂停跟随，显示"回到当前句"。
- 底栏突出上一句/播放暂停/下一句；课程选择位于侧边抽屉。
- 录音麦克风悬浮底栏上方，60 px，红色呼吸 → 绿色波纹（有语音）→ 琥珀色关闭（无语音）。减少动态效果偏好下禁用动画。
- 专注模式：居中放大当前句、虚化相邻句、底部控制。独立于练习方式，不持久化。
- 暂停/跳转/切课后播放与录音状态须一致，不得重叠。
- 会话结束时停止媒体轨道、取消计时器、移除监听器、撤销对象 URL。
- 控件和菜单使用中文。

### 快捷键

空格 播放/暂停 | S 跟读 | A/D 上/下一句 | Q/E 上/下一课 | C/X 加/减速 | Z 重置速度

忽略可编辑控件，未加载课程时禁用。

## 验证与交付

验证与改动范围匹配，执行最小有效检查集：

- 代码改动：`npm run lint`
- 涉及构建/主进程/preload/依赖：加 `npm run build`
- 涉及已有测试的核心逻辑：运行对应测试（`voice-activity.test.cjs` / `settings.test.cjs` / `test:recordings`）
- 修复易复发 bug：优先添加回归测试
- 纯文档/样式：不运行无关测试

检查失败先判断是否本次改动导致。交付说明：改了什么、运行了哪些检查、哪些留给人工验收。不得将自动测试描述为真实桌面交互已验证。
