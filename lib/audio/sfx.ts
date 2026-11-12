// Sound effects synthesised with the Web Audio API: no audio files to download, license or host.
export type Sfx = 'click' | 'complete' | 'coin' | 'levelup' | 'achievement' | 'boss' | 'error';
let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
function tone(c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.12) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination); o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
}
const NOTES: Record<Sfx, [number, number, number, OscillatorType?, number?][]> = {
  click: [[660, 0, 0.06, 'triangle', 0.06]],
  coin: [[988, 0, 0.08, 'square', 0.05], [1319, 0.07, 0.18, 'square', 0.05]],
  complete: [[523, 0, 0.12, 'triangle'], [659, 0.1, 0.12, 'triangle'], [784, 0.2, 0.28, 'triangle']],
  levelup: [[392, 0, 0.14, 'triangle'], [523, 0.12, 0.14, 'triangle'], [659, 0.24, 0.14, 'triangle'], [784, 0.36, 0.14, 'triangle'], [1047, 0.5, 0.55, 'sine', 0.16]],
  achievement: [[880, 0, 0.1, 'sine'], [1109, 0.1, 0.1, 'sine'], [1319, 0.2, 0.4, 'sine', 0.14]],
  boss: [[110, 0, 0.3, 'sawtooth', 0.09], [147, 0.25, 0.3, 'sawtooth', 0.09], [220, 0.5, 0.6, 'sawtooth', 0.1], [330, 0.55, 0.7, 'triangle', 0.1]],
  error: [[196, 0, 0.14, 'square', 0.05], [147, 0.12, 0.2, 'square', 0.05]],
};
export function playSfx(name: Sfx, enabled = true) {
  if (!enabled) return;
  try { const c = audio(); if (!c) return; for (const [f, s, d, t, v] of NOTES[name]) tone(c, f, s, d, t ?? 'sine', v ?? 0.12); } catch { /* audio is a nicety, never an error */ }
}
