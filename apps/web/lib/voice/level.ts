/**
 * Live microphone level for the meters: the voice range split into a few frequency bands, each
 * 0–1, so every bar moves on its own like an equaliser.
 */

/** `count + 1` log-spaced band edges in Hz across the voice range. */
export function bandEdges(count: number, low = 120, high = 4000): number[] {
  const bands = Math.max(1, Math.floor(count));
  const ratio = high / low;
  return Array.from({ length: bands + 1 }, (_, i) => low * ratio ** (i / bands));
}

/**
 * Average loudness (0–1) of each band, from an AnalyserNode's byte frequency data
 * (`frequencyBinCount` bins spread evenly from 0 Hz to half the sample rate).
 */
export function bandLevels(
  data: ArrayLike<number>,
  sampleRate: number,
  edges: readonly number[],
): number[] {
  const bins = data.length;
  if (!bins) return edges.slice(1).map(() => 0);
  const binHz = sampleRate / 2 / bins;
  const levels: number[] = [];
  for (let band = 0; band < edges.length - 1; band++) {
    const from = Math.min(bins - 1, Math.max(0, Math.floor(edges[band]! / binHz)));
    const to = Math.min(bins - 1, Math.max(from, Math.ceil(edges[band + 1]! / binHz) - 1));
    let sum = 0;
    for (let i = from; i <= to; i++) sum += data[i]!;
    levels.push(sum / (to - from + 1) / 255);
  }
  return levels;
}

export interface LevelWatch {
  stop: () => void;
}

type AudioContextCtor = typeof AudioContext;

/** Reports `bars` band levels on every animation frame until stopped. */
export function watchLevels(
  stream: MediaStream,
  bars: number,
  onLevels: (levels: number[]) => void,
): LevelWatch {
  const Ctx: AudioContextCtor | undefined =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctx || !stream.getAudioTracks().length) return { stop: () => {} };

  const context = new Ctx();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.6;
  analyser.minDecibels = -85;
  analyser.maxDecibels = -25;
  // Some engines only process nodes that reach the destination; a muted gain keeps it silent.
  const mute = context.createGain();
  mute.gain.value = 0;
  source.connect(analyser);
  analyser.connect(mute);
  mute.connect(context.destination);
  void context.resume().catch(() => {});

  const data = new Uint8Array(analyser.frequencyBinCount);
  const edges = bandEdges(bars);
  let frame = 0;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    analyser.getByteFrequencyData(data);
    onLevels(bandLevels(data, context.sampleRate, edges));
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(frame);
      source.disconnect();
      mute.disconnect();
      void context.close().catch(() => {});
    },
  };
}
