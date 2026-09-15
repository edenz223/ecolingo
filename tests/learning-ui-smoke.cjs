// Built UI with sample lesson files and an isolated, read-only recording fixture.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ecolingo-ui-'));
app.setPath('userData', path.join(temp, 'profile'));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
const preload = path.join(temp, 'preload.cjs');
fs.writeFileSync(preload, `
  const { contextBridge } = require('electron');
  const fs = require('node:fs');
  const folder = ${JSON.stringify(path.join(root, 'resources'))};
  let selected;
  const lesson = { name: '002 02', audio: { path: folder, name: '002 02.mp3' }, lyrics: { path: folder, name: '002 02.lrc' } };
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
  const win = new BrowserWindow({ show: false, width: 1100, height: 800,
    frame: true, resizable: true, maximizable: true, thickFrame: true,
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#00000000', symbolColor: '#5c6b77', height: 34 },
    webPreferences: { preload, sandbox: false, contextIsolation: true, webSecurity: false, backgroundThrottling: false, offscreen: true } });
  win.webContents.setAudioMuted(true);
  const evaluate = (source) => win.webContents.executeJavaScript(source).catch(error => { throw new Error(source + ': ' + error.message); });
  async function waitFor(condition) {
    for (let count = 0; count < 100; count++) {
      if (await evaluate(condition)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('UI did not become ready: ' + condition);
  }
  try {
    await win.loadFile(path.join(root, 'dist/electron/UnPackaged/index.html'));
    await waitFor(`Boolean(document.querySelector('.lesson-empty button'))`);
    assert.equal(win.isMaximizable(), true);
    const initialWindowWidth = await evaluate(`window.innerWidth`);
    win.maximize();
    await waitFor(`window.innerWidth > ${initialWindowWidth}`);
    assert.equal(win.isMaximized(), true);
    win.unmaximize();
    await waitFor(`window.innerWidth === ${initialWindowWidth}`);
    assert.equal(await evaluate(`document.querySelector('.q-layout').classList.contains('windows-titlebar')`), true);
    assert.ok(Math.abs(await evaluate(`document.querySelector('.system-titlebar').getBoundingClientRect().height`) - 34) < 1);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.system-titlebar')).webkitAppRegion`), 'drag');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.system-titlebar button')).webkitAppRegion`), 'no-drag');
    assert.equal(await evaluate(`Boolean(document.querySelector('.glass-header [aria-label="显示或隐藏课程列表"]'))`), true);
    assert.equal(await evaluate(`Boolean(document.querySelector('.glass-footer [aria-label="显示或隐藏课程列表"]'))`), false);
    await evaluate(`document.querySelector('.glass-header [aria-label="显示或隐藏课程列表"]').click()`);
    await waitFor(`document.querySelector('.glass-header [aria-label="显示或隐藏课程列表"]').getAttribute('aria-expanded') === 'false'`);
    await evaluate(`document.querySelector('.glass-header [aria-label="显示或隐藏课程列表"]').click()`);
    await waitFor(`document.querySelector('.glass-header [aria-label="显示或隐藏课程列表"]').getAttribute('aria-expanded') === 'true'`);
    assert.equal(await evaluate(`document.querySelector('[aria-label="播放"]').disabled`), true);
    await evaluate(`document.querySelector('.lesson-empty button').click()`);
    await waitFor(`Boolean(document.querySelector('.lesson-item'))`);
    await evaluate(`document.querySelector('.lesson-item').click()`);
    await waitFor(`Boolean(document.querySelector('.sentence-item'))`);
    await waitFor(`Boolean(document.querySelector('[aria-label="暂停"]'))`);
    await evaluate(`document.querySelector('[aria-label="暂停"]').click()`);
    assert.match(await evaluate(`document.querySelector('.lesson-progress').textContent`), /002 02.*第.*句/s);
    assert.equal(await evaluate(`document.querySelector('[role="switch"]').getAttribute('aria-checked')`), 'false');
    assert.equal(await evaluate(`Boolean(document.querySelector('.q-toggle'))`), false);
    assert.equal(await evaluate(`(() => { const button = document.querySelector('[aria-label="播放"]'); const rect = button.getBoundingClientRect(); return rect.width === rect.height && getComputedStyle(button).borderRadius === '50%'; })()`), true);
    await evaluate(`document.querySelector('[aria-label="播放速度"]').click()`);
    await waitFor(`Boolean(document.querySelector('.q-menu'))`);
    await evaluate(`Array.from(document.querySelectorAll('.q-menu .q-item')).find(el => el.textContent.includes('1.25')).click()`);
    await waitFor(`document.querySelector('[aria-label="播放速度"]').textContent.includes('1.25')`);
    assert.equal(await evaluate(`Boolean(document.querySelector('[aria-label="音量"], [aria-label="静音"], [aria-label="取消静音"]'))`), false);
    await evaluate(`document.querySelector('.q-page').click()`);
    const scrollBefore = await evaluate(`document.querySelector('#sentences').scrollTop`);
    await evaluate(`
      document.querySelector('#sentences').scrollTop += 240;
      document.querySelector('#sentences').dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 50 }))`);
    await waitFor(`document.querySelector('#sentences').scrollTop > ${scrollBefore}`);
    await waitFor(`document.querySelector('.lesson-heading').textContent.includes('回到当前句')`);
    await evaluate(`document.querySelector('.lesson-heading .follow-btn').click()`);
    await waitFor(`!document.querySelector('.lesson-heading').textContent.includes('回到当前句')`);
    assert.equal(await evaluate(`document.querySelector('.q-toolbar').textContent.includes('录音记录') || document.querySelector('.q-toolbar').textContent.includes('更多')`), false);
    await waitFor(`Boolean(document.querySelector('[aria-label="播放此句最新录音"]'))`);
    await evaluate(`document.querySelector('[aria-label="播放此句最新录音"]').click()`);
    await waitFor(`Boolean(document.querySelector('[aria-label="停止回放"]'))`);
    await evaluate(`document.querySelector('[aria-label="停止回放"]').click()`);
    await waitFor(`Boolean(document.querySelector('[aria-label="播放此句最新录音"]'))`);
    await new Promise((resolve) => setTimeout(resolve, 350));
    await waitFor(`Boolean(document.querySelector('.sentence-item')) && !document.querySelector('.q-dialog')`);
    const screenshot = path.join(temp, 'learning-ui.png');
    fs.writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG());
    assert.equal(await evaluate(`document.querySelectorAll('[role="switch"]').length`), 1);
    await evaluate(`document.querySelector('[role="switch"]').click()`);
    await waitFor(`Boolean(document.querySelector('[aria-label="选择练习方式"]'))`);
    await evaluate(`document.querySelector('[aria-label="选择练习方式"]').click()`);
    await waitFor(`Boolean(document.querySelector('.practice-menu'))`);
    await evaluate(`Array.from(document.querySelectorAll('.practice-menu .q-item')).find(el => el.textContent.includes('先读再听')).click()`);
    await evaluate(`document.querySelector('[aria-label="专注显示"]').click()`);
    await waitFor(`Boolean(document.querySelector('.zen-current'))`);
    assert.equal(await evaluate(`document.querySelectorAll('[role="switch"]').length`), 1);
    assert.equal(await evaluate(`Boolean(document.querySelector('#sentences'))`), false);
    assert.equal(await evaluate(`Boolean(document.querySelector('.q-header'))`), false);
    assert.equal(await evaluate(`Boolean(document.querySelector('[aria-label="播放"]'))`), true);
    assert.equal(await evaluate(`document.querySelectorAll('.zen-neighbor[aria-hidden="true"]').length`), 2);
    await evaluate(`window.zenTestAudio = new AudioContext();
      navigator.mediaDevices.getUserMedia = async () => window.zenTestAudio.createMediaStreamDestination().stream;
      document.querySelector('[aria-label="播放"]').click()`);
    await waitFor(`Boolean(document.querySelector('.recording-mic--first'))`);
    assert.equal(await evaluate(`Boolean(document.querySelector('.first-attempt-label'))`), false);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.recording-mic--first'), '::before').borderTopStyle`), 'dashed');
    assert.match(await evaluate(`getComputedStyle(document.querySelector('.recording-mic--floating')).backgroundImage`), /linear-gradient/);
    await waitFor(`Number(getComputedStyle(document.querySelector('.floating-recording')).opacity) > 0.99`);
    await new Promise((resolve) => setTimeout(resolve, 80));
    const recordingMicSize = await evaluate(`(() => { const rect = document.querySelector('.recording-mic--floating').getBoundingClientRect(); return { width: rect.width, height: rect.height }; })()`);
    assert.ok(Math.abs(recordingMicSize.width - 60) < 0.01 && Math.abs(recordingMicSize.height - 60) < 0.01);
    fs.writeFileSync(path.join(temp, 'zen-first-attempt.png'), (await win.webContents.capturePage()).toPNG());
    win.setSize(640, 800);
    await waitFor(`window.innerWidth < 850`);
    // Allow Quasar drawer/footer transitions to settle after native resize.
    await new Promise((resolve) => setTimeout(resolve, 400));
    await waitFor(`(() => { const rect = document.querySelector('.sentence-navigation').getBoundingClientRect(); return Math.abs((rect.left + rect.right) / 2 - document.documentElement.clientWidth / 2) < 3; })()`);
    assert.ok(await evaluate(`(() => { const rect = document.querySelector('.sentence-navigation').getBoundingClientRect(); return Math.abs((rect.left + rect.right) / 2 - document.documentElement.clientWidth / 2) < 3; })()`));
    fs.writeFileSync(path.join(temp, 'practice-small.png'), (await win.webContents.capturePage()).toPNG());
    win.setSize(1100, 800);
    await waitFor(`window.innerWidth > 850`);
    await evaluate(`document.querySelector('[aria-label="选择练习方式"]').click()`);
    await waitFor(`Boolean(document.querySelector('.practice-menu'))`);
    await evaluate(`Array.from(document.querySelectorAll('.practice-menu .q-item')).find(el => el.textContent.includes('听读回听')).click()`);
    await waitFor(`!document.querySelector('.recording-mic--first')`);
    assert.equal(await evaluate(`Boolean(document.querySelector('[aria-label="播放"]'))`), true);
    assert.equal(JSON.parse(await evaluate(`localStorage.getItem('ecolingo.settings.v1')`)).zenFirstAttempt, false);
    await evaluate(`window.zenTestAudio.close()`);
    fs.writeFileSync(path.join(temp, 'zen-ui.png'), (await win.webContents.capturePage()).toPNG());
    await evaluate(`document.querySelector('[aria-label="下一句"]').click()`);
    assert.equal(await evaluate(`Boolean(document.querySelector('[aria-label="播放"]'))`), true);
    await evaluate(`document.querySelector('[aria-label="退出专注显示"]').click()`);
    await waitFor(`Boolean(document.querySelector('#sentences'))`);
    assert.equal(await evaluate(`document.querySelectorAll('[role="switch"]').length`), 1);
    await evaluate(`document.querySelector('[role="switch"]').click()`);
    await waitFor(`document.querySelectorAll('[role="switch"]').length === 1`);
    await evaluate(`document.querySelector('[aria-label="循环模式：顺序播放"]').click()`);
    await waitFor(`Array.from(document.querySelectorAll('.q-menu .q-item')).some(item => item.textContent.includes('单句循环'))`);
    await evaluate(`Array.from(document.querySelectorAll('.q-menu .q-item')).find(item => item.textContent.includes('单句循环')).click()`);
    for (const [label, id] of [['列表循环', 'list'], ['单句循环', 'one']]) {
      await waitFor(`!document.querySelector('.q-menu')`);
      await evaluate(`document.querySelector('[aria-label^="循环模式："]').click()`);
      await waitFor(`Boolean(document.querySelector('.q-menu .q-item'))`);
      await evaluate(`Array.from(document.querySelectorAll('.q-menu .q-item')).find(item => item.textContent.includes(${JSON.stringify(label)})).click()`);
      assert.equal(JSON.parse(await evaluate(`localStorage.getItem('ecolingo.settings.v1')`)).loopMode, id);
    }
    await waitFor(`!document.querySelector('.q-menu')`);
    await evaluate(`document.querySelector('[aria-label^="循环模式："]').click()`);
    await waitFor(`Boolean(document.querySelector('[aria-label="单句循环次数"]'))`);
    await evaluate(`(() => { const input = document.querySelector('[aria-label="单句循环次数"]'); input.click(); input.value = '4'; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    assert.equal(JSON.parse(await evaluate(`localStorage.getItem('ecolingo.settings.v1')`)).repeatCount, 4);
    await evaluate(`document.querySelector('[aria-label="单句循环次数"]').dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }))`);
    assert.equal(JSON.parse(await evaluate(`localStorage.getItem('ecolingo.settings.v1')`)).repeatCount, 5);
    await evaluate(`document.querySelector('[aria-label="单句循环次数"]').dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }))`);
    assert.equal(JSON.parse(await evaluate(`localStorage.getItem('ecolingo.settings.v1')`)).repeatCount, 4);
    const saved = JSON.parse(await evaluate(`localStorage.getItem('ecolingo.settings.v1')`));
    assert.equal(saved.playbackRate, 1.25);
    assert.equal(saved.loopMode, 'one');
    assert.equal('volume' in saved, false);
    assert.equal('muted' in saved, false);
    await win.loadFile(path.join(root, 'dist/electron/UnPackaged/index.html'));
    await waitFor(`Boolean(document.querySelector('.lesson-item'))`);
    assert.ok(await evaluate(`document.querySelector('[aria-label="播放速度"]').textContent.includes('1.25')`));
    assert.ok(await evaluate(`Boolean(document.querySelector('[aria-label="循环模式：单句循环4次"]'))`));
    assert.equal(JSON.parse(await evaluate(`localStorage.getItem('ecolingo.settings.v1')`)).zenFirstAttempt, false);
    await evaluate(`document.querySelector('.lesson-item').click()`);
    await waitFor(`Boolean(document.querySelector('.sentence-item'))`);
    await waitFor(`Boolean(document.querySelector('[aria-label="暂停"]'))`);
    await evaluate(`document.querySelector('[aria-label="暂停"]').click()`);
    assert.equal(await evaluate(`document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', bubbles: true, cancelable: true }))`), true);
    assert.equal('muted' in JSON.parse(await evaluate(`localStorage.getItem('ecolingo.settings.v1')`)), false);
    console.log('PASS settings survive reload: playback speed and repeat one');
    console.log('PASS learning UI: empty state, course progress, click menus, follow control, preview toggle');
    console.log('Screenshot: ' + screenshot);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.exit(process.exitCode || 0);
  }
});
