# EcoLingo

用本地音频和带时间轴字幕（LRC / SRT）练习影子跟读的桌面应用。离线可用，无需账号。

## 功能

- 打开或拖入课程文件夹，自动配对同名音频与字幕。
- 逐句播放、循环、变速；跟读模式自动录音并在说完后停止。
- 三种练习方式（先听后读、听读回听、先读再听）与专注显示。
- 原声 / 录音 A/B 对比。

## 本地录音

完成跟读后，录音写入 Electron 用户数据目录下的 `recordings/`：

- `index.sqlite`：课程、句子、录音时间、格式和校验信息。
- `audio/`：每次录音的独立音频文件，重复练习保留历史版本。

录音按课程内容关联：移动或重命名课程文件不影响关联，修改内容会产生新的课程身份。录音仅保存在本地，不提供导出或云同步。

## 开发

需要 Node 20+ 和 Yarn 1。

```bash
yarn            # 安装依赖
yarn dev        # Electron 开发模式
yarn lint
yarn test       # 单元测试
yarn test:smoke # Electron 冒烟测试（需图形环境，先 yarn build）
yarn build      # 打包
```

`tests/fixtures/` 中的样例课程供冒烟测试使用。
