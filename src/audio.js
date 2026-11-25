// All sound is synthesised with WebAudio - no asset downloads, works offline.
export class Sfx {
  constructor() { this.ctx = null; this.muted = localStorage.getItem('alwd.muted') === '1'; this.windGain = null; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // looping wind, volume follows fall speed
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 500; this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    src.connect(this.windFilter).connect(this.windGain).connect(this.master);
    src.start();
  }
  setMuted(m) {
    this.muted = m;
    localStorage.setItem('alwd.muted', m ? '1' : '0');
    if (this.master) this.master.gain.value = m ? 0 : 0.7;
  }
  wind(speed) {
    if (!this.windGain) return;
    const t = this.ctx.currentTime, k = Math.min(1, speed / 22);
    this.windGain.gain.setTargetAtTime(k * k * 0.22, t, 0.1);
    this.windFilter.frequency.setTargetAtTime(350 + k * 900, t, 0.1);
  }
  tone(freq, dur, { type = 'sine', vol = 0.3, to = null, delay = 0, attack = 0.005 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, { vol = 0.3, freq = 1200, type = 'lowpass', q = 0.7, to = null, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noiseBuf; s.loop = true;
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  thud(k = 1) { this.tone(150 * (0.8 + Math.random() * 0.4), 0.16, { vol: 0.5 * k, to: 45 }); this.noise(0.09, { vol: 0.25 * k, freq: 900 }); }
  coin(step = 0) {
    const f = 880 * Math.pow(2, Math.min(step, 14) / 12);
    this.tone(f, 0.09, { type: 'square', vol: 0.08 });
    this.tone(f * 1.5, 0.22, { type: 'square', vol: 0.08, delay: 0.06 });
  }
  crash() { this.noise(0.4, { vol: 0.45, freq: 3500, to: 300 }); this.tone(220, 0.12, { type: 'triangle', vol: 0.2, to: 80 }); for (let i = 0; i < 4; i++) this.tone(300 + Math.random() * 500, 0.06, { type: 'triangle', vol: 0.1, delay: 0.03 + i * 0.04 }); }
  smash() { this.noise(0.25, { vol: 0.4, freq: 5000, type: 'highpass' }); for (let i = 0; i < 5; i++) this.tone(1500 + Math.random() * 2500, 0.07, { vol: 0.07, delay: i * 0.025 }); }
  poof() { this.noise(0.6, { vol: 0.5, freq: 900, to: 150 }); this.tone(90, 0.3, { vol: 0.4, to: 40 }); }
  rip() { this.noise(0.3, { vol: 0.35, freq: 800, to: 4000, type: 'bandpass', q: 2 }); }
  flutter() { for (let i = 0; i < 6; i++) this.noise(0.05, { vol: 0.2, freq: 2500, type: 'bandpass', q: 1.5, delay: i * 0.06 }); }
  ding() { this.tone(1320, 0.5, { vol: 0.16 }); this.tone(1980, 0.4, { vol: 0.08 }); }
  bleat() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), l = this.ctx.createOscillator(), lg = this.ctx.createGain(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(380, t + 0.55);
    l.frequency.value = 17; lg.gain.value = 45; l.connect(lg).connect(o.frequency);
    f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(f).connect(g).connect(this.master);
    o.start(t); l.start(t); o.stop(t + 0.65); l.stop(t + 0.65);
  }
  squawk() { this.tone(1400, 0.12, { type: 'sawtooth', vol: 0.14, to: 700 }); this.tone(1100, 0.16, { type: 'sawtooth', vol: 0.12, to: 500, delay: 0.12 }); }
  whoosh() { this.noise(0.5, { vol: 0.3, freq: 300, to: 2400, type: 'bandpass', q: 1 }); }
  jump() { this.tone(260, 0.2, { type: 'triangle', vol: 0.2, to: 620 }); }
  clear(n) { [0, 4, 7, 12].forEach((s, i) => this.tone(523 * Math.pow(2, (s + Math.min(n, 8)) / 12), 0.16, { type: 'triangle', vol: 0.2, delay: i * 0.055 })); this.whoosh(); }
  land() { this.tone(110, 0.3, { vol: 0.7, to: 35 }); this.noise(0.2, { vol: 0.4, freq: 600 }); }
  win(level) {
    const seq = level === 0 ? [0, -3, -7] : level === 1 ? [0, 4, 7, 12] : [0, 4, 7, 12, 16, 19, 24];
    seq.forEach((s, i) => this.tone((level === 0 ? 300 : 523) * Math.pow(2, s / 12), 0.28, { type: level === 0 ? 'sawtooth' : 'triangle', vol: level === 0 ? 0.1 : 0.22, delay: i * (level === 2 ? 0.08 : 0.11) }));
  }
  tick() { this.tone(700, 0.04, { type: 'square', vol: 0.05 }); }
}
