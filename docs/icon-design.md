# EcoLingo 应用图标

设计：蓝色圆角底板、白色对话气泡、三条声波，表达听音与影子跟读。

原图：`src/assets/ecolingo-icon.png`。使用内置 imagegen 生成，透明背景；通过 Pillow 仅缩放和转换文件格式，保留透明通道。

输出：`src-electron/icons/icon.png`、`icon.ico`、`icon.icns`，以及 `public/favicon.ico` 和 `public/icons/` 中各尺寸 PNG。沿用现有文件路径供 Electron 和网页/PWA 读取。ICO 包含 16、24、32、48、64、128、256 像素版本。

生成提示词：

```text
Use case: logo-brand. Asset type: EcoLingo desktop language shadowing practice app icon. Create one polished square app icon, a bold white speech bubble silhouette containing three blue vertical rounded waveform bars, the central bar taller, conveying listen and repeat. Strong simple distinctive silhouette legible at 16px. Flat solid blue #007acc rounded-square tile, generous safe padding around the central white symbol, tile fills about 90% of canvas with truly transparent exterior corners. Front-on, precisely centered, crisp vector-like edges, restrained professional friendly design. No letters, no text, no gradients, no shadows, no 3D, no additional symbols, no mockup. 1024x1024.
```
