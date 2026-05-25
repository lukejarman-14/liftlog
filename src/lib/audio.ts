/**
 * Shared Web Audio helpers used by TestingBattery and ActiveWorkout.
 *
 * Uses pre-rendered PCM sine buffers rather than OscillatorNode because
 * OscillatorNode can be silently dropped on iOS Safari when the WKWebView
 * audio session is interrupted. Sine buffers play reliably at any time.
 */

/** Return (and lazily create) a shared AudioContext for the given ref. */
export function getAudioContext(
  ctxRef: React.MutableRefObject<AudioContext | null>,
): AudioContext | null {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctxRef.current) ctxRef.current = new AudioCtx();
    return ctxRef.current;
  } catch {
    return null;
  }
}

/**
 * Generate a sine-wave PCM buffer.
 * Applies an 8ms fade-in/out envelope to prevent audible clicks on iOS.
 */
export function makeSineBuffer(
  ctx: AudioContext,
  freq: number,
  durationSecs: number,
  volume: number,
): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(2, Math.ceil(durationSecs * sr));
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  const fadeSamples = Math.min(Math.floor(sr * 0.008), Math.floor(len * 0.15));
  for (let i = 0; i < len; i++) {
    const envelope =
      i < fadeSamples
        ? i / fadeSamples
        : i > len - fadeSamples
          ? (len - i) / fadeSamples
          : 1;
    data[i] = Math.sin(2 * Math.PI * freq * (i / sr)) * volume * envelope;
  }
  return buf;
}

/** Schedule playback of a pre-rendered buffer. Defaults to ctx.currentTime + 20ms. */
export function playAudioBuffer(
  ctx: AudioContext,
  buf: AudioBuffer,
  when?: number,
): void {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(when ?? ctx.currentTime + 0.02);
}
