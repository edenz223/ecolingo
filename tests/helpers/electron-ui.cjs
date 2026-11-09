// Runs the built UI offscreen with a fake fileAPI serving the sample lesson and a read-only recording.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { root, loadTs } = require('./load-ts.cjs');

const indexHtml = path.join(root, 'dist/electron/UnPackaged/index.html');
const fixtures = path.join(root, 'tests/fixtures');
const lessonMediaUrls = loadTs('src/utils/lesson-media.ts', { URL });
const lessonMedia = loadTs('src-electron/lesson-media.ts', {
  require: id => (id === '../src/utils/lesson-media' ? lessonMediaUrls : require(id)),
  Response,
  Buffer,
});

function runUiSmoke({ prefix, lessonName = '002 02', window = {}, switches = {} }, body) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  app.setPath('userData', path.join(temp, 'profile'));
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  for (const [name, value] of Object.entries(switches)) app.commandLine.appendSwitch(name, value);
  lessonMedia.registerLessonMediaScheme();
  const preload = path.join(temp, 'preload.cjs');
  fs.writeFileSync(preload, `
    const { contextBridge } = require('electron');
    const fs = require('node:fs');
    const folder = ${JSON.stringify(fixtures)};
    let selected;
    const lesson = { name: ${JSON.stringify(lessonName)}, audio: { path: folder, name: '002 02.mp3' }, lyrics: { path: folder, name: '002 02.lrc' } };
    contextBridge.exposeInMainWorld('fileAPI', {
      platform: 'win32',
      onFolderSelected(fn) { selected = fn; },
      openFolder() { selected({}, [lesson]); },
      recordingIdentity: async () => 'fixture',
      listRecordings: async () => [{ id: 'fixture-take', start: 6.39, text: 'Fixture', lessonName: lesson.name, createdAt: Date.now() }],
      readTextFile: async (file) => fs.readFileSync(file, 'utf8'),
      readRecording: async () => ({ bytes: fs.readFileSync(folder + '/002 02.mp3'), mime: 'audio/mpeg' }),
    });
  `);

  app.whenReady().then(async () => {
    lessonMedia.handleLessonMedia(filePath => {
      if (path.dirname(filePath) !== fixtures) throw new Error('Not a fixture lesson');
      return filePath;
    });
    const win = new BrowserWindow({
      show: false, width: 1100, height: 800, ...window,
      // Frameless with the app's own title bar, as electron-main creates it on Windows and Linux.
      frame: false, resizable: true, maximizable: true, thickFrame: true,
      webPreferences: { preload, sandbox: false, contextIsolation: true, backgroundThrottling: false, offscreen: true },
    });
    win.webContents.setAudioMuted(true);
    const evaluate = (source) => win.webContents.executeJavaScript(source).catch(error => { throw new Error(source + ': ' + error.message); });
    async function waitFor(condition, timeoutMs = 8000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (await evaluate(condition)) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error('Timeout waiting for: ' + condition);
    }
    const load = () => win.loadFile(indexHtml);
    try {
      await load();
      await waitFor(`Boolean(document.querySelector('.lesson-empty button'))`);
      await body({ win, temp, evaluate, waitFor, load });
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    } finally {
      // Exiting while the window is torn down abruptly can hang on an in-flight
      // lesson-media request; close it like the app does, then exit.
      win.once('closed', () => app.exit(process.exitCode || 0));
      win.close();
    }
  });
}

module.exports = { runUiSmoke };
