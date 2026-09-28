// A short local tone, played before the replacement recording starts.
export function playRecordingRestartCue() {
  let context: AudioContext | null = null;
  let oscillator: OscillatorNode | null = null;
  let settled = false;
  let complete: () => void = () => {};
  const finished = new Promise<void>(resolve => {
    complete = resolve;
  });
  const cancel = () => {
    if (settled) return;
    settled = true;
    if (oscillator) {
      oscillator.onended = null;
      oscillator.disconnect();
    }
    if (context) void context.close().catch(() => {});
    complete();
  };

  try {
    const audioContext = new AudioContext();
    context = audioContext;
    void audioContext
      .resume()
      .then(() => {
        if (settled) return;
        oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const now = audioContext.currentTime;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(660, now);
        oscillator.frequency.setValueAtTime(880, now + 0.09);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
        gain.gain.linearRampToValueAtTime(0, now + 0.18);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.onended = cancel;
        oscillator.start(now);
        oscillator.stop(now + 0.2);
      })
      .catch(cancel);
  } catch {
    cancel();
  }

  return { finished, cancel };
}
