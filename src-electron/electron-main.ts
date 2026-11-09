import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  MenuItemConstructorOptions,
  nativeTheme,
} from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { FileProcessor } from './fileSystem';
import { RecordingStore, createLessonIdentityCache } from './recording-store';

// Builds before 0.1.0 were named "ecolingo"; keep their recordings where the
// file system is case-sensitive.
const legacyUserData = path.join(app.getPath('appData'), 'ecolingo');
if (!fs.existsSync(app.getPath('userData')) && fs.existsSync(legacyUserData)) {
  app.setPath('userData', legacyUserData);
}

const fileProcessor = new FileProcessor();
const lessonIdentity = createLessonIdentityCache();

let mainWindow: BrowserWindow | null = null;

// 修改 handleFolderOpen 函数
async function handleFolderOpen() {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    filters: [
      {
        name: 'Audio Files',
        extensions: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'],
      },
    ],
  });
  if (result.canceled) {
    return;
  }
  loadLessonFolder(result.filePaths[0]);
}

// Dropped items arrive as paths; a dropped file opens the folder that contains it.
function handleFolderPathOpen(_event: unknown, target: unknown): boolean {
  if (typeof target !== 'string' || !path.isAbsolute(target)) return false;
  try {
    const folderPath = fs.statSync(target).isDirectory() ? target : path.dirname(target);
    loadLessonFolder(folderPath);
    return true;
  } catch {
    return false;
  }
}

function loadLessonFolder(folderPath: string) {
  const { completeLessons, incompleteLessons } = fileProcessor.processFolder(folderPath);

  if (incompleteLessons.length > 0 && mainWindow) {
    const message = `以下课程缺少音频或字幕，已跳过： ${incompleteLessons.join(', ')}`;
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: '课程文件不完整',
      message: message,
      buttons: ['关闭'],
    });
  }

  mainWindow?.webContents.send('folder-selected', completeLessons);
}

function readTextFile(_event: any, filePath: string) {
  return fileProcessor.readTextFile(filePath);
}

// 修改 ipcMain 处理程序
ipcMain.handle('openFolder', handleFolderOpen);
ipcMain.handle('openFolderPath', handleFolderPathOpen);
ipcMain.handle('readTextFile', readTextFile);

let recordingStorePromise: Promise<RecordingStore> | null = null;
function getRecordingStore(): Promise<RecordingStore> {
  if (!recordingStorePromise) {
    recordingStorePromise = RecordingStore.open(
      path.join(app.getPath('userData'), 'recordings')
    ).catch(error => {
      recordingStorePromise = null;
      throw error;
    });
  }
  return recordingStorePromise;
}

ipcMain.handle('recordings:identity', (_event, lesson) => lessonIdentity(lesson));
ipcMain.handle('recordings:list', async (_event, lessonId) =>
  (await getRecordingStore()).list(lessonId)
);
ipcMain.handle('recordings:count', async (_event, lesson) =>
  (await getRecordingStore()).countSentences(await lessonIdentity(lesson))
);
ipcMain.handle('recordings:save', async (_event, meta, bytes) =>
  (await getRecordingStore()).save(meta, bytes)
);
ipcMain.handle('recordings:read', async (_event, id) => (await getRecordingStore()).read(id));
ipcMain.handle('window:setFocusMode', (_event, isFocus) => {
  if (!mainWindow) return;
  if (platform === 'darwin') {
    mainWindow.setWindowButtonVisibility(!isFocus);
  }
});

// 外观: the renderer owns the preference; a copy here lets the next launch paint
// the right background before the page loads.
type ThemeSource = 'system' | 'light' | 'dark';
const themeSources: ThemeSource[] = ['system', 'light', 'dark'];
const appearanceFile = () => path.join(app.getPath('userData'), 'appearance.json');

function readThemeSource(): ThemeSource {
  try {
    const { theme } = JSON.parse(fs.readFileSync(appearanceFile(), 'utf8'));
    return themeSources.includes(theme) ? theme : 'system';
  } catch {
    return 'system';
  }
}

// Matches --bg-base in src/css/app.scss.
const windowBackground = () => (nativeTheme.shouldUseDarkColors ? '#1a1918' : '#ffffff');

ipcMain.handle('window:setTheme', (_event, source: unknown) => {
  if (!themeSources.includes(source as ThemeSource)) return;
  if (nativeTheme.themeSource === source) return;
  nativeTheme.themeSource = source as ThemeSource;
  try {
    fs.writeFileSync(appearanceFile(), JSON.stringify({ theme: source }));
  } catch {
    // Only the next launch's first frame depends on this copy.
  }
});

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  } else {
    mainWindow.maximize();
    return true;
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    icon: path.resolve(__dirname, 'icons/icon.png'), // tray icon
    title: 'EcoLingo',
    width: 1000,
    height: 600,
    minWidth: 600,
    minHeight: 520,
    show: false,
    ...(platform === 'darwin'
      ? {
          frame: true,
          titleBarStyle: 'hiddenInset',
        }
      : {
          frame: false,
        }),
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    thickFrame: true,
    useContentSize: true,
    backgroundColor: windowBackground(),
    webPreferences: {
      // Keep the audio-clock checks running while the lesson window is minimized.
      backgroundThrottling: false,
      webSecurity: false,
      sandbox: true,
      contextIsolation: true,
      // More info: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/electron-preload-script
      preload: path.resolve(__dirname, process.env.QUASAR_ELECTRON_PRELOAD as string),
    },
    autoHideMenuBar: true,
  });

  if (platform === 'win32') mainWindow.setMaximizable(true);

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized-change', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized-change', false);
  });

  mainWindow.loadURL(process.env.APP_URL as string);
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  if (process.env.DEBUGGING) {
    // if on DEV or Production with debug enabled
    mainWindow.webContents.openDevTools();
  } else {
    // we're on production; no access to devtools pls
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  mainWindow.on('closed', () => {
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
  app.whenReady().then(() => {
    nativeTheme.themeSource = readThemeSource();
    nativeTheme.on('updated', () => {
      mainWindow?.setBackgroundColor(windowBackground());
    });
    createWindow();
  });
}

app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

const isMac = process.platform === 'darwin';

const template: MenuItemConstructorOptions[] = [
  // { role: 'appMenu' }
  ...(isMac
    ? [
        {
          label: app.name,
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            { role: 'services' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { label: '退出', role: 'quit' as const },
          ],
        },
      ]
    : []),
  // { role: 'fileMenu' }
  {
    label: '文件',
    submenu: [
      isMac
        ? { label: '关闭窗口', role: 'close' as const }
        : { label: '退出', role: 'quit' as const },
      {
        label: '打开课程文件夹',
        click: () => {
          handleFolderOpen();
        },
      },
    ],
  },
  // { role: 'editMenu' }
  {
    label: '编辑',
    submenu: [
      { label: '撤销', role: 'undo' as const },
      { label: '重做', role: 'redo' as const },
      { type: 'separator' as const },
      { label: '剪切', role: 'cut' as const },
      { label: '复制', role: 'copy' as const },
      { label: '粘贴', role: 'paste' as const },
      ...(isMac
        ? [
            { role: 'pasteAndMatchStyle' as const },
            { label: '删除', role: 'delete' as const },
            { label: '全选', role: 'selectAll' as const },
            { type: 'separator' as const },
            {
              label: '朗读',
              submenu: [{ role: 'startSpeaking' as const }, { role: 'stopSpeaking' as const }],
            },
          ]
        : [
            { label: '删除', role: 'delete' as const },
            { type: 'separator' as const },
            { label: '全选', role: 'selectAll' as const },
          ]),
    ],
  },
  // { role: 'viewMenu' }
  {
    label: '视图',
    submenu: [
      { label: '重新加载', role: 'reload' as const },
      { label: '强制重新加载', role: 'forceReload' as const },
      { label: '开发者工具', role: 'toggleDevTools' as const },
      { type: 'separator' as const },
      { label: '实际大小', role: 'resetZoom' as const },
      { label: '放大', role: 'zoomIn' as const },
      { label: '缩小', role: 'zoomOut' as const },
      { type: 'separator' as const },
      { label: '切换全屏', role: 'togglefullscreen' as const },
    ],
  },
  // { role: 'windowMenu' }
  {
    label: '窗口',
    submenu: [
      { label: '最小化', role: 'minimize' as const },
      { label: '缩放窗口', role: 'zoom' as const },
      ...(isMac
        ? [
            { type: 'separator' as const },
            { role: 'front' as const },
            { type: 'separator' as const },
            { role: 'window' as const },
          ]
        : [{ label: '关闭窗口', role: 'close' as const }]),
    ],
  },
  {
    label: '帮助',
    role: 'help' as const,
    submenu: [
      {
        label: '键盘快捷键',
        click: async () => {
          if (mainWindow) {
            await dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '键盘快捷键',
              message:
                '空格：播放 / 暂停\nS：跟读开关\nA / D：上一句 / 下一句\nQ / E：上一课 / 下一课\nC / X：加速 / 减速\nZ：重置速度',
              buttons: ['关闭'],
            });
          }
        },
      },
    ],
  },
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
