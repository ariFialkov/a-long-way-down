// All sound is synthesised with WebAudio - no asset downloads, works offline.
// Three layers: the faller's voice (grunts/yelps), a distinct sound per object, and sparse scene
// ambience (birds on the cliff, city life by the buildings). There is deliberately no continuous bed.
const rr = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];

// voice presets: pitch [start, end] Hz, duration, vowel formants [F1, F2] start -> end
const GRUNTS = [
  { n: 'oof', f: [175, 105], d: 0.19, a: [450, 800], b: [330, 680] },
  { n: 'ugh', f: [150, 98], d: 0.21, a: [620, 1050], b: [480, 900] },
  { n: 'ow', f: [245, 150], d: 0.26, a: [780, 1250], b: [420, 780] },
  { n: 'ah', f: [265, 195], d: 0.15, a: [820, 1300], b: [760, 1200] },
  { n: 'eek', f: [390, 300], d: 0.12, a: [340, 2300], b: [320, 2100] },
  { n: 'hnn', f: [135, 118], d: 0.15, a: [300, 950], b: [280, 900] },
  { n: 'gah', f: [210, 120], d: 0.22, a: [700, 1150], b: [560, 950] },
  { n: 'oh', f: [200, 140], d: 0.2, a: [520, 880], b: [430, 760] },
];
const WHOA = [
  { f: [230, 150], d: 0.34, a: [420, 760], b: [640, 1050], peak: 330 },
  { f: [300, 210], d: 0.3, a: [360, 2100], b: [700, 1200], peak: 420 },
  { f: [200, 170], d: 0.28, a: [500, 850], b: [480, 820], peak: 250 },
];

export class Sfx {
  constructor() {
    this.ctx = null; this.muted = localStorage.getItem('alwd.muted') === '1';
    this.lastGrunt = -1; this.lastVoice = 0; this.scene = null; this.nextAmb = 0;
  }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.75;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.nextAmb = ctx.currentTime + 0.6;
  }
  setMuted(m) {
    this.muted = m;
    localStorage.setItem('alwd.muted', m ? '1' : '0');
    if (this.master) this.master.gain.value = m ? 0 : 0.75;
  }
  out(pan) {
    if (!pan || !this.ctx.createStereoPanner) return this.master;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan; p.connect(this.master);
    return p;
  }
  tone(freq, dur, { type = 'sine', vol = 0.3, to = null, delay = 0, attack = 0.005, pan = 0, lp = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (lp) { const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node = o.connect(f); }
    node.connect(g).connect(this.out(pan));
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, { vol = 0.3, freq = 1200, type = 'lowpass', q = 0.7, to = null, delay = 0, attack = 0, pan = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noiseBuf; s.loop = true;
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    if (attack) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); } else g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.out(pan));
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  // A cartoon voice: buzzy source through two gliding vowel formants.
  voice(p, { vol = 0.5, pitch = 1, delay = 0, stretch = 1 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay, d = p.d * stretch;
    const o = ctx.createOscillator(), env = ctx.createGain(), mix = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(p.f[0] * pitch, t);
    if (p.peak) o.frequency.linearRampToValueAtTime(p.peak * pitch, t + d * 0.3);
    o.frequency.exponentialRampToValueAtTime(p.f[1] * pitch, t + d);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 0.018);
    env.gain.setValueAtTime(1, t + d * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(env);
    [[p.a[0], p.b[0], 1], [p.a[1], p.b[1], 0.7], [2700, 2700, 0.18]].forEach(([f0, f1, g]) => {
      const bp = ctx.createBiquadFilter(), gg = ctx.createGain();
      bp.type = 'bandpass'; bp.Q.value = 6;
      bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + d);
      gg.gain.value = g;
      env.connect(bp).connect(gg).connect(mix);
    });
    mix.gain.value = vol * 2.2;
    mix.connect(this.master);
    o.start(t); o.stop(t + d + 0.03);
    this.noise(0.05, { vol: vol * 0.12, freq: 1800, type: 'bandpass', q: 1, delay }); // breathy onset
  }

  // ------------------------------------------------------------ the faller
  grunt(k = 1) { // k = impact strength 0..1
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastVoice < 0.16) return;
    this.lastVoice = now;
    let i;
    do i = (Math.random() * GRUNTS.length) | 0; while (i === this.lastGrunt);
    this.lastGrunt = i;
    this.voice(GRUNTS[i], { vol: 0.3 + k * 0.25, pitch: rr(0.9, 1.15) + k * 0.1 });
  }
  yelp() { if (!this.ctx) return; this.lastVoice = this.ctx.currentTime; this.voice(pick(WHOA), { vol: 0.42, pitch: rr(0.95, 1.15) }); }
  jump() { this.tone(260, 0.16, { type: 'triangle', vol: 0.12, to: 560 }); this.voice(WHOA[0], { vol: 0.45, stretch: 1.9, pitch: 1.1, delay: 0.08 }); }
  thud(k = 1) { this.tone(150 * rr(0.8, 1.2), 0.14, { vol: 0.42 * k, to: 45 }); this.noise(0.07, { vol: 0.2 * k, freq: 900 }); }
  land() {
    this.tone(105, 0.3, { vol: 0.7, to: 35 }); this.noise(0.2, { vol: 0.4, freq: 600 });
    this.voice({ f: [170, 82], d: 0.55, a: [470, 820], b: [330, 640] }, { vol: 0.55, delay: 0.03 });
    this.voice(GRUNTS[5], { vol: 0.3, pitch: 0.85, delay: 0.75, stretch: 1.6 });
  }

  // ------------------------------------------------------------ objects
  obj(kind) {
    if (!this.ctx) return;
    const f = this['o_' + kind];
    if (f) f.call(this);
  }
  o_rock() { this.tone(rr(700, 1000), 0.05, { type: 'triangle', vol: 0.25, to: 300 }); this.noise(0.12, { vol: 0.22, freq: 2400, type: 'bandpass', q: 1.2 }); for (let i = 0; i < 3; i++) this.tone(rr(900, 1800), 0.03, { type: 'triangle', vol: 0.07, delay: 0.08 + i * rr(0.04, 0.08) }); }
  o_boulder() { this.tone(90, 0.3, { vol: 0.5, to: 40 }); this.noise(0.3, { vol: 0.3, freq: 500 }); for (let i = 0; i < 4; i++) this.tone(rr(500, 1100), 0.04, { type: 'triangle', vol: 0.07, delay: 0.1 + i * 0.07 }); }
  o_log() { const f = rr(260, 340); this.tone(f, 0.16, { type: 'triangle', vol: 0.4, to: f * 0.75 }); this.tone(f * 2.4, 0.06, { type: 'sine', vol: 0.15 }); this.noise(0.03, { vol: 0.2, freq: 3000 }); }
  o_lamp() { const f = rr(1700, 2100); this.tone(f, 0.7, { vol: 0.14 }); this.tone(f * 1.51, 0.5, { vol: 0.07 }); this.tone(f * 2.76, 0.25, { vol: 0.05 }); this.noise(0.04, { vol: 0.15, freq: 6000, type: 'highpass' }); }
  o_sign() { const f = rr(520, 640); for (const [m, v, d] of [[1, 0.2, 0.6], [2.32, 0.12, 0.45], [3.9, 0.07, 0.3], [5.4, 0.04, 0.2]]) this.tone(f * m, d, { type: 'square', vol: v * 0.6, lp: 3500 }); this.noise(0.04, { vol: 0.2, freq: 4000, type: 'highpass' }); }
  o_dish() { const f = rr(300, 360); for (const [m, v, d] of [[1, 0.3, 1.1], [1.48, 0.16, 0.9], [2.67, 0.1, 0.6], [4.1, 0.05, 0.4]]) this.tone(f * m, d, { vol: v, to: f * m * 0.97 }); }
  o_ac() { this.tone(180, 0.12, { type: 'square', vol: 0.18, to: 90, lp: 1200 }); this.noise(0.1, { vol: 0.3, freq: 1500, type: 'bandpass', q: 2 }); for (let i = 0; i < 6; i++) this.noise(0.03, { vol: 0.13, freq: 2600, type: 'bandpass', q: 4, delay: 0.1 + i * 0.045 }); }
  o_flagpole() { this.tone(rr(180, 220), 0.5, { type: 'triangle', vol: 0.35, to: 420, attack: 0.01 }); this.tone(rr(900, 1100), 0.25, { vol: 0.08 }); }
  o_flowers() { for (let i = 0; i < 5; i++) this.noise(rr(0.08, 0.14), { vol: 0.16, freq: rr(3000, 6000), type: 'bandpass', q: 1, delay: i * 0.04, attack: 0.02 }); this.tone(1200, 0.15, { vol: 0.05, to: 1800 }); }
  o_pots() { this.noise(0.22, { vol: 0.4, freq: 4500, type: 'highpass' }); this.tone(420, 0.08, { type: 'triangle', vol: 0.25, to: 200 }); for (let i = 0; i < 7; i++) this.tone(rr(1400, 3800), 0.06, { vol: 0.07, delay: 0.02 + i * rr(0.02, 0.05) }); }
  o_hut() { this.noise(0.35, { vol: 0.42, freq: 3000, to: 300 }); for (let i = 0; i < 5; i++) this.tone(rr(240, 520), 0.07, { type: 'triangle', vol: 0.14, delay: i * 0.04 }); this.voice({ f: [620, 900], d: 0.28, a: [400, 2400], b: [350, 2600] }, { vol: 0.22, delay: 0.1 }); } // + indignant gnome
  o_goat() {
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(540, t); o.frequency.linearRampToValueAtTime(370, t + 0.6);
    l.frequency.value = 17; lg.gain.value = 48; l.connect(lg).connect(o.frequency);
    f.type = 'bandpass'; f.frequency.value = 1150; f.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    o.connect(f).connect(g).connect(this.master);
    o.start(t); l.start(t); o.stop(t + 0.7); l.stop(t + 0.7);
    this.tone(700, 0.05, { type: 'triangle', vol: 0.15, to: 300 });
  }
  o_pigeons() { for (let i = 0; i < 9; i++) this.noise(0.045, { vol: 0.22, freq: rr(1800, 3200), type: 'bandpass', q: 1.5, delay: i * 0.055, pan: rr(-0.6, 0.6) }); this.coo(0.14, 0.1); }
  o_bridge() { this.noise(0.3, { vol: 0.35, freq: 2500, to: 400 }); for (let i = 0; i < 9; i++) { const f = rr(220, 620); this.tone(f, 0.09, { type: 'triangle', vol: 0.2, to: f * 0.8, delay: i * rr(0.03, 0.06) }); } this.tone(140, 0.5, { type: 'sawtooth', vol: 0.12, to: 320, lp: 900 }); } // planks + rope twang
  o_clothesline() { this.tone(rr(300, 360), 0.45, { type: 'triangle', vol: 0.3, to: 150 }); for (let i = 0; i < 5; i++) this.noise(0.09, { vol: 0.17, freq: rr(700, 1400), type: 'bandpass', q: 0.8, delay: 0.05 + i * 0.08, attack: 0.02 }); }
  o_bunting() { this.tone(rr(480, 560), 0.3, { type: 'triangle', vol: 0.22, to: 260 }); for (let i = 0; i < 7; i++) this.noise(0.04, { vol: 0.15, freq: rr(3500, 6000), type: 'bandpass', q: 2, delay: i * 0.035 }); }
  o_awning() { this.noise(0.3, { vol: 0.32, freq: 700, to: 4500, type: 'bandpass', q: 2.5 }); this.tone(120, 0.35, { vol: 0.4, to: 230, attack: 0.02 }); this.tone(80, 0.15, { vol: 0.3, to: 50 }); }
  o_sugar() { this.noise(0.7, { vol: 0.5, freq: 1100, to: 140 }); this.tone(85, 0.3, { vol: 0.45, to: 38 }); this.noise(0.9, { vol: 0.1, freq: 7000, type: 'highpass', attack: 0.1 }); }
  o_bird() { this.tone(1500, 0.11, { type: 'sawtooth', vol: 0.13, to: 750, lp: 4000 }); this.tone(1200, 0.17, { type: 'sawtooth', vol: 0.12, to: 480, delay: 0.11, lp: 4000 }); for (let i = 0; i < 4; i++) this.noise(0.04, { vol: 0.14, freq: 2600, type: 'bandpass', q: 1.5, delay: 0.05 + i * 0.05 }); }

  // ------------------------------------------------------------ scene ambience (sparse one-shots)
  setScene(scene) { this.scene = scene; }
  coo(vol = 0.05, delay = 0, pan = 0) { [[0, 0.16, 430], [0.2, 0.3, 500], [0.55, 0.2, 420]].forEach(([d, len, f]) => this.tone(f, len, { vol, to: f * 0.92, delay: delay + d, attack: 0.04, pan })); }
  chirp(vol, pan, delay = 0) {
    const base = rr(2400, 4200), n = (rr(2, 6)) | 0, style = Math.random();
    for (let i = 0; i < n; i++) this.tone(base * rr(0.92, 1.08), rr(0.05, 0.1), { vol, to: base * (style < 0.5 ? 1.35 : 0.72), delay: delay + i * rr(0.09, 0.14), attack: 0.01, pan });
  }
  ambient() { // call every frame; fires an occasional sound that fits where the faller is
    if (!this.ctx || !this.scene || this.ctx.currentTime < this.nextAmb) return;
    this.nextAmb = this.ctx.currentTime + rr(0.9, 2.6);
    const pan = rr(-0.8, 0.8), r = Math.random();
    if (this.scene === 'cliff') {
      if (r < 0.5) this.chirp(rr(0.02, 0.045), pan);
      else if (r < 0.65) { this.chirp(0.03, pan); this.chirp(0.025, -pan, rr(0.4, 0.8)); }
      else if (r < 0.78) for (let i = 0; i < 14; i++) this.tone(4300, 0.025, { vol: 0.012, delay: i * 0.05, pan }); // cricket
      else if (r < 0.88) this.noise(1.8, { vol: 0.035, freq: 500, to: 900, type: 'bandpass', q: 0.8, attack: 0.8, pan }); // a breath of wind
      else if (r < 0.95) { this.tone(900, 0.35, { vol: 0.02, to: 1300, attack: 0.1, pan }); this.tone(1300, 0.5, { vol: 0.02, to: 800, delay: 0.35, attack: 0.05, pan }); } // far-off hawk
      else this.tone(440, 0.4, { type: 'sawtooth', vol: 0.012, to: 350, lp: 900, pan }); // distant goat
    } else {
      if (r < 0.2) this.coo(rr(0.03, 0.05), 0, pan);
      else if (r < 0.38) { const f = rr(380, 460); this.tone(f, 0.28, { type: 'square', vol: 0.018, lp: 1300, pan }); this.tone(f * 1.26, 0.28, { type: 'square', vol: 0.018, lp: 1300, pan }); if (Math.random() < 0.5) this.tone(f, 0.4, { type: 'square', vol: 0.018, lp: 1300, pan, delay: 0.38 }); } // car horn, streets away
      else if (r < 0.52) for (let i = 0; i < 2; i++) { this.tone(2300, 0.5, { vol: 0.025, delay: i * 0.16, pan }); this.tone(3450, 0.3, { vol: 0.012, delay: i * 0.16, pan }); } // bicycle bell
      else if (r < 0.66) for (let i = 0; i < (rr(2, 4) | 0); i++) { this.tone(420, 0.09, { type: 'sawtooth', vol: 0.03, to: 250, lp: 1100, delay: i * 0.24, pan }); this.noise(0.07, { vol: 0.02, freq: 900, type: 'bandpass', delay: i * 0.24, pan }); } // dog
      else if (r < 0.78) for (let i = 0; i < 6; i++) { this.tone(70, 0.14, { vol: 0.05, to: 45, delay: i * 0.3, pan }); if (i % 2) this.noise(0.05, { vol: 0.012, freq: 5000, type: 'highpass', delay: i * 0.3 + 0.15, pan }); } // someone's stereo through a wall
      else if (r < 0.88) this.noise(2.4, { vol: 0.03, freq: 250, to: 600, type: 'bandpass', q: 0.6, attack: 1.1, pan }); // car passing below
      else if (r < 0.95) { this.tone(660, 0.5, { vol: 0.02, pan }); this.tone(550, 0.7, { vol: 0.02, delay: 0.45, pan }); } // doorbell
      else this.chirp(0.025, pan);
    }
  }

  // ------------------------------------------------------------ UI / score
  coin(step = 0) {
    const f = 880 * Math.pow(2, Math.min(step, 14) / 12);
    this.tone(f, 0.09, { type: 'square', vol: 0.06, lp: 5000 });
    this.tone(f * 1.5, 0.22, { type: 'square', vol: 0.06, delay: 0.06, lp: 5000 });
  }
  clear(n) { [0, 4, 7, 12].forEach((s, i) => this.tone(523 * Math.pow(2, (s + Math.min(n, 8)) / 12), 0.16, { type: 'triangle', vol: 0.2, delay: i * 0.055 })); this.noise(0.35, { vol: 0.16, freq: 400, to: 2600, type: 'bandpass', q: 1 }); }
  win(level) {
    const seq = level === 0 ? [0, -3, -7] : level === 1 ? [0, 4, 7, 12] : [0, 4, 7, 12, 16, 19, 24];
    seq.forEach((s, i) => this.tone((level === 0 ? 300 : 523) * Math.pow(2, s / 12), 0.28, { type: level === 0 ? 'sawtooth' : 'triangle', vol: level === 0 ? 0.08 : 0.22, delay: i * (level === 2 ? 0.08 : 0.11), lp: level === 0 ? 1500 : 0 }));
  }
  tick() { this.tone(700, 0.04, { type: 'square', vol: 0.05 }); }
}
