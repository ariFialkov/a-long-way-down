import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './ui.css';
import * as THREE from 'three';
import { CFG, PAL } from './config.js';
import { drawOutcome, RTP } from './outcome.js';
import { planRound, evalPath } from './planner.js';
import { World } from './world/world.js';
import { Ragdoll } from './ragdoll.js';
import { FX } from './fx.js';
import { Sfx } from './audio.js';

const $ = (s) => document.querySelector(s);
const ui = $('#ui'), canvas = $('#c');
const H = CFG.SECTION_H, Z0 = CFG.Z0;
const BETS = [1, 2, 5, 10, 25, 50, 100];
const money = (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const touch = matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);

// ------------------------------------------------------------------ renderer / scene
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
{
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2f9dff'); grad.addColorStop(0.55, '#7fd0ff'); grad.addColorStop(1, '#d6f4ff');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t;
}
const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
scene.add(new THREE.HemisphereLight(0xffffff, 0xffe2c4, 1.5));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.3);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(touch ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 26, bottom: -26, near: 1, far: 140 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const sfx = new Sfx();
const fx = new FX(scene, camera, $('#pops'));
const doll = new Ragdoll(scene);

// ------------------------------------------------------------------ game state
const G = {
  state: 'menu', balance: +(localStorage.getItem('alwd.balance') ?? 1000), betIdx: +(localStorage.getItem('alwd.bet') ?? 0),
  world: null, plan: null, biome: 'cliff', decorSeed: 1, t: 0, evIdx: 0, hint: 0, cur: 0, units: 0, shown: 0, combo: 0,
  timer: 0, acc: 0, shake: 0, lock: 0, clock: 0, pos: { x: 0, y: CFG.START_Y, vx: 0, vy: 0 },
};
if (!(G.balance >= 0)) G.balance = 1000;
G.betIdx = Math.max(0, Math.min(BETS.length - 1, G.betIdx | 0));
const bet = () => BETS[G.betIdx];
const save = () => { localStorage.setItem('alwd.balance', G.balance.toFixed(2)); localStorage.setItem('alwd.bet', G.betIdx); };
const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), tp: new THREE.Vector3(), tl: new THREE.Vector3(), snap: true };

function setState(s) { G.state = s; ui.className = 's-' + (s === 'crouch' || s === 'settle' ? 'play' : s); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2200); }
function refreshHud() {
  $('#bal b').textContent = money(G.balance);
  $('#bet b').textContent = money(bet());
  $('#betDown').disabled = G.betIdx === 0;
  $('#betUp').disabled = G.betIdx === BETS.length - 1 || BETS[G.betIdx + 1] > G.balance;
}
function setWin(units, bump) {
  const el = $('#win');
  el.querySelector('b').textContent = money((units * bet()) / 100);
  if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
}
function banner(text, sub) {
  const b = $('#banner');
  b.innerHTML = `${text}<small>${sub}</small>`;
  b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
}
function depthDots(n, on) { $('#depth').innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join(''); }
const muteIcon = (m) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/>${m ? '<path d="M17 9l5 6M22 9l-5 6"/>' : '<path d="M17 8.5a5 5 0 010 7M19.5 6a8.5 8.5 0 010 12"/>'}</svg>`;

function newMenu() {
  fx.clear();
  if (G.world) G.world.dispose();
  G.biome = params.get('biome') || (Math.random() < 0.5 ? 'cliff' : 'building');
  G.decorSeed = (Math.random() * 1e9) | 0;
  G.world = new World(scene, { plan: null, biome: G.biome, decorSeed: G.decorSeed, fx, sfx });
  G.plan = null; G.cur = 0; G.t = 0; G.units = 0;
  G.pos = { x: 0, y: CFG.START_Y, vx: 0, vy: 0 };
  doll.face('calm'); doll.heal();
  if (G.balance < BETS[0]) { G.balance = 1000; toast('Out of credits - here are 1,000 more'); }
  while (G.betIdx > 0 && bet() > G.balance) G.betIdx--;
  save(); refreshHud(); setWin(0);
  $('#prompt').textContent = `${touch ? 'Tap' : 'Click'} anywhere to place bet and play`;
  cam.snap = true;
  setState('menu');
}

function startRound() {
  if (bet() > G.balance) { toast('Not enough credits for that bet'); return; }
  sfx.unlock();
  G.balance -= bet();
  // The result is fixed here, before anything moves. Everything after this is choreography.
  let outcome = drawOutcome();
  if (import.meta.env.DEV && params.has('sections')) outcome = { sections: +params.get('sections'), units: +(params.get('units') ?? 100), seed: +(params.get('seed') ?? outcome.seed) };
  const t0 = performance.now();
  G.plan = planRound({ ...outcome, startBiome: G.biome });
  G.world.dispose();
  G.world = new World(scene, { plan: G.plan, biome: G.biome, decorSeed: G.decorSeed, fx, sfx });
  if (import.meta.env.DEV) console.info(`round built in ${(performance.now() - t0).toFixed(0)}ms`, outcome);
  G.t = 0; G.evIdx = 0; G.hint = 0; G.cur = 0; G.units = 0; G.combo = 0; G.timer = 0; G.acc = 0;
  save(); refreshHud(); setWin(0); depthDots(0, 0);
  setState('crouch');
  sfx.tick();
}

function scorePop(ev, big) {
  if (!ev.value) return;
  G.units += ev.value;
  setWin(G.units, true);
  const amt = (ev.value * bet()) / 100, ratio = ev.value / 100;
  fx.popup(ev.x, ev.y + 0.6, Z0 + 0.5, '+' + money(amt), big || ratio >= 0.5 ? 'l' : ratio >= 0.1 ? 'm' : '');
  sfx.coin(G.combo++);
}
function onEvent(ev) {
  const plan = G.plan;
  if (ev.type === 'hit' || ev.type === 'pass') {
    G.world.hit(ev);
    const k = Math.min(1, ev.speed / 18);
    if (ev.type === 'hit') {
      const spin = (ev.nx * ev.vy - ev.ny * ev.vx) * 0.55 + (Math.random() - 0.5) * 4;
      doll.kick(Math.max(-14, Math.min(14, spin)), 5);
      doll.jolt(ev.nx * 4, ev.ny * 4, 0.6);
      sfx.thud(0.4 + k * 0.4); sfx.grunt(k);
      G.shake = Math.max(G.shake, 0.12 + k * 0.2);
      fx.puff({ x: ev.x - ev.nx * 0.4, y: ev.y - ev.ny * 0.4, n: 3, color: 0xffffff, size: 0.22, life: 0.35 });
      // gore: spray, a stain where he connected, and another bruise for the collection
      const cx = ev.x - ev.nx * 0.42, cy = ev.y - ev.ny * 0.42, flat = ev.obj.mode === 'plat';
      fx.blood(cx, cy, k, ev.vx, ev.vy);
      if (flat || k > 0.35) fx.stain(cx, flat ? ev.y - 0.44 : cy, Z0 + (flat ? 0 : 0.15), 0.1 + k * 0.14, flat);
      doll.hurt(k);
    } else {
      doll.kick((Math.random() - 0.5) * 10, 6);
      if (Math.random() < 0.6) sfx.yelp();
      fx.blood(ev.x, ev.y, k * 0.5, ev.vx, ev.vy); doll.hurt(k * 0.4);
      G.shake = Math.max(G.shake, 0.2);
    }
    scorePop(ev);
  } else if (ev.type === 'clear') {
    G.cur = ev.sec + 1;
    const next = G.cur + 1;
    setTimeout(() => G.plan === plan && G.world.ensure(next), 60);
    scorePop(ev, true);
    banner(`${G.cur + 1 >= 4 ? 'DEEPER!' : 'THROUGH!'}`, `LEVEL ${G.cur + 1}`);
    depthDots(G.cur, G.cur);
    sfx.clear(G.cur);
  } else if (ev.type === 'land') {
    G.world.hit(ev);
    doll.kick((Math.random() - 0.5) * 8, 8); doll.jolt(0, 5, 0.8); doll.face('dizzy');
    sfx.land();
    G.shake = 0.6;
    fx.blood(ev.x, ev.y - 0.3, 1, ev.vx, 0); doll.hurt(1);
    for (let i = 0; i < 3; i++) fx.stain(ev.x + (Math.random() - 0.5) * 0.9, ev.y - 0.44, Z0 + (Math.random() - 0.5) * 0.8, 0.22 + Math.random() * 0.2, true);
    fx.puff({ x: ev.x, y: ev.y - 0.35, n: 12, color: 0xffffff, size: 0.45, speed: 5, rise: 0.4 });
    fx.burst({ x: ev.x, y: ev.y - 0.3, n: 10, colors: [0xffffff, 0xffe9a8], speed: 6, size: [0.05, 0.12], life: 0.6 });
  } else if (ev.type === 'land2') {
    sfx.thud(0.35); G.shake = Math.max(G.shake, 0.15);
    fx.blood(ev.x, ev.y - 0.3, 0.3); fx.stain(ev.x, ev.y - 0.44, Z0, 0.2, true);
    fx.puff({ x: ev.x, y: ev.y - 0.35, n: 4, color: 0xffffff, size: 0.3 });
  } else if (ev.type === 'stop') {
    setState('settle'); G.timer = 0;
    fx.stain(ev.x, ev.y - 0.24, Z0 + 0.1, 0.5, true); // the pool he comes to rest in
  }
}

function showResult() {
  const plan = G.plan, win = (plan.units * bet()) / 100, mult = plan.units / 100;
  G.balance += win; save(); refreshHud();
  const r = $('#result'), level = mult === 0 ? 0 : mult >= 5 ? 2 : 1;
  r.className = mult === 0 ? 'zero' : mult >= 5 ? 'big' : '';
  r.querySelector('h2').textContent = mult === 0 ? 'SPLAT!' : mult >= 20 ? 'MEGA WIN!' : mult >= 5 ? 'BIG WIN!' : mult >= 1 ? 'NICE FALL!' : 'YOU WON';
  r.querySelector('.mult').textContent = `${mult.toFixed(2)}x  ·  ${plan.N} level${plan.N > 1 ? 's' : ''}`;
  r.querySelector('p').textContent = `${touch ? 'Tap' : 'Click'} to continue`;
  const amt = r.querySelector('.amt'), t0 = performance.now(), dur = level === 2 ? 1400 : 650;
  const tick = () => { const u = Math.min(1, (performance.now() - t0) / dur); amt.textContent = money(win * (1 - (1 - u) ** 3)); if (u < 1 && G.state === 'result') requestAnimationFrame(tick); else amt.textContent = money(win); };
  tick();
  sfx.win(level);
  if (level === 2) for (let i = 0; i < 5; i++) setTimeout(() => G.state === 'result' && fx.burst({ x: G.pos.x + (Math.random() - 0.5) * 8, y: G.pos.y + 4 + Math.random() * 3, z: 3, n: 30, colors: PAL.cloth, flat: true, speed: 8, up: 4, g: 0.25, drag: 1.5, life: 2.4, size: [0.12, 0.24] }), i * 220);
  G.lock = 0.55;
  setState('result');
}

function action() {
  if (G.state === 'menu') startRound();
  else if (G.state === 'result' && G.lock <= 0) {
    G.lock = 9; sfx.tick();
    $('#fade').classList.add('on');
    setTimeout(() => { newMenu(); requestAnimationFrame(() => $('#fade').classList.remove('on')); }, 230);
  }
}

// ------------------------------------------------------------------ input
ui.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) action(); });
addEventListener('keydown', (e) => { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && !e.target.closest?.('button')) { e.preventDefault(); action(); } });
const stepBet = (d) => { const n = G.betIdx + d; if (n < 0 || n >= BETS.length || BETS[n] > G.balance) return; G.betIdx = n; sfx.unlock(); sfx.tick(); save(); refreshHud(); };
$('#betDown').addEventListener('click', () => stepBet(-1));
$('#betUp').addEventListener('click', () => stepBet(1));
$('#mute').addEventListener('click', () => { sfx.unlock(); sfx.setMuted(!sfx.muted); $('#mute').innerHTML = muteIcon(sfx.muted); });
$('#mute').innerHTML = muteIcon(sfx.muted);
addEventListener('contextmenu', (e) => e.preventDefault());

// ------------------------------------------------------------------ camera
function fitDistance() {
  const tanH = Math.tan((camera.fov * Math.PI) / 360);
  return Math.max((H + 2.5) / 2 / tanH, 15.5 / 2 / (tanH * camera.aspect));
}
function updateCamera(dt) {
  const d = fitDistance(), p = G.pos;
  if (G.state === 'menu' || G.state === 'crouch') {
    const tanH = Math.tan((camera.fov * Math.PI) / 360), dm = Math.max(11.5, 2.6 / (tanH * camera.aspect));
    cam.tl.set(0, 1.5 + dm * 0.05, 1.0);
    cam.tp.set(0.26 * dm + Math.sin(G.clock * 0.25) * 0.5, 2.0 + dm * 0.13, 1.0 + dm);
  } else if (G.state === 'play') {
    // Frame the current section. Tall screens see all of it; on wide screens we move in closer and
    // track the faller, but never look past the section's own floor until they drop through it.
    const tanH = Math.tan((camera.fov * Math.PI) / 360), dp = Math.max(15.5 / 2 / (tanH * camera.aspect), d * 0.6);
    const vh = dp * tanH, top = -G.cur * H + 1.5 - vh, bot = -(G.cur + 1) * H - 1.6 + vh;
    const cy = top < bot ? (top + bot) / 2 : Math.max(bot, Math.min(top, p.y - 2.5 + p.vy * 0.08));
    cam.tl.set(p.x * 0.3, cy, 0.8);
    cam.tp.set(p.x * 0.5, cy + 2, dp + 0.8);
  } else {
    const k = G.state === 'result' ? 0.36 : 0.5;
    cam.tl.set(p.x, p.y + (G.state === 'result' ? 1.6 : 0.6), Z0);
    cam.tp.set(p.x + 1.5, p.y + 3.2, Z0 + d * k);
  }
  const a = cam.snap ? 1 : 1 - Math.exp(-(G.state === 'play' ? 6.5 : 3.2) * dt);
  cam.pos.lerp(cam.tp, a); cam.look.lerp(cam.tl, a);
  cam.snap = false;
  G.shake = Math.max(0, G.shake - dt * 1.8);
  const s = G.shake * G.shake * 1.6;
  camera.position.set(cam.pos.x + (Math.random() - 0.5) * s, cam.pos.y + (Math.random() - 0.5) * s, cam.pos.z);
  camera.lookAt(cam.look);
  sun.target.position.set(cam.look.x * 0.5, cam.look.y, 0);
  sun.position.set(sun.target.position.x - 20, cam.look.y + 30, 44);
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ------------------------------------------------------------------ main loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.clock += dt;
  if (G.lock > 0 && G.lock < 5) G.lock -= dt;

  if (G.state === 'menu') {
    doll.setPose(0, 0, Z0, G.clock, 0);
  } else if (G.state === 'crouch') {
    G.timer += dt;
    const u = Math.min(1, G.timer / 0.3);
    doll.setPose(0, 0, Z0, G.clock, Math.sin(u * Math.PI * 0.5));
    if (u >= 1) {
      const s = G.plan.segs[0];
      doll.setPose(0, 0, Z0, G.clock, 0.4);
      doll.release(s.vx, s.vy);
      doll.kick(-G.plan.dir * 3.5, 2);
      doll.face('scream');
      G.world.tJump = G.world.T;
      sfx.jump();
      setState('play');
      depthDots(0, 0);
    }
  } else if (G.state === 'play' || G.state === 'settle' || G.state === 'result') {
    G.acc += dt;
    const h = doll.h, ev = G.plan.events;
    while (G.acc >= h) {
      G.acc -= h; G.t += h;
      while (G.evIdx < ev.length && ev[G.evIdx].t <= G.t) onEvent(ev[G.evIdx++]);
      const p = evalPath(G.plan, G.t, G.hint);
      G.hint = p.i; G.pos = p;
      const speed = Math.hypot(p.vx, p.vy);
      doll.step(p.x, p.y, G.world.solids(G.cur), G.state === 'play' && speed > 5 ? 0.55 : 0);
    }
    doll.sync();
    if (G.state === 'settle') { G.timer += dt; if (G.timer > 0.9) showResult(); }
  }
  updateCamera(dt);
  sfx.setScene(G.plan ? G.plan.biomes[G.cur] : G.biome);
  sfx.ambient();
  G.world.update(dt, G.cur, cam.pos.y, G.state === 'menu' || G.state === 'crouch' ? 1e3 : cam.pos.z * Math.tan((camera.fov * Math.PI) / 360) + 4);
  fx.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

newMenu();
document.fonts?.ready.then(() => {});
requestAnimationFrame(frame);
if (import.meta.env.DEV) { window.G = G; window.R = renderer; window.SFX = sfx; console.log(`RTP ${(RTP * 100).toFixed(2)}%`); }
