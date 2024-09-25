import { app, BrowserWindow, ipcMain, dialog, Menu } from "electron";
import fs from "fs";
import path from "path";
import os from "os";

async function handleFolderOpen() {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (result.canceled) {
    return [];
  }
  const folderPath = result.filePaths[0];
  const files = fs.readdirSync(folderPath, { withFileTypes: true });
  files
    .filter((file) => file.isFile())
    .sort((a, b) => a.name.localeCompare(b.name));

  const lessonMap = new Map();

  for (const file of files) {
    const fileName = path.parse(file.name).name;
    let lesson = lessonMap.get(fileName);

    if (!lesson) {
      lesson = { name: fileName };
      lessonMap.set(fileName, lesson);
    }

    if (isAudioFile(file)) {
      lesson.audio = file;
    } else if (isLyricsFile(file)) {
      lesson.lyrics = file;
    }
  }

  // Check if all lessons have both audio and lyrics
  const incompleteLessons = [];
  const completeLessons = [];
  for (const [name, lesson] of lessonMap) {
    if (!lesson.audio || !lesson.lyrics) {
      incompleteLessons.push(name);
    } else {
      completeLessons.push(lesson);
    }
  }

  if (incompleteLessons.length > 0) {
    const message = `The following lessons are missing audio or lyrics files and will be skipped: ${incompleteLessons.join(
      ", "
    )}`;
    dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "Incomplete Lessons",
      message: message,
      buttons: ["OK"],
    });
  }

  mainWindow.webContents.send("open-folder", completeLessons);
}

const isAudioFile = (file) => {
  return file.name.endsWith(".mp3");
};

const isLyricsFile = (file) => {
  return file.name.endsWith(".lrc");
};

const jschardet = require("jschardet");

function readTextFile(event, filePath) {
  const content = fs.readFileSync(filePath);
  const encoding = jschardet.detect(content, {
    // detectEncodings: ["UTF-8", "Big5"],
  });
  return new TextDecoder(encoding.encoding).decode(content);
}

let mainWindow;
ipcMain.handle("dialog:openFile", handleFolderOpen);
ipcMain.handle("readTextFile", readTextFile);

// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    icon: path.resolve(__dirname, "icons/icon.png"), // tray icon
    width: 1000,
    height: 600,
    useContentSize: true,
    webPreferences: {
      webSecurity: false,
      sandbox: true,
      contextIsolation: true,
      // More info: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/electron-preload-script
      preload: path.resolve(__dirname, process.env.QUASAR_ELECTRON_PRELOAD),
    },
  });

  mainWindow.loadURL(process.env.APP_URL);
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

app.whenReady().then(createWindow);

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
            { role: "quit" },
          ],
        },
      ]
    : []),
  // { role: 'fileMenu' }
  {
    label: "File",
    submenu: [
      isMac ? { role: "close" } : { role: "quit" },
      {
        label: "Open Folder",
        click: () => {
          handleFolderOpen();
        },
      },
    ],
  },
  // { role: 'editMenu' }
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      ...(isMac
        ? [
            { role: "pasteAndMatchStyle" },
            { role: "delete" },
            { role: "selectAll" },
            { type: "separator" },
            {
              label: "Speech",
              submenu: [{ role: "startSpeaking" }, { role: "stopSpeaking" }],
            },
          ]
        : [{ role: "delete" }, { type: "separator" }, { role: "selectAll" }]),
    ],
  },
  // { role: 'viewMenu' }
  {
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  },
  // { role: 'windowMenu' }
  {
    label: "Window",
    submenu: [
      { role: "minimize" },
      { role: "zoom" },
      ...(isMac
        ? [
            { type: "separator" },
            { role: "front" },
            { type: "separator" },
            { role: "window" },
          ]
        : [{ role: "close" }]),
    ],
  },
  {
    role: "help",
    submenu: [
      {
        label: "Learn More",
        click: async () => {
          const { shell } = require("electron");
          await shell.openExternal("https://electronjs.org");
        },
      },
    ],
  },
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
