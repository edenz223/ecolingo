// Decode clips individually: concatenating MediaRecorder containers produces
// invalid audio. Render to one sample rate, then write a standard PCM WAV.
export async function mergeRecordings(clips, readRecording) {
  const sampleRate = 24000;
  const decoder = new AudioContext({ sampleRate });
  try {
    const segments = [];
    let frames = 0;
    for (const clip of clips) {
      const { bytes } = await readRecording(clip.id);
      const source = await decoder.decodeAudioData(new Uint8Array(bytes).buffer);
      const length = Math.ceil(source.duration * sampleRate);
      frames += length;
      if (frames > sampleRate * 60 * 30) throw new Error('合并录音最长支持 30 分钟。');
      const renderer = new OfflineAudioContext(1, length, sampleRate);
      const node = renderer.createBufferSource();
      node.buffer = source;
      node.connect(renderer.destination);
      node.start();
      segments.push((await renderer.startRendering()).getChannelData(0));
    }
    const buffer = new ArrayBuffer(44 + frames * 2);
    const view = new DataView(buffer);
    const text = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    text(0, 'RIFF');
    view.setUint32(4, buffer.byteLength - 8, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, 'data');
    view.setUint32(40, frames * 2, true);
    let offset = 44;
    for (const segment of segments) {
      for (const value of segment) {
        const sample = Math.max(-1, Math.min(1, value));
        view.setInt16(offset, sample * (sample < 0 ? 32768 : 32767), true);
        offset += 2;
      }
    }
    return buffer;
  } finally { await decoder.close(); }
}
