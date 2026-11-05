// Synthesized sound effects (Web Audio API, no audio files). Silent unless enabled.

let enabled = false;
let ctx = null;
let master = null;
let reverb = null;
let noiseBuffer = null;
const lastPlayed = new Map();

// Synthetic impulse response: decaying noise, like an echo bouncing off buildings.
function createReverb() {
  const length = ctx.sampleRate * 2.5;
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  convolver.connect(wet).connect(master);
  return convolver;
}

function ensureContext() {
  if (!ctx) {
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) return null;
    ctx = new AudioContextClass();
    master = ctx.createGain();
    master.gain.value = 0.35;
    const limiter = ctx.createDynamicsCompressor();
    master.connect(limiter);
    limiter.connect(ctx.destination);
    reverb = createReverb();

    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Avoids saturating the output when dozens of rockets fire at once.
function ready(name, minInterval) {
  if (!enabled || !ensureContext()) return false;
  const now = ctx.currentTime;
  if (now - (lastPlayed.get(name) ?? -Infinity) < minInterval) return false;
  lastPlayed.set(name, now);
  return true;
}

function envelope(t, attack, duration, peak, echo = false) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  gain.connect(master);
  if (echo) gain.connect(reverb);
  return gain;
}

function noise({ duration, type, from, to, q = 1, peak, attack = 0.005, delay = 0, echo = false }) {
  const t = ctx.currentTime + delay;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + duration);
  source.connect(filter).connect(envelope(t, attack, duration, peak, echo));
  source.start(t, Math.random() * 0.5);
  source.stop(t + duration + 0.05);
}

function tone({ type = 'sine', from, to = from, duration, peak, attack = 0.01, delay = 0, echo = false }) {
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + duration);
  osc.connect(envelope(t, attack, duration, peak, echo));
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

export function setSoundEnabled(value) {
  enabled = value;
  if (enabled) ensureContext();
}

export function playLaunch() {
  if (!ready('launch', 0.08)) return;
  noise({ duration: 0.8, type: 'bandpass', from: 350, to: 2600, q: 3, peak: 0.12, attack: 0.35 });
}

export function playWhistle() {
  if (!ready('whistle', 0.25)) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(900, t);
  osc.frequency.exponentialRampToValueAtTime(2800, t + 1.1);
  const vibrato = ctx.createOscillator();
  const depth = ctx.createGain();
  vibrato.frequency.value = 9;
  depth.gain.value = 40;
  vibrato.connect(depth).connect(osc.frequency);
  osc.connect(envelope(t, 0.15, 1.2, 0.08, true));
  osc.start(t);
  vibrato.start(t);
  osc.stop(t + 1.25);
  vibrato.stop(t + 1.25);
}

/** Sharp, loud report (salute shells, stamp impact). */
export function playBang(intensity = 1) {
  if (!ready('bang', 0.12)) return;
  noise({ duration: 0.25, type: 'highpass', from: 1200, to: 400, peak: 0.9 * intensity, attack: 0.002, echo: true });
  noise({ duration: 1.6, type: 'lowpass', from: 3000, to: 50, q: 0.7, peak: 1 * intensity, echo: true });
  tone({ from: 140, to: 30, duration: 0.6, peak: 0.8 * intensity, attack: 0.002 });
}

export function playBoom(intensity = 1) {
  if (!ready('boom', 0.06)) return;
  noise({ duration: 1.4, type: 'lowpass', from: 2200, to: 60, q: 0.7, peak: 0.8 * intensity, echo: true });
  tone({ from: 110, to: 35, duration: 0.5, peak: 0.6 * intensity, attack: 0.005 });
}

export function playCrackle() {
  if (!ready('crackle', 0.2)) return;
  for (let i = 0; i < 16; i++) {
    noise({
      duration: 0.05,
      type: 'highpass',
      from: 3500,
      to: 6000,
      peak: 0.2,
      attack: 0.002,
      delay: 0.45 + Math.random() * 0.8,
    });
  }
}

/** Short confirmation jingle, also used as audio feedback when animations are off. */
export function playChime(grand = false) {
  if (!ready('chime', 0.1)) return;
  const notes = grand ? [523.25, 659.25, 783.99, 1046.5] : [783.99, 1174.66];
  notes.forEach((frequency, index) => {
    tone({ type: 'triangle', from: frequency, duration: 0.6, peak: 0.25, delay: index * 0.11 });
  });
}

export function playChainsaw() {
  if (!ready('chainsaw', 1)) return;
  const t = ctx.currentTime;
  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.setValueAtTime(55, t);
  saw.frequency.exponentialRampToValueAtTime(150, t + 0.5);
  saw.frequency.setValueAtTime(150, t + 1.2);
  saw.frequency.exponentialRampToValueAtTime(70, t + 1.8);
  saw.connect(envelope(t, 0.05, 1.8, 0.25));
  saw.start(t);
  saw.stop(t + 1.9);

  // Fast tremolo for the engine rattle.
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  lfo.frequency.value = 28;
  depth.gain.value = 25;
  lfo.connect(depth).connect(saw.frequency);
  lfo.start(t);
  lfo.stop(t + 1.9);
}
