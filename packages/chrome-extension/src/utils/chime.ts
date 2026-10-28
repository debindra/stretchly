let ctx: AudioContext | null = null;

/**
 * A short, soft two-note chime. Used as an audio cue so exercises done with eyes
 * closed or head turned away from the screen can still be followed.
 * `kind` picks the interval: 'start' rises, 'change' is a single note, 'done' falls.
 */
export function chime(kind: 'start' | 'change' | 'done' = 'change'): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const notes = kind === 'start' ? [660, 880] : kind === 'done' ? [880, 660, 523] : [740];
    const t0 = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      const t = t0 + i * 0.16;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  } catch {
    // Audio unavailable (autoplay policy, no output device); cues are optional.
  }
}
