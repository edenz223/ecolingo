// Drives the built app (real main process, preload and IPC) with webSecurity and the CSP on:
// lesson files are only reachable after their folder is opened, and audio streams and seeks
// through the lesson-media scheme.
const { app, net } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { root, loadTs } = require('./helpers/load-ts.cjs');

const fixtures = path.join(root, 'tests/fixtures');
const lyricsPath = path.join(fixtures, '002 02.lrc');
const audioPath = path.join(fixtures, '002 02.mp3');
const { lessonMediaUrl } = loadTs('src/utils/lesson-media.ts', { URL });

// An existing folder, so the legacy userData fallback in electron-main never applies.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ecolingo-app-'));
app.setPath('userData', temp);
app.disableHardwareAcceleration();

const pageErrors = [];
app.on('browser-window-created', (_event, win) => {
  win.webContents.on('console-message', ({ level, message }) => {
    if (level === 'error' || /Content Security Policy|Electron Security Warning/i.test(message)) {
      pageErrors.push(message);
    }
  });
  win.webContents.once('did-finish-load', () => {
    run(win)
      .then(() => {
        console.log('PASS app: lesson access allowlist, lesson-media ranges and seeking, CSP');
        // Close right after a seek, with a range request in flight, like a user would;
        // electron-main must quit promptly (CI adds a timeout).
        return win.webContents
          .executeJavaScript(`document.querySelectorAll('.sentence-item')[20].click()`, true)
          .then(() => win.close());
      })
      .catch(error => {
        console.error(error);
        fs.rmSync(temp, { recursive: true, force: true });
        app.exit(1);
      });
  });
});
app.on('will-quit', () => fs.rmSync(temp, { recursive: true, force: true }));

// The built main process is an ES module.
import(pathToFileURL(path.join(root, 'dist/electron/UnPackaged/electron-main.js')).href);

async function run(win) {
  const evaluate = source => win.webContents.executeJavaScript(source, true);
  const outcome = call => evaluate(`${call}.then(() => 'allowed', () => 'refused')`);
  async function waitFor(condition, timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await evaluate(condition)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Timeout waiting for: ' + condition);
  }
  const forged = (audio, lyrics) =>
    JSON.stringify({ name: 'forged', audio: { path: path.dirname(audio), name: path.basename(audio) }, lyrics: { path: path.dirname(lyrics), name: path.basename(lyrics) } });

  assert.equal(win.webContents.getLastWebPreferences().webSecurity, true);
  await waitFor(`Boolean(document.querySelector('.lesson-empty button'))`);

  // Nothing is reachable before its folder is opened.
  assert.equal(await outcome(`window.fileAPI.readTextFile(${JSON.stringify(lyricsPath)})`), 'refused');
  assert.equal((await net.fetch(lessonMediaUrl(audioPath))).status, 404);

  assert.equal(await evaluate(`window.fileAPI.openFolderPath(${JSON.stringify(fixtures)})`), true);
  await waitFor(`Boolean(document.querySelector('.lesson-item'))`);
  // The next folder dialog starts here instead of Downloads.
  assert.equal(JSON.parse(fs.readFileSync(path.join(temp, 'last-folder.json'), 'utf8')).folder, fixtures);

  assert.match(await evaluate(`window.fileAPI.readTextFile(${JSON.stringify(lyricsPath)})`), /^\[00:06\.39\]/);
  for (const target of [path.join(root, 'package.json'), audioPath, path.join(fixtures, '..', 'app-smoke.cjs')]) {
    assert.equal(await outcome(`window.fileAPI.readTextFile(${JSON.stringify(target)})`), 'refused', target);
  }
  assert.equal(await outcome(`window.fileAPI.recordingIdentity(${forged(audioPath, lyricsPath)})`), 'allowed');
  assert.equal(await outcome(`window.fileAPI.recordingIdentity(${forged(path.join(root, 'package.json'), lyricsPath)})`), 'refused');
  assert.equal(await outcome(`window.fileAPI.recordingCount(${forged(audioPath, path.join(root, 'README.md'))})`), 'refused');

  const size = fs.statSync(audioPath).size;
  const part = await net.fetch(lessonMediaUrl(audioPath), { headers: { Range: 'bytes=100-199' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), `bytes 100-199/${size}`);
  assert.equal(part.headers.get('content-type'), 'audio/mpeg');
  assert.deepEqual(Buffer.from(await part.arrayBuffer()), fs.readFileSync(audioPath).subarray(100, 200));
  assert.equal((await net.fetch(lessonMediaUrl(lyricsPath))).status, 404);
  assert.equal((await net.fetch(lessonMediaUrl(path.join(root, 'package.json')))).status, 404);

  // The lesson plays and seeking far into the file holds (it needs range responses).
  await evaluate(`document.querySelector('.lesson-item').click()`);
  await waitFor(`Boolean(document.querySelector('[aria-label="暂停"]'))`);
  const item = `document.querySelectorAll('.sentence-item')[10]`;
  const start = Number(await evaluate(`${item}.querySelector('.q-item__label').id`));
  assert.equal(start, 38.4);
  await evaluate(`${item}.click()`);
  await waitFor(`${item}.classList.contains('sentence-item--active')`);
  await waitFor(`Howler._howls.at(-1)._sounds[0]._node.currentTime > ${start + 0.3}`);
  assert.equal(await evaluate(`${item}.classList.contains('sentence-item--active')`), true);
  assert.equal(await evaluate(`Boolean(document.querySelector('.q-dialog'))`), false);
  assert.equal(await evaluate(`Boolean(document.querySelector('[aria-label="暂停"]'))`), true);

  assert.deepEqual(pageErrors, []);
}
