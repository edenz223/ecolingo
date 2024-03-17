import { app, BrowserWindow, ipcMain, dialog, Menu } from "electron";
import fs from "fs";
import path from "path";
import os from "os";

/**
 * Asynchronously handles opening a folder dialog, retrieving files within selected folders, and returning a sorted array of file paths.
 *
 * @return {Array} Array of sorted file objects: [{ path: string, name: string }]
 */
async function handleFolderOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (!canceled && filePaths.length) {
    const files = (
      await Promise.all(
        filePaths.map(async (dir) => {
          const filesInDir = await fs.promises.readdir(dir, {
            withFileTypes: true,
          });
          const filesWithPath = filesInDir.filter((file) => file.isFile());
          return filesWithPath;
        })
      )
    )
      .flat()
      .sort((a, b) => a.name.localeCompare(b.name));

    // [
    //   {
    //     name: 'xxx',
    //     audio: xxx,
    //     lyrics: xxx
    //   }
    // ]
    let lessons = [];
    let names = [];
    for (const file of files) {
      let fileName = path.parse(file.name).name;
      if (names.indexOf(fileName) === -1) {
        let lesson = {
          name: fileName,
        };
        if (isAudioFile(file)) {
          lesson.audio = file;
        }
        if (isLyricsFile(file)) {
          lesson.lyrics = file;
        }
        names.push(fileName);
        lessons.push(lesson);
      } else {
        if (isAudioFile(file)) {
          lessons.filter((lesson) => lesson.name === fileName)[0].audio = file;
        }
        if (isLyricsFile(file)) {
          lessons.filter((lesson) => lesson.name === fileName)[0].lyrics = file;
        }
      }
    }

    mainWindow.webContents.send("open-folder", lessons);
  }
}

const isAudioFile = (file) => {
  return file.name.endsWith(".mp3");
};

const isLyricsFile = (file) => {
  return file.name.endsWith(".lrc");
};

const jschardet = require("jschardet");

async function readFile(event, filePath) {
  const content = fs.readFileSync(filePath);
  const encoding = await jschardet.detect(content, {
    detectEncodings: ["UTF-8", "Big5"],
  });
  return new TextDecoder(encoding.encoding).decode(content);
}

let mainWindow;
ipcMain.handle("dialog:openFile", handleFolderOpen);
ipcMain.handle("dialog:readFile", readFile);
ipcMain.handle("playMp3", (event, audioPath) => {
  mainWindow.loadFile(audioPath);
});
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
      sandbox: false,
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
        click: async () => {
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
