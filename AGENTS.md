# EcoLingo Agent 指南

EcoLingo 是一款使用本地音频和带时间轴字幕练习影子跟读的桌面语言学习应用。

核心功能须离线可用，无需账号；仅在明确要求时引入云服务或语音评测。
不要修改 `.quasar/`、`dist/`、`node_modules/` 中的生成文件。

按任务范围读取以下指南；涉及多个领域时读取对应文件：

- 技术栈、模块定位与 Electron 边界：[架构与实现](docs/agents/architecture.md)
- 导入、字幕解析与句子同步：[课程与计时](docs/agents/lessons.md)
- 播放、跟读、VAD、偏好与会话清理：[练习流程](docs/agents/practice.md)
- 录音持久化与课程关联：[录音存储](docs/agents/recordings.md)
- 布局、动画、专注模式与键盘操作：[界面与交互](docs/agents/ui.md)
- 开发、格式化及交付检查：[开发与验证](docs/agents/validation.md)
