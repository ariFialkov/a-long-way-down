// The neighbours. Each one is a tiny rig (body, two shoulder-pivoted arms, optional props) busy with
// a household chore or a hobby. Used behind lit windows and, flattened and tinted, as silhouettes on blinds.
import * as THREE from 'three';
import { Batch } from './batch.js';
import { PAL } from '../config.js';

const HP = Math.PI / 2;
const WOOD = 0xb9814f, STEEL = 0x9aa3b5, DARK = 0x3d4560;

// Every activity: optional extra geometry for body / right arm / left arm / static props / one
// animated extra, whether props stand beside the person (so we shift them over), and the animation.
// In arm space the shoulder is the origin and the hand is at (0, -H, 0). R = rig, u = time.
const ACTS = {
  vacuum: {
    right: (b, s, H) => { b.box(0.05 * s, 0.62 * s, 0.05 * s, STEEL, 0, -H - 0.3 * s, 0); b.box(0.42 * s, 0.1 * s, 0.24 * s, 0xff5d5d, 0, -H - 0.62 * s, 0); b.cyl(0.09 * s, 0.22 * s, 0xff5d5d, 0, -H - 0.12 * s, 0); },
    anim(R, u) { const p = Math.sin(u * 2.3); R.armR.rotation.set(-0.3, 0, 0.5 + 0.28 * p); R.armL.rotation.set(-0.3, 0, 0.3 + 0.2 * p); R.g.position.x = R.x0 + 0.22 * p * R.flip; R.g.rotation.z = -0.07 * p * R.flip; },
  },
  sweep: {
    right: (b, s, H) => { b.box(0.045 * s, 1.15 * s, 0.045 * s, WOOD, 0, -H - 0.22 * s, 0); b.box(0.3 * s, 0.22 * s, 0.1 * s, 0xe8c66a, 0, -H - 0.86 * s, 0); },
    anim(R, u) { const p = Math.sin(u * 3); R.armR.rotation.set(-0.2, 0, 0.28 + 0.36 * p); R.armL.rotation.set(-0.3, 0, 0.55 + 0.3 * p); R.g.rotation.z = -0.05 * p * R.flip; R.g.position.x = R.x0 + Math.sin(u * 0.5) * 0.25; },
  },
  iron: {
    side: true,
    stat: (b, s, rng) => { b.box(1.0 * s, 0.06 * s, 0.34 * s, 0xdfe8f5, 0.72 * s, 0.6 * s, 0.1 * s); b.box(0.05 * s, 0.72 * s, 0.05 * s, STEEL, 0.6 * s, 0.3 * s, 0.1 * s, 0, 0, 0.45); b.box(0.05 * s, 0.72 * s, 0.05 * s, STEEL, 0.84 * s, 0.3 * s, 0.1 * s, 0, 0, -0.45); b.box(0.55 * s, 0.03 * s, 0.3 * s, rng.pick(PAL.cloth), 0.8 * s, 0.645 * s, 0.1 * s); },
    right: (b, s, H) => { b.box(0.24 * s, 0.09 * s, 0.14 * s, STEEL, 0, -H - 0.06 * s, 0, 0, 0, HP); b.box(0.16 * s, 0.04 * s, 0.05 * s, DARK, 0.07 * s, -H - 0.02 * s, 0, 0, 0, HP); },
    anim(R, u) { const p = Math.sin(u * 2.6); R.armR.rotation.set(-0.2, 0, 0.95 + 0.33 * p); R.armL.rotation.set(-0.15, 0, 0.5); R.g.rotation.z = -0.04 - 0.03 * p; },
  },
  cook: {
    side: true,
    body: (b, s) => { b.cyl(0.17 * s, 0.14 * s, 0xffffff, 0, 1.45 * s, 0); b.sph(0.21 * s, 0xffffff, 0, 1.56 * s, 0, 1, 0.7, 1); },
    stat: (b, s, rng) => { b.box(0.8 * s, 0.72 * s, 0.4 * s, 0xf4f6fb, 0.82 * s, 0.36 * s, 0); b.box(0.82 * s, 0.05 * s, 0.42 * s, DARK, 0.82 * s, 0.74 * s, 0); b.cyl(0.19 * s, 0.2 * s, rng.pick([0xff5d5d, 0x4ecdc4, STEEL]), 0.8 * s, 0.86 * s, 0.05 * s); b.box(0.2 * s, 0.04 * s, 0.05 * s, DARK, 1.05 * s, 0.9 * s, 0.05 * s); },
    extra: (b, s) => { for (let i = 0; i < 3; i++) b.sph((0.06 + i * 0.025) * s, 0xffffff, (0.8 + (i - 1) * 0.06) * s, (1.05 + i * 0.13) * s, 0.05 * s); },
    right: (b, s, H) => { b.box(0.035 * s, 0.34 * s, 0.035 * s, WOOD, 0, -H - 0.12 * s, 0); },
    anim(R, u) { R.armR.rotation.set(-0.15 + 0.16 * Math.cos(u * 5), 0, 1.02 + 0.1 * Math.sin(u * 5)); R.armL.rotation.set(0, 0, -0.25); const k = (u * 0.5) % 1; R.extra.position.y = k * 0.25 * R.s; R.extra.scale.setScalar(0.7 + k * 0.6); R.g.rotation.z = Math.sin(u * 1.2) * 0.02; },
  },
  water: {
    side: true,
    stat: (b, s, rng) => { b.box(0.34 * s, 0.5 * s, 0.3 * s, WOOD, 0.9 * s, 0.25 * s, 0); b.cyl(0.17 * s, 0.24 * s, 0xd9774a, 0.9 * s, 0.62 * s, 0, Math.PI); for (let i = 0; i < 5; i++) b.sph(rng.range(0.12, 0.2) * s, rng.pick(PAL.grass), (0.9 + rng.range(-0.18, 0.18)) * s, (0.85 + i * 0.1) * s, rng.range(-0.05, 0.1) * s, 1, 1.3, 1); b.sph(0.08 * s, rng.pick(PAL.flowers), 0.92 * s, 1.36 * s, 0.05 * s); },
    right: (b, s, H) => { b.cyl(0.11 * s, 0.17 * s, 0x4ecdc4, 0, -H - 0.06 * s, 0, 0, 0, HP); b.cyl(0.025 * s, 0.26 * s, 0x4ecdc4, 0.05 * s, -H - 0.24 * s, 0, 0, 0, 0.3); b.sph(0.05 * s, 0x4ecdc4, 0.09 * s, -H - 0.37 * s, 0); },
    anim(R, u) { const pour = Math.max(0, Math.sin(u * 1.2)) ** 0.6; R.armR.rotation.set(-0.1, 0, 0.7 + 0.5 * pour); R.armL.rotation.set(0, 0, -0.15 - 0.1 * pour); R.g.rotation.z = -0.07 * pour * R.flip; },
  },
  clean: {
    right: (b, s, H) => b.box(0.2 * s, 0.18 * s, 0.05 * s, 0xffe066, 0, -H - 0.03 * s, 0.05 * s),
    left: (b, s, H) => { b.cyl(0.05 * s, 0.18 * s, 0x5a9bff, 0, -H - 0.05 * s, 0); b.box(0.09 * s, 0.05 * s, 0.05 * s, 0xffffff, 0.03 * s, -H - 0.16 * s, 0); },
    anim(R, u) { R.armR.rotation.set(-0.4, 0, 2.45 + 0.5 * Math.sin(u * 4.6)); R.armL.rotation.set(0, 0, -0.3); R.g.position.x = R.x0 + Math.sin(u * 0.45) * 0.3; R.g.position.y = R.y0 + Math.sin(u * 2.3) * 0.03; },
  },
  dance: {
    body: (b, s) => { b.box(0.48 * s, 0.05 * s, 0.08 * s, DARK, 0, 1.45 * s, 0); for (const k of [-1, 1]) b.sph(0.09 * s, 0xff5d8f, k * 0.23 * s, 1.24 * s, 0, 0.6, 1, 1); },
    anim(R, u) { const bt = u * 5.6; R.g.position.y = R.y0 + Math.abs(Math.sin(bt)) * 0.11 * R.s; R.g.rotation.z = Math.sin(bt * 0.5) * 0.13; R.armR.rotation.set(0, 0, 1.9 + 0.9 * Math.sin(bt)); R.armL.rotation.set(0, 0, -(1.9 - 0.9 * Math.sin(bt))); },
  },
  weights: {
    body: (b, s) => b.box(0.44 * s, 0.07 * s, 0.44 * s, 0xff4757, 0, 1.33 * s, 0),
    right: (b, s, H) => { b.box(0.26 * s, 0.045 * s, 0.045 * s, STEEL, 0, -H, 0); for (const k of [-1, 1]) b.sph(0.085 * s, DARK, k * 0.13 * s, -H, 0); },
    left: (b, s, H) => { b.box(0.26 * s, 0.045 * s, 0.045 * s, STEEL, 0, -H, 0); for (const k of [-1, 1]) b.sph(0.085 * s, DARK, k * 0.13 * s, -H, 0); },
    anim(R, u) { const l = 0.5 - 0.5 * Math.cos(u * 2.3); R.armR.rotation.set(0, 0, 0.3 + 2.55 * l); R.armL.rotation.set(0, 0, -(0.3 + 2.55 * l)); R.g.position.y = R.y0 - (1 - l) * 0.07 * R.s; },
  },
  paint: {
    side: true,
    body: (b, s) => b.sph(0.24 * s, 0x8a2be2, 0.04 * s, 1.42 * s, 0, 1.1, 0.4, 1.1),
    stat: (b, s, rng) => { b.box(0.05 * s, 1.35 * s, 0.05 * s, WOOD, 0.82 * s, 0.67 * s, -0.05 * s, 0, 0, 0.12); b.box(0.05 * s, 1.35 * s, 0.05 * s, WOOD, 1.2 * s, 0.67 * s, -0.05 * s, 0, 0, -0.12); b.box(0.66 * s, 0.8 * s, 0.05 * s, 0xffffff, 1.02 * s, 1.0 * s, 0); for (let i = 0; i < 6; i++) b.box(rng.range(0.1, 0.24) * s, rng.range(0.08, 0.2) * s, 0.02, rng.pick(PAL.cloth), (1.02 + rng.range(-0.2, 0.2)) * s, (1.0 + rng.range(-0.27, 0.27)) * s, 0.03 * s, 0, 0, rng.range(0, 3)); },
    right: (b, s, H) => { b.box(0.03 * s, 0.26 * s, 0.03 * s, WOOD, 0, -H - 0.1 * s, 0); b.sph(0.04 * s, 0xff5d8f, 0, -H - 0.24 * s, 0); },
    left: (b, s, H) => b.sph(0.14 * s, 0xf1d3a1, 0, -H, 0.05 * s, 1.2, 0.3, 1),
    anim(R, u) { const busy = Math.sin(u * 0.8) > -0.2 ? 1 : 0; R.armR.rotation.set(-0.15, 0, 1.4 + 0.22 * Math.sin(u * 0.8) + 0.07 * Math.sin(u * 8) * busy); R.armL.rotation.set(-0.5, 0, -0.5); R.g.rotation.z = busy ? 0 : 0.09; },
  },
  guitar: {
    body: (b, s) => { b.sph(0.21 * s, 0xe8964a, 0.1 * s, 0.62 * s, 0.24 * s, 1, 1.2, 0.35); b.sph(0.15 * s, 0xe8964a, 0.0, 0.8 * s, 0.24 * s, 1, 1, 0.35); b.sph(0.07 * s, 0x3b2b25, 0.07 * s, 0.67 * s, 0.31 * s, 1, 1, 0.3); b.box(0.07 * s, 0.62 * s, 0.05 * s, 0x7c4f2c, -0.26 * s, 1.04 * s, 0.24 * s, 0, 0, 0.82); },
    anim(R, u) { R.armR.rotation.set(-0.65, 0, -0.28 + 0.2 * Math.sin(u * 10)); R.armL.rotation.set(-0.75, 0, -0.95 + 0.05 * Math.sin(u * 2.5)); R.g.rotation.z = Math.sin(u * 2.5) * 0.07; R.g.position.y = R.y0 + Math.abs(Math.sin(u * 2.5)) * 0.04; },
  },
  yoga: {
    body: (b, s) => b.box(0.44 * s, 0.06 * s, 0.44 * s, 0x4ecdc4, 0, 1.33 * s, 0),
    anim(R, u) { const a = 0.5 - 0.5 * Math.cos(u * 0.9), lean = Math.sin(u * 0.45) * 0.3 * a; R.armR.rotation.set(0, 0, 0.2 + 2.75 * a); R.armL.rotation.set(0, 0, -(0.2 + 2.75 * a)); R.g.rotation.z = lean; },
  },
  hammer: {
    side: true,
    stat: (b, s, rng) => { b.box(0.62 * s, 0.5 * s, 0.05 * s, 0xffffff, 1.0 * s, 1.5 * s, -0.25 * s, 0, 0, 0.14); b.box(0.5 * s, 0.38 * s, 0.06 * s, rng.pick(PAL.cloth), 1.0 * s, 1.5 * s, -0.24 * s, 0, 0, 0.14); },
    right: (b, s, H) => { b.box(0.04 * s, 0.34 * s, 0.04 * s, WOOD, 0, -H - 0.13 * s, 0); b.box(0.2 * s, 0.09 * s, 0.08 * s, DARK, 0, -H - 0.3 * s, 0); },
    left: (b, s, H) => b.box(0.02 * s, 0.1 * s, 0.02 * s, STEEL, 0, -H - 0.05 * s, 0),
    anim(R, u) { const on = Math.sin(u * 0.7) > -0.3 ? 1 : 0, tap = Math.abs(Math.sin(u * 6.5)) * on; R.armR.rotation.set(-0.1, 0, 1.75 + 0.5 * tap); R.armL.rotation.set(-0.1, 0, 2.05 - (1 - on) * 1.6); R.g.rotation.z = on ? -0.03 : 0.08; },
  },
  juggle: {
    extra: (b, s) => { [0xff5d5d, 0xffd23f, 0x5a9bff].forEach((c, i) => { const a = (i / 3) * Math.PI * 2; b.sph(0.085 * s, c, Math.cos(a) * 0.36 * s, Math.sin(a) * 0.36 * s, 0); }); },
    anim(R, u) { R.extra.position.set(0, 1.3 * R.s, 0.25 * R.s); R.extra.rotation.z = -u * 4.2; R.extra.scale.set(1, 1.25, 1); R.armR.rotation.set(-0.5, 0, 0.5 + 0.3 * Math.sin(u * 6.3)); R.armL.rotation.set(-0.5, 0, -0.5 + 0.3 * Math.sin(u * 6.3)); R.g.position.y = R.y0 + Math.sin(u * 6.3) * 0.02; },
  },
};
const ALL = Object.keys(ACTS), SHADOW = ['dance', 'weights', 'yoga', 'sweep', 'guitar', 'juggle', 'clean', 'vacuum'];

// x, y = centre-bottom of the space the person stands in. Returns { group, update(t) }.
export function makeNpc(rng, x, y, z, { silhouette = false, s = 1.2 } = {}) {
  const act = ACTS[rng.pick(silhouette ? SHADOW : ALL)];
  const tint = silhouette ? 0x8a7d68 : null;
  const skin = rng.pick(PAL.skin), shirt = rng.pick(PAL.cloth), pants = rng.pick([0x3d4a6b, 0x5c4a3d, 0x2f6b5a, 0x6b3d5c]), hair = rng.pick(PAL.hair);
  const H = 0.47 * s;
  const mk = (fn) => {
    const b = new Batch();
    fn(b);
    if (tint != null) for (let i = 0; i < b.col.length; i += 3) { b.col[i] = 0.25; b.col[i + 1] = 0.2; b.col[i + 2] = 0.14; }
    return b.build({ shadow: false });
  };
  const g = new THREE.Group();
  g.add(mk((b) => {
    b.box(0.34 * s, 0.5 * s, 0.22 * s, pants, 0, 0.25 * s, 0);
    b.cyl(0.24 * s, 0.55 * s, shirt, 0, 0.75 * s, 0, 0, 0, 0, 0.8);
    b.sph(0.21 * s, skin, 0, 1.22 * s, 0);
    b.sph(0.22 * s, hair, 0, 1.3 * s, -0.03 * s, 1, 0.75, 1);
    if (tint == null) { b.sph(0.03 * s, 0x222222, -0.08 * s, 1.24 * s, 0.19 * s); b.sph(0.03 * s, 0x222222, 0.08 * s, 1.24 * s, 0.19 * s); }
    if (act.body) act.body(b, s);
  }));
  const arm = (k, extra) => {
    const m = mk((b) => { b.box(0.1 * s, 0.45 * s, 0.1 * s, shirt, 0, -0.22 * s, 0); b.sph(0.075 * s, skin, 0, -H, 0); if (extra) extra(b, s, H); });
    m.position.set(k * 0.3 * s, 0.98 * s, 0);
    g.add(m);
    return m;
  };
  const flip = rng.sign(), x0 = x + (act.side ? -flip * 0.36 * s : rng.range(-0.25, 0.25));
  const R = { g, s, flip, x0, y0: y, armR: arm(1, act.right), armL: arm(-1, act.left), extra: null };
  if (act.stat) g.add(mk((b) => act.stat(b, s, rng)));
  if (act.extra) { R.extra = mk((b) => act.extra(b, s)); g.add(R.extra); }
  g.position.set(x0, y, z);
  g.scale.set(flip, 1, silhouette ? 0.04 : 1);
  const phase = rng.range(0, 20), speed = rng.range(0.85, 1.15);
  return { group: g, update: (t) => act.anim(R, t * speed + phase) };
}
