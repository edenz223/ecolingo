import { app, BrowserWindow, ipcMain, dialog, Menu } from "electron";
import path from "path";
import os from "os";
import { FileProcessor } from "./fileSystem";
import { RecordingStore, lessonIdentity } from './recording-store.cjs';

const fileProcessor = new FileProcessor();

// 修改 handleFolderOpen 函数
async function handleFolderOpen() {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    filters: [
      {
        name: "Audio Files",
        extensions: ["mp3", "wav", "ogg", "aac", "flac", "m4a"],
      },
    ],
  });
  if (result.canceled) {
    return;
  }
  const folderPath = result.filePaths[0];
  const { completeLessons, incompleteLessons } =
    fileProcessor.processFolder(folderPath);

  if (incompleteLessons.length > 0) {
    const message = `以下课程缺少音频或字幕，已跳过： ${incompleteLessons.join(
      ", "
    )}`;
    dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "课程文件不完整",
      message: message,
      buttons: ["关闭"],
    });
  }

  mainWindow.webContents.send("folder-selected", completeLessons);
}

function readTextFile(event, filePath) {
  return fileProcessor.readTextFile(filePath);
}

let mainWindow;
// 修改 ipcMain 处理程序
ipcMain.handle("openFolder", handleFolderOpen);
ipcMain.handle("readTextFile", readTextFile);

let recordingStorePromise;
function getRecordingStore() {
  if (!recordingStorePromise) {
    recordingStorePromise = RecordingStore.open(path.join(app.getPath('userData'), 'recordings'))
      .catch((error) => { recordingStorePromise = null; throw error; });
  }
  return recordingStorePromise;
}

ipcMain.handle('recordings:identity', (event, lesson) => lessonIdentity(lesson));
ipcMain.handle('recordings:list', async (event, lessonId) => (await getRecordingStore()).list(lessonId));
ipcMain.handle('recordings:save', async (event, meta, bytes) => (await getRecordingStore()).save(meta, bytes));
ipcMain.handle('recordings:read', async (event, id) => (await getRecordingStore()).read(id));
ipcMain.handle('window:setFocusMode', (event, isFocus) => {
  if (!mainWindow) return;
  if (platform === 'win32') {
    if (isFocus) {
      mainWindow.setTitleBarOverlay({ color: '#00000000', symbolColor: '#00000000', height: 0 });
    } else {
      mainWindow.setTitleBarOverlay({ color: '#00000000', symbolColor: '#5c6b77', height: 34 });
    }
  } else if (platform === 'darwin') {
    mainWindow.setWindowButtonVisibility(!isFocus);
  }
});
// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    icon: path.resolve(__dirname, "icons/icon.png"), // tray icon
    title: 'EcoLingo',
    width: 1000,
    height: 600,
    minWidth: 600,
    minHeight: 520,
    show: false,
    frame: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#5c6b77',
      height: 34,
    },
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    thickFrame: true,
    useContentSize: true,
    backgroundColor: '#edf2f7',
    ...(platform === 'win32' ? {
      backgroundMaterial: 'mica',
      roundedCorners: true,
    } : {}),
    webPreferences: {
      // Keep the audio-clock checks running while the lesson window is minimized.
      backgroundThrottling: false,
      webSecurity: false,
      sandbox: true,
      contextIsolation: true,
      // More info: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/electron-preload-script
      preload: path.resolve(__dirname, process.env.QUASAR_ELECTRON_PRELOAD),
    },
    autoHideMenuBar: true,
    menuBarVisible: false,
  });

  if (platform === 'win32') mainWindow.setMaximizable(true);

  mainWindow.loadURL(process.env.APP_URL);
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  if (process.env.DEBUGGING) {
    // if on DEV or Production with debug enabled
    mainWindow.webContents.openDevTools();
  } else {
    // we're on production; no access to devtools pls
    mainWindow.webContents.on("devtools-opened", () => {
      mainWindow.webContents.closeDevTools();
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });
  app.whenReady().then(createWindow);
}

app.on("window-all-closed", () => {
  if (platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

const isMac = process.platform === "darwin";

const template = [
  // { role: 'appMenu' }
  ...(isMac
    ? [
        {
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { label: "退出", role: "quit" },
          ],
        },
      ]
    : []),
  // { role: 'fileMenu' }
  {
    label: "文件",
    submenu: [
      isMac ? { label: "关闭窗口", role: "close" } : { label: "退出", role: "quit" },
      {
        label: "打开课程文件夹",
        click: () => {
          handleFolderOpen();
        },
      },
    ],
  },
  // { role: 'editMenu' }
  {
    label: "编辑",
    submenu: [
      { label: "撤销", role: "undo" },
      { label: "重做", role: "redo" },
      { type: "separator" },
      { label: "剪切", role: "cut" },
      { label: "复制", role: "copy" },
      { label: "粘贴", role: "paste" },
      ...(isMac
        ? [
            { role: "pasteAndMatchStyle" },
            { label: "删除", role: "delete" },
            { label: "全选", role: "selectAll" },
            { type: "separator" },
            {
              label: "朗读",
              submenu: [{ role: "startSpeaking" }, { role: "stopSpeaking" }],
            },
          ]
        : [{ label: "删除", role: "delete" }, { type: "separator" }, { label: "全选", role: "selectAll" }]),
    ],
  },
  // { role: 'viewMenu' }
  {
    label: "视图",
    submenu: [
      { label: "重新加载", role: "reload" },
      { label: "强制重新加载", role: "forceReload" },
      { label: "开发者工具", role: "toggleDevTools" },
      { type: "separator" },
      { label: "实际大小", role: "resetZoom" },
      { label: "放大", role: "zoomIn" },
      { label: "缩小", role: "zoomOut" },
      { type: "separator" },
      { label: "切换全屏", role: "togglefullscreen" },
    ],
  },
  // { role: 'windowMenu' }
  {
    label: "窗口",
    submenu: [
      { label: "最小化", role: "minimize" },
      { label: "缩放窗口", role: "zoom" },
      ...(isMac
        ? [
            { type: "separator" },
            { role: "front" },
            { type: "separator" },
            { role: "window" },
          ]
        : [{ label: "关闭窗口", role: "close" }]),
    ],
  },
  {
    label: '帮助',
    role: "help",
    submenu: [
      {
        label: '键盘快捷键',
        click: async () => {
          await dialog.showMessageBox(mainWindow, {
            type: 'info', title: '键盘快捷键',
            message: '空格：播放 / 暂停\nS：跟读开关\nA / D：上一句 / 下一句\nQ / E：上一课 / 下一课\nC / X：加速 / 减速\nZ：重置速度',
            buttons: ['关闭'],
          });
        },
      },
    ],
  },
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
