// Run with Electron, not Node: exercises the real Chromium audio decoder.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert/strict');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecolingo-audio-'));
app.setPath('userData', root);
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
  try {
    await window.loadURL('data:text/html,<html><body>Audio regression</body></html>');
    const source = fs.readFileSync(path.join(__dirname, '../src/utils/recording-export.js'), 'utf8').replace('export async function', 'async function');
    const result = await window.webContents.executeJavaScript(`(async () => {
      ${source}
      function wav(rate, value) {
        const buffer = new ArrayBuffer(44 + rate * 2);
        const view = new DataView(buffer);
        const text = (at, word) => [...word].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
        text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true);
        text(8, 'WAVE'); text(12, 'fmt '); view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
        view.setUint16(32, 2, true); view.setUint16(34, 16, true);
        text(36, 'data'); view.setUint32(40, rate * 2, true);
        for (let at = 44; at < buffer.byteLength; at += 2) view.setInt16(at, value, true);
        return new Uint8Array(buffer);
      }
      const sources = [wav(16000, 8192), wav(48000, -8192)];
      const merged = await mergeRecordings([{id:0}, {id:1}], async (id) => ({bytes:sources[id]}));
      const decoder = new AudioContext();
      const audio = await decoder.decodeAudioData(merged);
      const samples = audio.getChannelData(0);
      const result = { duration: audio.duration, channels: audio.numberOfChannels,
        first: samples[Math.floor(audio.sampleRate / 2)], second: samples[Math.floor(audio.sampleRate * 1.5)] };
      await decoder.close();
      let rejected = false;
      try { await mergeRecordings([{id:0}], async () => ({bytes: new Uint8Array([1,2,3])})); }
      catch { rejected = true; }
      return {...result, rejected};
    })()`);
    assert.ok(Math.abs(result.duration - 2) < 0.01);
    assert.equal(result.channels, 1);
    assert.ok(result.first > 0.2 && result.second < -0.2);
    assert.equal(result.rejected, true);
    console.log('PASS Chromium WAV merge: mixed sample rates, duration, order, decode errors');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    window.destroy();
    app.exit(process.exitCode || 0);
  }
});
