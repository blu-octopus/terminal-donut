// vapor-fx.js: sound bytes + haptics for vapor.css.
//
//   import { sfx, haptic } from './ui/vapor-fx.js';
//   sfx.play('start');     // 'click' | 'select' | 'tick' | 'start' | 'stop' | 'glitch'
//   haptic();              // a tiny tap on phones
//
// Everything is synthesized live with Web Audio: detuned saws through a soft
// low-pass and a dreamy echo, like a cheap 80s synth in a mall. No files.

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

let ctx = null;
let out = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = 0.16;
    out.connect(ctx.destination);

    // Echo: out → delay → low-pass → back into delay (feedback) and to speakers.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.27;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1400;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    out.connect(delay);
    delay.connect(tone);
    tone.connect(feedback);
    feedback.connect(delay);
    tone.connect(wet);
    wet.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// One synth voice: two slightly detuned oscillators, filtered, with a soft envelope.
function voice(freq, at, dur, { type = 'sawtooth', gain = 0.5, cutoff = 1800, glideTo = null } = {}) {
  const t = ctx.currentTime + at;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  filter.connect(amp);
  amp.connect(out);
  for (const cents of [-8, 8]) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    osc.detune.value = cents;
    osc.connect(filter);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

function noise(at, dur, gain = 0.3) {
  const t = ctx.currentTime + at;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const amp = ctx.createGain();
  amp.gain.value = gain;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2400;
  src.connect(band);
  band.connect(amp);
  amp.connect(out);
  src.start(t);
}

const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16];

const SOUNDS = {
  // tiny UI blip
  click: () => voice(midi(84), 0, 0.09, { type: 'square', gain: 0.18, cutoff: 3000 }),
  // a chord tone; pass a different index per option so each one sings its own note
  select: (i = 0) => {
    const root = 72 + PENTATONIC[i % PENTATONIC.length];
    voice(midi(root), 0, 0.5, { type: 'triangle', gain: 0.45, cutoff: 2600 });
    voice(midi(root + 7), 0.05, 0.45, { type: 'triangle', gain: 0.25, cutoff: 2600 });
  },
  // slider notch; value 0…1 sets the pitch
  tick: (value = 0.5) => voice(midi(60 + Math.round(value * 24)), 0, 0.05, { type: 'sine', gain: 0.35, cutoff: 4000 }),
  // dreamy rising Cmaj9 arpeggio
  start: () => [60, 64, 67, 71, 74, 79].forEach((n, i) => voice(midi(n), i * 0.06, 0.9, { gain: 0.3, cutoff: 1600 })),
  // and back down
  stop: () => [79, 74, 71, 67, 64].forEach((n, i) => voice(midi(n), i * 0.05, 0.5, { gain: 0.25, cutoff: 1100 })),
  // tape-stop zap with static
  glitch: () => {
    voice(midi(88), 0, 0.25, { type: 'square', gain: 0.25, cutoff: 3500, glideTo: midi(40) });
    noise(0, 0.16, 0.35);
  },
};

const STORAGE_KEY = 'vapor-fx:sound';

export const sfx = {
  enabled: (() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch {
      return true;
    }
  })(),
  setEnabled(on) {
    this.enabled = on;
    try {
      localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    } catch {}
  },
  play(name, arg) {
    if (!this.enabled || !SOUNDS[name] || !audio()) return;
    SOUNDS[name](arg);
  },
};

// Haptics. Android: the Vibration API. iPhone (iOS 18+): Safari has no
// Vibration API, but toggling a native switch input gives a system tap.
let iosSwitch = null;

export function haptic(ms = 10) {
  if (navigator.vibrate) {
    navigator.vibrate(ms);
    return;
  }
  if (!iosSwitch) {
    iosSwitch = document.createElement('label');
    iosSwitch.setAttribute('aria-hidden', 'true');
    iosSwitch.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;overflow:hidden';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    iosSwitch.append(input);
    document.body.append(iosSwitch);
  }
  iosSwitch.click();
}
