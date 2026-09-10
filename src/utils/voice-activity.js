// Local energy-based endpoint detection. Times are wall-clock milliseconds.
export function createVoiceActivityDetector(startedAt, options = {}) {
  // Short words can contain less than 400 ms of voiced audio. Require several
  // observed frames, enough to reject a click without discarding a brief word.
  const { silenceMs = 1200, speechMs = 120, waitMs = 8000, maxMs = 30000 } = options;
  let previous = startedAt;
  let lastVoice = startedAt;
  let voicedMs = 0;
  let noise = 0.002;
  let speaking = false;
  let heardSpeech = false;
  return (rms, now) => {
    // A delayed timer must not count unobserved audio as sustained speech.
    const elapsed = Math.min(Math.max(now - previous, 0), 60);
    previous = now;
    const threshold = Math.max(0.008, noise * (speaking ? 2 : 3));
    speaking = rms >= threshold;
    if (speaking) {
      voicedMs += elapsed;
      lastVoice = now;
      heardSpeech ||= voicedMs >= speechMs;
    } else {
      // Adapt only below the speech threshold so immediate speech is not
      // calibrated away. Never require the learner to wait before speaking.
      noise = noise * 0.95 + rms * 0.05;
      if (!heardSpeech && now - lastVoice > 200) voicedMs = 0;
    }
    let reason = null;
    if (now - startedAt >= maxMs) reason = heardSpeech ? 'limit' : 'no-speech';
    else if (heardSpeech && now - lastVoice >= silenceMs) reason = 'silence';
    else if (!heardSpeech && now - startedAt >= waitMs) reason = 'no-speech';
    return { reason, voiceActive: speaking, state: heardSpeech ? (speaking ? 'speaking' : 'silence') : 'waiting' };
  };
}

export function createVoiceMonitor(stream) {
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser); // No connection to speakers: never monitor the mic aloud.
  const samples = new Float32Array(analyser.fftSize);
  let timer = null;
  let generation = 0;
  function stop() {
    generation++;
    clearTimeout(timer);
    timer = null;
  }
  return {
    async ready() {
      await context.resume();
      if (context.state !== 'running') throw new Error('麦克风声音检测未能启动');
    },
    start(onUpdate, options = {}) {
      stop();
      const token = generation;
      const detect = createVoiceActivityDetector(performance.now(), options);
      function poll() {
        if (token !== generation) return;
        analyser.getFloatTimeDomainData(samples);
        let energy = 0;
        for (const value of samples) energy += value * value;
        const result = detect(Math.sqrt(energy / samples.length), performance.now());
        onUpdate(result);
        if (token === generation && !result.reason) timer = setTimeout(poll, 20);
      }
      timer = setTimeout(poll, 20);
    },
    stop,
    dispose() {
      stop();
      source.disconnect();
      analyser.disconnect();
      void context.close().catch(() => {});
    },
  };
}
