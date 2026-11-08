# 界面与交互

## 设计理念

Minimal desktop UI。单色中性色板，纯平表面，微妙 1 px 边框，中等圆角，紧凑间距，低对比度层级，排版驱动，克制用图标，**无渐变、无毛玻璃、无重阴影**。

控件和菜单使用中文。

---

## 色彩系统

所有颜色集中在 `src/css/app.scss` 的 `:root`（浅色）与 `@media (prefers-color-scheme: dark)`（深色）以及 `src/css/quasar.variables.scss` 中维护。组件只使用令牌，不写死颜色（录音珊瑚红按钮、关闭按钮红色、白色滑块与声波除外，它们在两种外观下相同）。

文字类令牌在对应背景上均 ≥ 4.5:1（`--ink-faint` 除外，仅用于禁用态和占位符）。改动颜色时须重新核对对比度。

### 外观切换

标题栏「视图」菜单提供「外观：跟随系统 / 浅色 / 深色」，偏好保存为 `theme`。渲染进程通过 `window:setTheme` 设置 Electron `nativeTheme.themeSource`，页面的 `prefers-color-scheme` 随之变化，因此 CSS 只需媒体查询。主进程在 `userData/appearance.json` 保留一份，启动时先应用，窗口背景色（`#ffffff` / `#1a1918`，与 `--bg-base` 一致）在首帧即正确，并随 `nativeTheme` 更新。`:root` 声明 `color-scheme: light dark`，原生控件随外观变化。

### 背景

| 令牌           | 浅色                  | 深色                        | 用途                             |
| -------------- | --------------------- | --------------------------- | -------------------------------- |
| `--bg-base`    | `#ffffff`             | `#1a1918`                   | 窗口底色 / 中间内容（`html`）    |
| `--bg-surface` | `#f5f5f4`             | `#222120`                   | 边缘栏：面板、标题栏、底栏、抽屉 |
| `--bg-raised`  | `#ffffff`             | `#2b2a28`                   | 菜单弹层、对话框卡片、工具提示   |
| `--bg-sunken`  | `#f0efed`             | `#141312`                   | 空状态区域、输入框底色           |
| `--bg-hover`   | `rgba(0, 0, 0, 0.04)` | `rgba(255, 255, 255, 0.05)` | 按钮/列表项悬停                  |
| `--bg-active`  | `rgba(0, 0, 0, 0.06)` | `rgba(255, 255, 255, 0.08)` | 按钮按下、当前激活项             |

### 文字

| 令牌           | 浅色      | 深色      | 用途                           |
| -------------- | --------- | --------- | ------------------------------ |
| `--ink-strong` | `#1c1917` | `#f5f5f4` | 标题、当前句字幕、最重要的文字 |
| `--ink`        | `#44403c` | `#d6d3d1` | 正文、字幕默认色               |
| `--ink-muted`  | `#6f6863` | `#a8a29e` | 副标题、句子计数、描述         |
| `--ink-faint`  | `#a8a29e` | `#6f6964` | 仅禁用态、占位符               |

### 边框、遮罩与滚动条

| 令牌                | 浅色                  | 深色                        |
| ------------------- | --------------------- | --------------------------- |
| `--border`          | `rgba(0, 0, 0, 0.08)` | `rgba(255, 255, 255, 0.08)` |
| `--border-strong`   | `rgba(0, 0, 0, 0.12)` | `rgba(255, 255, 255, 0.14)` |
| `--backdrop`        | `rgba(0, 0, 0, 0.15)` | `rgba(0, 0, 0, 0.45)`       |
| `--scrollbar-thumb` | `rgba(0, 0, 0, 0.12)` | `rgba(255, 255, 255, 0.16)` |

### 强调与语义

| SCSS 变量   | 值                 | 说明                       |
| ----------- | ------------------ | -------------------------- |
| `$primary`  | `rgb(0, 122, 204)` | 主操作重点色（专业经典蓝） |
| `$accent`   | `rgb(0, 122, 204)` | 重点色                     |
| `$dark`     | `#1c1917`          | 暗色                       |
| `$positive` | `#16a34a`          | 成功                       |
| `$negative` | `#dc2626`          | 错误                       |
| `$info`     | `rgb(0, 122, 204)` | 信息                       |
| `$warning`  | `#ca8a04`          | 警告                       |

CSS 变量 `--accent` 为 `rgb(0, 122, 204)`，两种外观相同，用于实色主按钮背景、开关、指示条（白字对比 4.5）。Quasar 的 `.text-primary` / `.text-negative` 文字类改用 `--active-ink` / `--danger-ink`，保证小字可读；`.bg-primary` 实色按钮不受影响。

### 激活/选中、录音与提示

| 令牌              | 浅色                      | 深色                       | 用途                       |
| ----------------- | ------------------------- | -------------------------- | -------------------------- |
| `--active-ink`    | `#0066ad`                 | `#5eb1f2`                  | 选中文字（比 accent 更深） |
| `--active-bg`     | `rgba(0, 122, 204, 0.08)` | `rgba(56, 152, 236, 0.18)` | 选中底色                   |
| `--recording-ink` | `#b53434`                 | `#f28b82`                  | 录音中的当前步骤文字       |
| `--recording-bg`  | `rgba(222, 85, 85, 0.1)`  | `rgba(222, 85, 85, 0.2)`   | 录音中的当前步骤底色       |
| `--warning-ink`   | `#9a5b05`                 | `#e3b341`                  | 「没听到声音」等警示文字   |
| `--danger-ink`    | `#dc2626`                 | `#f87171`                  | 错误对话框标题与图标       |

### 焦点

| 令牌             | 浅色                               | 深色                                |
| ---------------- | ---------------------------------- | ----------------------------------- |
| `--focus-ring`   | `2px solid rgba(0, 122, 204, 0.4)` | `2px solid rgba(94, 177, 242, 0.6)` |
| `--focus-offset` | `2px`                              | `2px`                               |

所有可聚焦控件（Quasar 按钮与列表项、原生 `button`、步进器、输入框）在 `:focus-visible` 时显示 `--focus-ring`；Quasar 自带的 focus helper 已隐藏，不得移除这些 outline 规则。

---

## 排版

字体族不变：

```
--font-sans: 'Segoe UI Variable Text', 'Segoe UI', 'Microsoft YaHei UI', 'PingFang SC', sans-serif;
--font-display: 'Segoe UI Variable Display', 'Segoe UI', 'Microsoft YaHei UI', 'PingFang SC', sans-serif;
```

### 字号标尺

| 令牌                     | 值     | 字重 | 用途                         |
| ------------------------ | ------ | ---- | ---------------------------- |
| `--text-sentence-active` | `19px` | 600  | 当前正在跟读/播放的字幕句    |
| `--text-sentence`        | `18px` | 400  | 中间内容字幕列表条目         |
| `--text-title`           | `18px` | 500  | 空状态标题、对话框标题       |
| `--text-body`            | `14px` | 400  | 正文基准、抽屉列表项         |
| `--text-control`         | `13px` | 500  | 按钮、菜单项                 |
| `--text-caption`         | `12px` | 400  | 句子计数、快捷键提示、标题栏 |

- 行高：正文统一 1.5；字幕条目 1.7（保证跟读认读舒适度）。
- 字间距 0（标题可轻微负值 `-0.01em`）。
- 专注模式当前句 `--text-zen` / 500；相邻句 `--text-zen-neighbor` / 400，透明度 0.4，**保留模糊** `filter: blur(2.5px)`（与「专注模式」一节一致）。

### 字幕字号

标题栏「视图」菜单提供「字幕字号：小 / 中 / 大」，偏好保存为 `subtitleSize`，写入 `<html data-subtitle-size>`，只替换字幕相关令牌：

| 令牌                     | 小                         | 中（默认）                 | 大                         |
| ------------------------ | -------------------------- | -------------------------- | -------------------------- |
| `--text-sentence`        | `16px`                     | `18px`                     | `21px`                     |
| `--text-sentence-active` | `17px`                     | `19px`                     | `22px`                     |
| `--text-zen`             | `clamp(28px, 3.8vw, 46px)` | `clamp(34px, 4.6vw, 56px)` | `clamp(40px, 5.4vw, 66px)` |
| `--text-zen-neighbor`    | `clamp(15px, 1.9vw, 22px)` | `clamp(17px, 2.2vw, 26px)` | `clamp(19px, 2.5vw, 30px)` |

「视图」菜单选择后保持打开，便于对比；菜单打开时空格和 R 快捷键暂停。

---

## 间距

紧凑原则，基准单位 4 px。

| 场景               | 值             |
| ------------------ | -------------- |
| 面板内边距         | `12px`         |
| 字幕条目之间       | `2px`          |
| 字幕条目内边距     | `8px 12px`     |
| 工具栏最小高度     | `56px`         |
| 系统标题栏高度     | `34px`         |
| 课程标题栏高度     | `36px`         |
| 按钮高度（非圆形） | `32px`         |
| 菜单项高度         | `36px`         |
| 按钮内边距         | `0 10px`       |
| 组件间 gap         | `4px` 或 `8px` |

- 窗口宽度不超过 600 px 时，底栏把循环与速度控件收进「更多」按钮（`more_horiz`）的菜单，跟读、中央播放控制、专注按钮和「更多」保持单排；更宽窗口直接显示全部控件，普通与专注模式使用相同规则。

---

## 圆角

| 令牌            | 值      | 用途                 |
| --------------- | ------- | -------------------- |
| `--radius-sm`   | `4px`   | 标题栏按钮、行内标签 |
| `--radius-md`   | `6px`   | 按钮、输入框、菜单项 |
| `--radius-lg`   | `8px`   | 菜单弹层、对话框卡片 |
| `--radius-xl`   | `12px`  | 空状态卡片           |
| `--radius-full` | `999px` | 圆形按钮、切换开关   |

---

## 阴影

只保留极淡投影，不使用 `inset` 白边高光：

| 令牌          | 值                               |
| ------------- | -------------------------------- |
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.04)`  |
| `--shadow-md` | `0 2px 6px rgba(0, 0, 0, 0.06)`  |
| `--shadow-lg` | `0 4px 12px rgba(0, 0, 0, 0.08)` |

- 标题栏、底栏：无阴影，仅靠 1 px `--border` 分隔。
- 弹出菜单、对话框：`--shadow-lg`。
- 工具提示：`--shadow-sm`。

---

## 表面与面板

全部使用**不透明实色**。删除所有 `backdrop-filter`、`-webkit-backdrop-filter`、`saturate` 叠加。

| 区域                                                     | 背景                 | 边框                         |
| -------------------------------------------------------- | -------------------- | ---------------------------- |
| 标题栏 `.system-titlebar`                                | `--bg-surface`       | 底 1 px `--border`           |
| 课程标题栏 `.lesson-heading`                             | `--bg-surface`       | 无额外边框（同 header 容器） |
| Header `.glass-header`（类名可保留或改为 `.app-header`） | `--bg-surface`       | 底 1 px `--border`           |
| Footer `.glass-footer`                                   | `--bg-surface`       | 顶 1 px `--border`           |
| 右侧抽屉 `.glass-drawer`                                 | `--bg-surface`       | 左 1 px `--border`           |
| 菜单 `.q-menu`                                           | `--bg-raised`        | 1 px `--border-strong`       |
| 对话框卡片                                               | `--bg-raised`        | 1 px `--border-strong`       |
| 工具提示                                                 | `--bg-raised`        | 1 px `--border`              |
| 字幕面板 `.sentences-panel`                              | 透明（继承窗口底色） | 无                           |
| 空状态 `.lesson-empty`                                   | `--bg-sunken`        | 1 px `--border`              |
| 错误页 `.glass-error-panel`                              | `--bg-surface`       | 1 px `--border`              |

---

## 按钮

- 全局禁用水波纹 (`.q-ripple { display: none }`) 和 `.q-focus-helper`——保持不变。
- **默认按钮（flat）**：透明底，文字/图标 `--ink`；hover 时背景 `--bg-hover`，无边框色变化；active 时背景 `--bg-active`。
- **主操作按钮**（播放/暂停大圆钮）：实色 `$primary`（即深暖灰），文字/图标白色，圆形。投影 `--shadow-sm`。hover 时颜色加深 5%。
- **空状态 CTA**（「继续练习」/「从第一课开始」/「打开课程文件夹」）：实色 `$primary`，白色文字，圆角 `--radius-md`，投影 `--shadow-sm`。
- 圆形按钮保持 `border-radius: 50%`。
- 非圆形按钮圆角 `--radius-md`。

---

## 跟读控制

底栏左侧不放文字，只用图标，说明放在悬停提示里：

- 跟读开关：flat 圆形图标按钮 `record_voice_over`，`role="switch"` + `aria-checked`，`aria-label`「跟读」，提示「开启跟读 · S」/「关闭跟读 · S」。关闭态图标 `--ink`；开启态图标 `--active-ink`、背景 `--active-bg`。
- 开启跟读后右侧出现 28 × 28 px 的圆形 `expand_less` 按钮（`--ink-muted`，`aria-label`「选择练习方式」，提示「练习方式：当前方式」），点击弹出「练习方式」上拉菜单（先听后读、听读回听、先读再听）。关闭跟读时收起菜单并隐藏箭头。

## 文字与图标

能用图标表达的操作不写文字：图标按钮必须有 `aria-label` 和悬停提示（`delay 400`、`hide-delay 0`、`transition-duration 100`），有快捷键时写在提示里。菜单项、对话框和空状态的说明仍用文字。桌面菜单「文件 / 视图 / 帮助」保留文字。

---

## 图标

克制使用。仅在以下场景保留 Material Icons：

- 播放控制：`play_arrow` / `pause` / `skip_previous` / `skip_next`
- 录音状态：`mic` / `mic_off`（课程列表的录音句数也用 14 px `mic`）
- 空状态：`headphones`
- 文件操作：`folder_open`
- 跟读与练习方式：`record_voice_over` / `expand_less`
- 回到当前句：`my_location`
- 模式切换：`fullscreen` / `fullscreen_exit`
- 窄窗口溢出菜单：`more_horiz`
- 循环模式：`repeat` / `repeat_one`
- 错误提示：`warning`
- 录音回放：`play_circle` / `stop_circle`
- 原声 / 录音对比：`compare_arrows`（进行中显示 `stop_circle`）

图标尺寸 18–20 px，颜色跟随文字令牌。不使用填充色或彩色背景圈住图标（录音异常对话框中 `warning` 图标也不再套圆形/方形色块，直接裸图标 + 文字）。

侧边栏开关的自定义 SVG 保持为简单线条，笔画 1 px，颜色 `--ink-muted`。

---

## 播放与录音状态按钮

删除底部悬浮麦克风与播放状态浮层，由底栏中央主播放按钮统一承担状态呈现：

- **正常播放/空闲态**：保持标准样式（48 px 圆形，实色 `$primary` 经典蓝，居中播放/暂停图标）。
- **录音态**：主按钮直接切换为录音胶囊声波样式（实色珊瑚红 `#de5555`，内部居中三条纯白垂直圆角胶囊柱：两侧 3.5×7 px，中间 4×9.5 px）。
- **检测到人声**：胶囊声波柱以高灵敏度平滑拉长如设计图所示（两侧胶囊拉长至 20 px，中间主胶囊拉长至 28 px）；静音或无声音时高灵敏度平滑恢复为初始短胶囊原样（7 px / 9.5 px）；减少动态效果偏好下即时切换无过渡。
- **点击交互**：录音时点击主按钮或按空格键立即停止当前录音并重置该句。

---

## 专注模式

- **全屏沉浸舞台**：专注模式开启后，顶栏与抽屉隐藏，全屏由练习区域占满全部视野（宽高 100%，无孤立卡片框界）。当前句放大至 `clamp(34px, 4.6vw, 56px)`，上下相邻句实施高斯模糊软化（`filter: blur(2.5px); opacity: 0.4;`），形成纯粹沉浸景深。
- **一致布局的隐蔽底栏**：底部控制栏的内部控件排布与尺寸与正常模式完全一致（全宽三栏布局：左侧跟读方式、中央圆形播放按钮与前后句、右侧退出专注与模式/倍速），平时以 `transform: translateY(100%)` 隐藏在屏幕下方，鼠标移到底部感应区时平滑滑出，移开后自动收回。
- **录音时独立浮现**：专注模式底栏隐藏期间，录音启动时红色录音胶囊声波按钮自动独立从底部中央平滑浮现（`bottom: 16px`），说话时声波柱实时拉长；录音结束或点击停止后平滑隐退；鼠标移入底栏感应区时无缝切至完整控制栏。
- **跟读控制**：与普通模式相同，`record_voice_over` 图标开关，开启后旁边的 `expand_less` 小按钮弹出练习方式菜单（见「跟读控制」）。
- **圆形主播放按钮**：主播放键保持 48px 标准圆形与居中图标。
- **退出交互**：可通过键盘 `Escape` 键或移至底部点击退出专注按钮退出。

---

## 练习状态

开启跟读且已加载课程时显示练习状态（`src/components/PracticeStatus.vue`，状态由 `src/utils/practice-status.ts` 推导）：

- 步骤随练习方式变化：先听后读「听原声 · 跟读」；听读回听「听原声 · 跟读 · 回听」；先读再听「尝试 · 听原声 · 跟读 · 回听」。当前步骤用 `--active-ink` / `--active-bg` 胶囊高亮，录音中改用 `--recording-ink` / `--recording-bg`；已完成步骤 `--ink-muted`，未到步骤 `--ink-faint`；等待开始时不高亮任何步骤。
- A/B 对比进行时（无论是否开启跟读）改为显示「原声 · 我的录音」两步：播放原声高亮第一步，停顿和播放录音时高亮第二步。
- 步骤旁不显示说明文字（准备麦克风、录音中、保存、回听等由高亮步骤、录音按钮声波和指示条颜色表达），只有提醒类状态显示文字。
- 没检测到语音时不高亮步骤，改为 `--warning-ink` 显示「没听到声音，按空格重试」，持续 2 秒。
- 状态跟着视线走，紧贴当前句显示，不放在窗口角落：普通模式是当前句条目里的第二行（与句子文字左对齐，行高 1.5）；专注模式在当前句正下方居中（间距 12 px）。开启跟读后这一行一直占位，空闲时隐藏（`visibility: hidden`），开始、暂停时句子不跳动。窗口 ≤ 600 px 时只显示当前步骤。
- 当前句左侧 2 px 指示条随状态变色：默认 `--accent`，录音中 `--recording-ink`，提醒（没听到声音）`--warning-ink`；只看句子也能分辨在听还是在读。

## 按键提示

键盘触发 C / X / Z、Q / E、S 时，在窗口底部中央（`bottom: 96px`，高于底栏和专注模式的录音按钮）显示约 1.2 秒的胶囊提示（`src/components/ActionHud.vue`）：「速度 1.1x」「第 3 课 · 课程名」「跟读已开启 · 先听后读」「跟读已关闭」。鼠标操作不显示（控件本身可见）。同一提示也用于打开文件夹的反馈（无成对课程、拖入项无法读取）。胶囊 `--bg-raised`、1 px `--border-strong`、`--radius-full`、`--shadow-md`，150 ms 淡入淡出，减少动态效果时无过渡。

## 空状态与课程列表

- 空状态（`src/components/LessonEmptyState.vue`）按情况切换：有可继续的位置时标题「继续上次的练习」、说明「课程名 · 第 N 句」、主按钮「继续练习」；已有课程列表时「选择一课开始」、「文件夹名 · 共 N 课」、主按钮「从第一课开始」；没有课程时「开始今天的跟读」、主按钮「打开课程文件夹」，说明「选择或拖入包含音频和字幕的文件夹」。有课程时下方另有 flat 按钮「打开其他文件夹」。
- 首次打开课程时，主按钮转圈和「正在打开课程…」延迟 300 ms 才出现，加载快时不闪。
- 课程抽屉顶部只显示文件夹名（`--text-body` / 500 / `--ink-strong`，超长省略）；还没有文件夹时显示「课程列表」（`--text-caption` / 600 / `--ink-muted`）。右侧 `folder_open` 小按钮打开其他文件夹。
- 课程多于 15 节时显示筛选输入框（30 px 高，`--bg-sunken`，1 px `--border`，`--radius-md`），按名称不区分大小写过滤；无匹配时显示「没有匹配的课程」。
- 有录音的课程在名称下显示 14 px `mic` 图标 + 句数（`--text-caption` / `--ink-muted`，等宽数字，悬停显示「已录 N 句」，当前课程中透明度 0.75）。
- 拖入文件时全窗口显示 `rgba(0, 0, 0, 0.15)` 遮罩和居中卡片「松开以打开课程文件夹」（`--bg-raised`、`--radius-lg`、`--shadow-lg`），遮罩不拦截指针事件。

## 字幕列表

- 每个句子条目：`--text-sentence`（18 px），行高 1.7，内边距 `10px 14px`，圆角 `--radius-md`（6 px）。
- 当前播放句高亮：`--text-sentence-active`（19 px）/ 600，背景 `--active-bg`，文字 `--ink-strong`，左侧 2 px `--accent` 内阴影竖线作为指示条。
- 悬停：背景 `--bg-hover`。
- 句子切换自动滚动居中；用户手动滚动后暂停跟随，标题栏显示 `my_location` 圆形图标按钮（提示「回到当前句」）。
- 课程标题栏的句子计数只写「3 / 20」。
- 切换课程时保留上一课的列表直到新课程就绪，不出现空状态：加载超过 150 ms 时列表淡到 0.45 并停止响应指针，录音按钮隐藏，句子计数隐藏；减少动态效果时无过渡。
- 有录音的句子右侧依次显示对比按钮（`compare_arrows`）和播放/停止录音按钮（`play_circle` / `stop_circle`），颜色 `--ink-muted`，hover 时 `--ink`。对比进行中，该句对比按钮变为 `stop_circle`（`primary`），播放录音按钮隐藏；播放录音阶段该句使用回放高亮。
- 操作列固定 84 px，所有句子文本宽度一致。
- 句子获得焦点后，↑ / ↓ 在句子间移动焦点并保持可见，Enter 播放该句；方向键同时暂停自动跟随。

---

## 滚动条

- 宽度 `6px`（比之前 10 px 更窄）。
- 滑块：`--scrollbar-thumb`，圆角 `--radius-full`；Quasar 滚动区（课程抽屉）滑块用 `--ink-strong` 配合其自带透明度。
- 轨道透明。
- 字幕面板 `.sentences-panel` 保持隐藏原生滚动条。

---

## 循环与速度菜单

- 循环菜单（`src/components/LoopModeList.vue`）：单句循环一行带「− 次数 +」步进器；次数 0–99，0 显示为 `∞` 表示无限循环；输入框可直接输入数字或 `∞`，滚轮增减。
- 速度菜单（`src/components/PlaybackRateList.vue`）：顶部「− 当前倍速 +」步进器（步长 0.1，与 C/X 一致，范围 0.1–4），下方为预设倍速；当前值与预设相等时高亮对应项。
- 两个组件同时用于底栏按钮菜单和窄窗口的「更多」菜单，选项与格式化逻辑集中在 `src/utils/playback-options.ts`。

## 对话框

- 遮罩：`--backdrop`，无背景模糊。
- 卡片：`--bg-raised`，1 px `--border-strong`，圆角 `--radius-lg`（8 px），投影 `--shadow-lg`。
- 标题 `--text-title` / 500，正文 `--text-body` / `--ink`。
- 内边距 `24px`。
- 错误对话框按来源区分标题：课程加载/播放失败显示「课程无法播放」，并提供「重新选择文件夹」；麦克风与录音问题显示「录音提示」。

---

## Electron 窗口与标题栏

- 应用图标（方案「影子」）：深色圆角方底 `#1c1917`，白色五条声波是原声，向右下错开的 `#2f9be8` 声波是跟读的「影子」。母版是 `src-electron/icons/icon.svg`；`icon.png` / `icon.ico` / `icon.icns` 和 `public/favicon.ico`、`public/icons/favicon-*.png` 都由它导出，改图标时先改母版，再重新导出全部尺寸。标题栏「EcoLingo」左侧显示 16 px 图标（`public/icons/favicon-32x32.png`）。

- 正常模式下右上角具备三个窗口操作按钮（最小化、最大化/还原、关闭），关闭按钮支持红色悬浮高亮。
- 双击系统标题栏空白区域可切换窗口最大化与还原。
- 专注模式下标题栏整体隐藏，窗口控制按钮随之隐藏。
- 窗口背景色随外观为 `#ffffff` / `#1a1918`（与 `--bg-base` 一致），见「外观切换」。
- 系统标题栏依次为「文件」（打开文件夹）、「视图」（外观、字幕字号）、「帮助」（快捷键）。
- 窗口保留原生阴影与缩放边框（`thickFrame: true`）。

---

## 快捷键

空格 播放/暂停 | S 跟读 | A/D 上/下一句 | Q/E 上/下一课 | B 对比原声与录音 | C/X 加/减速 | Z 重置速度 | Esc 退出专注显示

当前句没有录音时按 B 显示按键提示「这句还没有录音」。

快捷键对话框（标题栏「帮助」）用 `<kbd>` 两列列出全部按键，内容与上面保持同步。专注模式下有菜单打开时，Esc 先关闭菜单，再按一次才退出专注模式。

播放中按 R 跳过播放并录制当前句；录音中按 R 打断并重新录制，开始录制前播放短提示音。重录等待期间保持录音按钮，仅声波播放一次轻微刷新动画；减少动态效果偏好下不播放动画。Ctrl+R 仍保留刷新行为。

忽略可编辑控件，未加载课程时禁用。

- 点击句子或普通按钮后，空格仍控制播放/暂停；在捕获阶段处理按下和松开，避免控件模拟重复点击，长按只切换一次。输入框、菜单与对话框保留自身键盘交互。

---

## 涉及文件

| 文件                                   | 改动范围                                             |
| -------------------------------------- | ---------------------------------------------------- |
| `src/css/app.scss`                     | 全部重写：令牌、表面、按钮、滚动条、无障碍           |
| `src/css/quasar.variables.scss`        | `$primary` 等品牌色                                  |
| `src/layouts/MainLayout.vue` `<style>` | 拖放遮罩                                             |
| `src/components/LessonEmptyState.vue`  | 空状态卡片、继续上次                                 |
| `src/components/AppTitleBar.vue`       | 系统标题栏、窗口控制按钮（样式在 `app.scss`）        |
| `src/components/LessonHeading.vue`     | 课程标题、句子计数、回到当前句、抽屉开关             |
| `src/components/LessonDrawer.vue`      | 课程列表抽屉：文件夹名、筛选、已录句数               |
| `src/components/SentenceList.vue`      | 字幕列表、录音回放按钮                               |
| `src/components/ZenStage.vue`          | 专注模式舞台与邻句模糊                               |
| `src/components/PlaybackBar.vue`       | 底栏：播放控制、跟读开关、练习方式、循环、速度、更多 |
| `src/components/RecordingWaveform.vue` | 录音胶囊声波                                         |
| `src/components/ShortcutsDialog.vue`   | 快捷键对话框                                         |
| `src/components/AppErrorDialog.vue`    | 课程 / 录音错误对话框                                |
| `src/components/PracticeStatus.vue`    | 练习步骤与状态说明                                   |
| `src/components/ActionHud.vue`         | 键盘操作的短暂提示                                   |
| `src-electron/electron-main.ts`        | `titleBarOverlay` 颜色、关闭 Mica、背景色            |
| `src/pages/ErrorNotFound.vue`          | 错误页面板样式对齐新系统                             |
| `src/components/LoopModeList.vue`      | 循环模式菜单与单句循环次数步进器                     |
| `src/components/PlaybackRateList.vue`  | 播放速度步进器与预设列表                             |
| `src/utils/playback-options.ts`        | 循环模式、倍速预设、倍速取整与描述文案               |
