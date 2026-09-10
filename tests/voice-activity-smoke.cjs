// Synthetic audio only; does not request the user's microphone.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'ecolingo-vad-')));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, webPreferences: {
    sandbox: true, contextIsolation: true, backgroundThrottling: false,
  } });
  try {
    await window.loadURL('data:text/html,<html><body>Voice activity regression</body></html>');
    const source = fs.readFileSync(path.join(__dirname, '../src/utils/voice-activity.js'), 'utf8')
      .replaceAll('export function', 'function');
    const result = await window.webContents.executeJavaScript(`(async () => {
      ${source}
      const audio = new AudioContext();
      await audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const destination = audio.createMediaStreamDestination();
      oscillator.connect(gain); gain.connect(destination);
      gain.gain.value = 0;
      oscillator.start();
      const monitor = createVoiceMonitor(destination.stream);
      await monitor.ready();
      const recorder = new MediaRecorder(destination.stream);
      const chunks = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
      recorder.start();
      const start = performance.now();
      // One second of speech, a short pause, another phrase, trailing silence.
      gain.gain.setValueAtTime(0.1, audio.currentTime + 0.3);
      gain.gain.setValueAtTime(0, audio.currentTime + 1.3);
      gain.gain.setValueAtTime(0.1, audio.currentTime + 1.9);
      gain.gain.setValueAtTime(0, audio.currentTime + 2.6);
      let updates = 0;
      const endpoint = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Detector did not finish')), 10000);
        monitor.start((result) => {
          updates++;
          if (result.reason) {
            clearTimeout(timeout);
            monitor.stop();
            resolve({ reason: result.reason, elapsed: performance.now() - start });
          }
        });
      });
      recorder.stop(); await stopped;
      const decoded = await audio.decodeAudioData(await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer());
      const before = updates;
      await new Promise((resolve) => setTimeout(resolve, 100));
      const stoppedCleanly = updates === before;
      gain.gain.cancelScheduledValues(audio.currentTime);
      gain.gain.setValueAtTime(0.1, audio.currentTime);
      const limitStart = performance.now();
      const limited = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Sentence limit did not finish')), 4000);
        monitor.start((result) => {
          if (result.reason) {
            clearTimeout(timeout);
            monitor.stop();
            resolve({ reason: result.reason, elapsed: performance.now() - limitStart });
          }
        }, { maxMs: 1000 });
      });
      // A brief word must survive real analyser polling and the sentence limit.
      gain.gain.setValueAtTime(0, audio.currentTime);
      await new Promise((resolve) => setTimeout(resolve, 100));
      gain.gain.setValueAtTime(0.1, audio.currentTime + 0.1);
      gain.gain.setValueAtTime(0, audio.currentTime + 0.34);
      const shortWord = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Short word did not finish')), 3000);
        monitor.start((result) => {
          if (result.reason) {
            clearTimeout(timeout);
            monitor.stop();
            resolve(result.reason);
          }
        }, { maxMs: 700 });
      });
      monitor.dispose(); oscillator.stop();
      destination.stream.getTracks().forEach((track) => track.stop());
      await audio.close();
      return { ...endpoint, duration: decoded.duration, stopped: stoppedCleanly, limited, shortWord };
    })()`);
    assert.equal(result.reason, 'silence');
    assert.ok(result.elapsed >= 3750 && result.elapsed < 6000, JSON.stringify(result));
    assert.ok(result.duration >= 3.7, JSON.stringify(result));
    assert.equal(result.stopped, true);
    assert.equal(result.limited.reason, 'limit');
    assert.equal(result.shortWord, 'limit');
    assert.ok(result.limited.elapsed >= 1000 && result.limited.elapsed < 2500, JSON.stringify(result));
    console.log('PASS Chromium VAD: speech, short pause, trailing silence, recorded audio decoding, timer cleanup', result);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    window.destroy();
    app.exit(process.exitCode || 0);
  }
});
