// Everything that sticks out of the wall into the character's path. Each builder draws one planned
// object and returns a handle: { hit(ev) -> reaction when the faller connects, update(t, dt) }.
import * as THREE from 'three';
import { Batch, labelTexture } from './batch.js';
import { CFG, PAL } from '../config.js';

const Z0 = CFG.Z0, HP = Math.PI / 2;

function dyn(S, x, y, z, fn) {
  const b = new Batch();
  fn(b);
  const m = b.build();
  m.position.set(x, y, z);
  S.group.add(m);
  return m;
}
function wobbler(mesh, amp = 0.22) {
  const w = { a: 0, v: 0 };
  return {
    kick(d) { w.v += d; },
    update(dt) {
      if (Math.abs(w.a) < 1e-3 && Math.abs(w.v) < 1e-2) return;
      w.v += (-140 * w.a - 6 * w.v) * dt; w.a += w.v * dt;
      mesh.rotation.z = w.a * amp;
      mesh.scale.setScalar(1 + Math.abs(w.a) * 0.1);
    },
  };
}
const side = (ev) => (ev.vx >= 0 ? 1 : -1);

// little person (window dwellers, balcony neighbours, silhouettes). ~1.5*s tall, feet at y.
export function figure(b, x, y, z, s, rng, flat = null) {
  const skin = flat ?? rng.pick(PAL.skin), shirt = flat ?? rng.pick(PAL.cloth), pants = flat ?? rng.pick([0x3d4a6b, 0x5c4a3d, 0x2f6b5a, 0x6b3d5c]);
  const hair = flat ?? rng.pick(PAL.hair);
  b.box(0.34 * s, 0.5 * s, 0.22 * s, pants, x, y + 0.25 * s, z);
  b.cyl(0.24 * s, 0.55 * s, shirt, x, y + 0.75 * s, z, 0, 0, 0, 0.8);
  b.box(0.1 * s, 0.45 * s, 0.1 * s, shirt, x - 0.27 * s, y + 0.75 * s, z, 0, 0, 0.15);
  b.box(0.1 * s, 0.45 * s, 0.1 * s, shirt, x + 0.27 * s, y + 0.75 * s, z, 0, 0, -0.15);
  b.sph(0.21 * s, skin, x, y + 1.22 * s, z);
  b.sph(0.22 * s, hair, x, y + 1.3 * s, z - 0.03 * s, 1, 0.75, 1);
}
export function railing(b, x0, x1, y, z, h = 0.9, color = PAL.rail) {
  const n = Math.max(1, Math.round((x1 - x0) / 0.55));
  for (let i = 0; i <= n; i++) b.box(0.06, h, 0.06, color, x0 + ((x1 - x0) * i) / n, y + h / 2, z);
  b.box(x1 - x0 + 0.1, 0.08, 0.1, color, (x0 + x1) / 2, y + h, z);
}
export function flower(b, x, y, z, rng, s = 1) {
  const h = rng.range(0.25, 0.5) * s;
  b.box(0.035, h, 0.035, 0x4fae4a, x, y + h / 2, z);
  b.sph(0.1 * s, rng.pick(PAL.flowers), x, y + h, z, 1, 0.8, 1);
  b.sph(0.045 * s, 0xffe066, x, y + h + 0.03 * s, z + 0.06 * s);
}
function pigeonMesh(b) {
  b.sph(0.17, 0x9aa4b8, 0, 0.17, 0, 1.3, 0.9, 0.9);
  b.sph(0.1, 0x7d87a0, 0.2, 0.33, 0);
  b.cone(0.04, 0.1, 0xffa94d, 0.32, 0.32, 0, 0, 0, -HP);
  b.box(0.2, 0.03, 0.16, 0x6f7890, -0.2, 0.2, 0, 0, 0, 0.3);
}
function goatMesh(b) {
  const w = 0xfdfdf5, d = 0x5a4a42;
  b.box(0.75, 0.42, 0.36, w, 0, 0.55, 0);
  b.box(0.3, 0.3, 0.28, w, 0.45, 0.82, 0);
  b.box(0.16, 0.14, 0.2, 0xf3d9c9, 0.62, 0.76, 0);
  b.cone(0.045, 0.22, d, 0.4, 1.05, 0.08, 0, 0, 0.5); b.cone(0.045, 0.22, d, 0.4, 1.05, -0.08, 0, 0, 0.5);
  b.box(0.06, 0.16, 0.06, w, 0.6, 0.62, 0);
  for (const [x, z] of [[-0.28, 0.12], [-0.28, -0.12], [0.28, 0.12], [0.28, -0.12]]) { b.box(0.09, 0.36, 0.09, w, x, 0.18, z); b.box(0.1, 0.08, 0.1, d, x, 0.04, z); }
  b.box(0.08, 0.14, 0.08, w, -0.4, 0.72, 0, 0, 0, 0.6);
  b.sph(0.035, 0x222222, 0.56, 0.87, 0.14); b.sph(0.035, 0x222222, 0.56, 0.87, -0.14);
}

const B = {};

// ---------------------------------------------------------------- pegs
function rockLike(o, S, big) {
  const r = o.r, L = (Z0 + 0.5 * r + 0.3) / 2, v = S.rng.int(0, 7);
  const col = S.rng.pick(PAL.rock);
  const mesh = dyn(S, o.x, o.y, 0, (b) => {
    b.rock(r * 1.02, col, 0, 0, L - 0.3, v, 1, 1, L / r);
    b.rock(r * 0.55, PAL.rockDark, r * 0.6 * S.rng.sign(), -r * 0.45, 0.5, v + 3, 1, 1, 1.3);
    if (S.rng.chance(0.6)) b.sph(r * 0.7, S.rng.pick(PAL.moss), 0, r * 0.62, L - 0.3, 1, 0.4, (L / r) * 0.8);
    if (big) b.rock(r * 0.4, col, -r * 0.5, r * 0.55, 1.2, v + 5);
  });
  const w = wobbler(mesh, 0.1);
  return { mesh,
    hit(ev) {
      w.kick(side(ev) * (big ? 1.2 : 2)); S.sfx.obj(big ? 'boulder' : 'rock');
      S.fx.puff({ x: ev.x, y: ev.y - 0.3, n: 5, color: 0xf3e3d0, size: 0.35 });
      S.fx.burst({ x: ev.x, y: ev.y - 0.3, n: big ? 12 : 7, colors: PAL.rock, speed: 5, size: [0.07, 0.2] });
    },
    update: (t, dt) => w.update(dt),
  };
}
B.rock = (o, S) => rockLike(o, S, false);
B.boulder = (o, S) => rockLike(o, S, true);
B.log = (o, S) => {
  const r = o.r, wood = S.rng.pick(PAL.wood);
  const mesh = dyn(S, o.x, o.y, 0, (b) => {
    b.cyl(r, 2.9, wood, 0, 0, 1.2, HP);
    b.cyl(r * 0.96, 0.06, 0xf1d3a1, 0, 0, 2.66, HP);
    b.cyl(r * 0.5, 0.07, 0xdcb680, 0, 0, 2.67, HP);
    b.cyl(r * 0.3, 0.5, PAL.woodDark, r * 0.5, r * 0.9, 1.4, 0, 0, -0.5);
    for (let i = 0; i < 3; i++) b.sph(S.rng.range(0.22, 0.34), S.rng.pick(PAL.grass), S.rng.range(0.3, 0.9), r + S.rng.range(0.35, 0.6), 1.2 + i * 0.35);
    b.sph(0.3, S.rng.pick(PAL.moss), 0, r * 0.75, 0.8, 1, 0.4, 2);
  });
  const w = wobbler(mesh, 0.16);
  return { mesh,
    hit(ev) { S.sfx.obj('log'); w.kick(side(ev) * 2.5); S.fx.burst({ x: ev.x, y: ev.y, n: 9, colors: PAL.grass, flat: true, speed: 4, g: 0.35, drag: 2, size: [0.12, 0.2] }); S.fx.burst({ x: ev.x, y: ev.y - 0.3, n: 4, colors: PAL.wood, speed: 4 }); },
    update: (t, dt) => w.update(dt),
  };
};
B.lamp = (o, S) => {
  const mesh = dyn(S, o.x, o.y, 0, (b) => {
    b.box(0.3, 0.5, 0.08, PAL.metalDark, 0, 0.85, 0.04);
    b.cyl(0.05, Z0, PAL.metalDark, 0, 0.85, Z0 / 2, HP);
    b.cyl(0.035, 0.5, PAL.metalDark, 0, 0.6, 0.7, 0.9);
    b.cyl(0.04, 0.4, PAL.metalDark, 0, 0.62, Z0);
    b.cone(0.5, 0.26, 0x3d4560, 0, 0.42, Z0);
    b.sph(0.07, PAL.gold, 0, 0.58, Z0);
  });
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff3cf });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(o.r * 0.92, 14, 10), mat);
  globe.position.set(0, 0, Z0);
  mesh.add(globe);
  const w = wobbler(mesh, 0.2);
  let glow = 0;
  return { mesh,
    hit(ev) {
      w.kick(side(ev) * 3); glow = 1; mat.color.setHex(0xffe45c);
      S.fx.burst({ x: o.x, y: o.y, n: 10, colors: [0xfff3a0, 0xffd23f, 0xffffff], speed: 8, size: [0.05, 0.1], life: 0.5, g: 0.3 });
      S.sfx.obj('lamp');
    },
    update(t, dt) { w.update(dt); if (glow > 0) { glow = Math.max(0, glow - dt * 3); globe.scale.setScalar(1 + glow * 0.5); } },
  };
};
const SIGNS = [['CAFÉ', '#ff6b6b', '#fff'], ['PIZZA', '#ffd23f', '#d6336c'], ['BAR', '#4ecdc4', '#1b3a4b'], ['24h', '#5a9bff', '#fff'], ['★', '#ff9f43', '#fff'], ['♥', '#ff5d8f', '#fff'], ['TAXI', '#ffe66d', '#222'], ['HOTEL', '#b48cff', '#fff'], ['OPEN', '#7bed9f', '#1b4332'], ['DELI', '#ffffff', '#ff6b6b'], ['$$$', '#2ecc71', '#fff']];
B.sign = (o, S) => {
  const r = o.r, [text, bg, fg] = S.rng.pick(SIGNS);
  const mesh = dyn(S, o.x, o.y, 0, (b) => {
    b.cyl(r, 0.24, 0xffffff, 0, 0, Z0, HP);
    b.cyl(r * 1.07, 0.14, 0x3d4560, 0, 0, Z0 - 0.02, HP);
    b.cyl(0.05, Z0, PAL.metalDark, -r * 0.45, r * 0.3, Z0 / 2, HP);
    b.cyl(0.05, Z0, PAL.metalDark, r * 0.45, r * 0.3, Z0 / 2, HP);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; b.sph(0.06, PAL.gold, Math.cos(a) * r * 0.99, Math.sin(a) * r * 0.99, Z0 + 0.1); }
  });
  const face = new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, 24), new THREE.MeshBasicMaterial({ map: labelTexture(text, bg, fg) }));
  face.position.set(0, 0, Z0 + 0.125);
  mesh.add(face);
  const w = wobbler(mesh, 0.3);
  return { mesh,
    hit(ev) { w.kick(side(ev) * 3.5); S.fx.burst({ x: ev.x, y: ev.y, n: 8, colors: [0xffd23f, 0xffffff, 0xff6b6b], speed: 7, size: [0.05, 0.1], life: 0.5, g: 0.3 }); S.sfx.obj('sign'); },
    update: (t, dt) => w.update(dt),
  };
};
B.dish = (o, S) => {
  const r = o.r;
  const mesh = dyn(S, o.x, o.y, 0, (b) => {
    b.sph(r, 0xf4f6fb, 0, 0, Z0 - 0.1, 1, 1, 0.3);
    b.sph(r * 0.82, 0xd5dbe8, 0, 0, Z0, 1, 1, 0.22);
    b.cyl(0.03, 0.75, PAL.metalDark, 0, -r * 0.3, Z0 + 0.3, HP - 0.4);
    b.sph(0.09, 0xff6b6b, 0, -0.02, Z0 + 0.62);
    b.cyl(0.07, Z0, PAL.metalDark, 0, -r * 0.2, Z0 / 2 - 0.1, HP);
  });
  mesh.rotation.y = S.rng.range(-0.25, 0.25);
  const w = wobbler(mesh, 0.25);
  return { mesh, hit(ev) { S.sfx.obj('dish'); w.kick(side(ev) * 3); S.fx.burst({ x: ev.x, y: ev.y, n: 8, colors: [0xffffff, 0xd5dbe8, 0xffd23f], speed: 7, size: [0.05, 0.1], life: 0.5, g: 0.3 }); }, update: (t, dt) => w.update(dt) };
};
B.ac = (o, S) => {
  const mesh = dyn(S, o.x, o.y, 0, (b) => {
    b.box(1.15, 0.9, 1.15, 0xeef1f6, 0, 0, Z0 - 0.15);
    b.box(1.19, 0.08, 1.19, 0xcfd6e2, 0, 0.45, Z0 - 0.15);
    b.cyl(0.33, 0.05, 0x4b5368, -0.15, 0, Z0 + 0.43, HP);
    b.cyl(0.1, 0.07, 0xcfd6e2, -0.15, 0, Z0 + 0.44, HP);
    for (let i = 0; i < 3; i++) b.box(0.22, 0.05, 0.04, 0x9aa3b5, 0.38, 0.22 - i * 0.14, Z0 + 0.43);
    b.sph(0.04, 0x51e08a, 0.38, -0.3, Z0 + 0.43);
    b.box(0.08, 0.08, 1.0, PAL.metalDark, -0.4, -0.5, 0.5); b.box(0.08, 0.08, 1.0, PAL.metalDark, 0.4, -0.5, 0.5);
  });
  const w = wobbler(mesh, 0.14);
  return { mesh, hit(ev) { S.sfx.obj('ac'); w.kick(side(ev) * 2.5); S.fx.puff({ x: ev.x, y: ev.y, n: 4, color: 0xffffff, size: 0.3 }); S.fx.burst({ x: ev.x, y: ev.y, n: 6, colors: [0xcfd6e2, 0x9aa3b5], speed: 5, size: [0.06, 0.12] }); }, update: (t, dt) => w.update(dt) };
};
B.flagpole = (o, S) => {
  const c1 = S.rng.pick(PAL.cloth), c2 = S.rng.pick(PAL.cloth);
  const mesh = dyn(S, o.x, o.y, 0, (b) => {
    b.cyl(0.1, 3.0, 0xf4f6fb, 0, 0, 1.5, HP);
    b.sph(0.17, PAL.gold, 0, 0, 3.0);
    b.cyl(0.2, 0.1, PAL.metalDark, 0, 0, 0.05, HP);
    b.box(0.62, 0.3, 0.04, c1, 0, -0.26, 2.6); b.box(0.62, 0.3, 0.04, c2, 0, -0.56, 2.6);
  });
  const w = wobbler(mesh, 0.35);
  return { mesh, hit(ev) { S.sfx.obj('flagpole'); w.kick(side(ev) * 4); S.fx.burst({ x: ev.x, y: ev.y, n: 6, colors: [c1, c2, 0xffffff], speed: 6, flat: true, size: [0.08, 0.16], g: 0.4, drag: 2 }); }, update: (t, dt) => w.update(dt) };
};

// ---------------------------------------------------------------- small platforms + things resting on them
function topper(o, S) {
  const { fx, sfx, rng } = S, y = o.y, kind = o.topper;
  if (kind === 'flowers') {
    const m = dyn(S, o.x, y, 0, (b) => { for (let i = 0; i < 12; i++) flower(b, rng.range(-o.hw * 0.75, o.hw * 0.75), 0, rng.range(0.7, 2.2), rng, 1.3); for (let i = 0; i < 5; i++) b.sph(0.16, rng.pick(PAL.grass), rng.range(-o.hw * 0.7, o.hw * 0.7), 0.06, rng.range(0.7, 2.2)); });
    return { hit(ev) { m.visible = false; fx.burst({ x: ev.x, y: y + 0.3, n: 46, colors: PAL.flowers, flat: true, speed: 7, up: 4, size: [0.1, 0.2], g: 0.3, drag: 2.2, life: 1.8, spread: 0.8 }); fx.burst({ x: ev.x, y: y + 0.2, n: 12, colors: PAL.grass, speed: 5, size: [0.06, 0.12] }); sfx.obj('flowers'); } };
  }
  if (kind === 'pots') {
    const xs = [-0.55, 0, 0.55].map((x) => x * o.hw);
    const m = dyn(S, o.x, y, 0, (b) => { for (const x of xs) { const z = rng.range(1.2, 1.9); b.cyl(0.2, 0.3, 0xd9774a, x, 0.15, z, Math.PI); b.cyl(0.23, 0.06, 0xc0633a, x, 0.3, z); b.sph(0.22, rng.pick(PAL.grass), x, 0.48, z); flower(b, x + 0.08, 0.5, z + 0.1, rng, 1.2); flower(b, x - 0.1, 0.45, z, rng, 1.2); } });
    return { hit(ev) { m.visible = false; fx.burst({ x: ev.x, y: y + 0.2, n: 22, colors: [0xd9774a, 0xc0633a, 0x7a4a2b], speed: 7, up: 3, size: [0.08, 0.2], spread: 0.7 }); fx.burst({ x: ev.x, y: y + 0.4, n: 18, colors: PAL.flowers.concat(PAL.grass), flat: true, speed: 6, up: 4, g: 0.35, drag: 2, size: [0.1, 0.18] }); fx.puff({ x: ev.x, y: y + 0.2, n: 4, color: 0xb98a5e, size: 0.3 }); sfx.obj('pots'); } };
  }
  if (kind === 'hut') {
    const hx = -0.3 * o.hw, gx = 0.5 * o.hw;
    const m = dyn(S, o.x, y, 0, (b) => {
      b.cyl(0.38, 0.5, 0xfff1d6, hx, 0.25, Z0);
      b.cone(0.55, 0.6, 0xff4757, hx, 0.8, Z0);
      for (let i = 0; i < 5; i++) { const a = i * 1.26; b.sph(0.07, 0xffffff, hx + Math.cos(a) * 0.3, 0.72 + (i % 2) * 0.12, Z0 + Math.sin(a) * 0.3); }
      b.box(0.18, 0.3, 0.05, PAL.woodDark, hx, 0.15, Z0 + 0.38);
      b.sph(0.06, 0xffe066, hx + 0.2, 0.3, Z0 + 0.34);
    });
    const gnome = dyn(S, o.x + gx, y, Z0 + 0.2, (b) => { b.cyl(0.14, 0.26, 0x4f7cff, 0, 0.13, 0, 0, 0, 0, 0.8); b.sph(0.12, 0xffd2b0, 0, 0.32, 0); b.sph(0.11, 0xffffff, 0, 0.25, 0.06, 1, 1, 0.7); b.cone(0.13, 0.34, 0xff4757, 0, 0.55, 0); });
    return {
      hit(ev) {
        m.visible = false;
        fx.burst({ x: o.x + hx, y: y + 0.4, n: 16, colors: [0xfff1d6, 0xb9814f, 0xa26c3f], speed: 7, up: 4, size: [0.1, 0.28] });
        fx.burst({ x: o.x + hx, y: y + 0.8, n: 12, colors: [0xff4757, 0xffffff, 0xff6b81], speed: 8, up: 5, size: [0.1, 0.24] });
        fx.puff({ x: o.x + hx, y: y + 0.3, n: 6, color: 0xfff1d6, size: 0.4 });
        fx.flyer(gnome, { vx: side(ev) * 5 + 2, vy: 11, vz: 1.5, spin: 14 });
        sfx.obj('hut');
      },
      update(t) { gnome.position.y = y + Math.max(0, Math.sin(t * 3 + o.x)) * 0.05; },
    };
  }
  if (kind === 'goat') {
    const dir = rng.sign(), goat = dyn(S, o.x, y, Z0, goatMesh);
    goat.scale.x = dir;
    let gone = false;
    return {
      hit(ev) { gone = true; fx.flyer(goat, { vx: side(ev) * 7, vy: 10, vz: 2, spin: side(ev) * -11 }); fx.puff({ x: o.x, y: y + 0.4, n: 6, color: 0xffffff, size: 0.35 }); fx.burst({ x: o.x, y: y + 0.5, n: 10, colors: [0xffffff, 0xf2efe4], flat: true, speed: 5, g: 0.3, drag: 2, size: [0.08, 0.14] }); sfx.obj('goat'); },
      update(t) { if (!gone) { goat.rotation.z = Math.sin(t * 1.7 + o.x) * 0.04; goat.position.y = y + Math.abs(Math.sin(t * 2.3 + o.y)) * 0.03; } },
    };
  }
  if (kind === 'pigeons') {
    const birds = [-0.5, 0.05, 0.55].map((k, i) => { const m = dyn(S, o.x + k * o.hw, y, 1.3 + i * 0.3, pigeonMesh); m.scale.x = rng.sign(); return m; });
    let gone = false;
    return {
      hit(ev) {
        gone = true;
        birds.forEach((m, i) => fx.flyer(m, { vx: (i - 1) * 4 + side(ev) * 2, vy: 6 + i * 2, vz: 1, g: -0.25, spin: 0, life: 2.5, update: (mm, age) => { mm.rotation.set(0, 0, Math.sin(age * 40) * 0.5); mm.scale.y = 1 + Math.sin(age * 40) * 0.3; } }));
        fx.burst({ x: ev.x, y: y + 0.3, n: 16, colors: [0xffffff, 0x9aa4b8, 0xc9d0de], flat: true, speed: 5, up: 2, g: 0.15, drag: 2.5, life: 2, size: [0.1, 0.18] });
        sfx.obj('pigeons');
      },
      update(t) { if (!gone) birds.forEach((m, i) => { m.rotation.z = Math.max(0, Math.sin(t * 2 + i * 2.1 + o.x)) ** 6 * -0.5; }); },
    };
  }
  return null;
}
function platHandle(o, S, top, dust) {
  return {
    hit(ev) { if (top) top.hit(ev); else { S.fx.puff({ x: ev.x, y: o.y + 0.1, n: 5, color: dust, size: 0.3 }); } },
    update: top && top.update ? (t, dt) => top.update(t, dt) : null,
  };
}
function drawLedge(b, o, rng, thick = 0.4) {
  const v = rng.int(0, 7), col = rng.pick(PAL.rock);
  b.box(o.hw * 2, thick, 2.5, col, o.x, o.y - thick / 2 - 0.04, 1.25);
  b.rock(o.hw * 0.75, PAL.rockDark, o.x - o.hw * 0.3, o.y - thick - 0.15, 0.9, v, 1, 0.45, 1.3 / o.hw);
  b.rock(o.hw * 0.6, col, o.x + o.hw * 0.4, o.y - thick - 0.05, 1.5, v + 2, 1, 0.4, 1.4 / o.hw);
  b.box(o.hw * 2 + 0.1, 0.1, 2.6, rng.pick(PAL.grass), o.x, o.y - 0.05, 1.27);
  for (let i = 0; i < 4; i++) b.sph(0.14, rng.pick(PAL.grass), o.x + rng.range(-1, 1) * o.hw, o.y - 0.03, 2.5, 1, 0.8, 1);
}
function drawBalcony(b, o, rng, thick = 0.4, rail = true) {
  b.box(o.hw * 2, thick - 0.1, 2.6, PAL.slab, o.x, o.y - (thick - 0.1) / 2, 1.3);
  b.box(o.hw * 2 + 0.1, 0.1, 2.7, 0xffffff, o.x, o.y - thick + 0.05, 1.3);
  for (const s of [-1, 1]) b.box(0.14, 0.5, 1.6, 0xd5cfe0, o.x + s * o.hw * 0.7, o.y - thick - 0.2, 0.8, 0.5);
  if (rail) railing(b, o.x - o.hw + 0.05, o.x + o.hw - 0.05, o.y, 2.55, 0.5);
}
B.ledge = (o, S) => { drawLedge(S.batch, o, S.rng); return platHandle(o, S, topper(o, S), 0xf3e3d0); };
B.minibalc = (o, S) => { drawBalcony(S.batch, o, S.rng, 0.4, false); S.batch.box(o.hw * 2, 0.08, 0.08, PAL.rail, o.x, o.y + 0.04, 2.56); return platHandle(o, S, topper(o, S), 0xffffff); };
B.bigledge = (o, S) => {
  drawLedge(S.batch, o, S.rng, 0.5);
  S.batch.sph(0.4, S.rng.pick(PAL.grass), o.x - o.hw * 0.8, o.y + 0.25, 0.6);
  return { hit() {} };
};
B.balcony = (o, S) => {
  const b = S.batch;
  drawBalcony(b, o, S.rng, 0.5, true);
  b.box(1.1, 2.1, 0.1, 0x7a5a48, o.x, o.y + 1.05, 0.05); b.box(1.3, 2.25, 0.06, 0xffffff, o.x, o.y + 1.1, 0.02);
  b.sph(0.06, PAL.gold, o.x + 0.38, o.y + 1.0, 0.13);
  b.cyl(0.2, 0.3, 0xd9774a, o.x - o.hw + 0.4, o.y + 0.15, 0.5, Math.PI); b.sph(0.3, PAL.grass[0], o.x - o.hw + 0.4, o.y + 0.55, 0.5);
  return { hit() {} };
};

// ---------------------------------------------------------------- things to crash straight through
B.bridge = (o, S) => {
  const { batch: sb, rng, fx, sfx } = S, wood = PAL.wood;
  for (const s of [-1, 1]) {
    const cx = o.x + s * (o.hw + 0.6);
    sb.rock(0.75, rng.pick(PAL.rock), cx, o.y - 0.5, 1.2, rng.int(0, 7), 0.85, 0.6, 1.8);
    sb.box(1.2, 0.12, 2.4, rng.pick(PAL.grass), cx, o.y - 0.02, 1.2);
    for (const z of [0.85, 2.15]) sb.cyl(0.07, 0.9, PAL.woodDark, o.x + s * (o.hw + 0.1), o.y + 0.45, z);
  }
  const n = Math.round((o.hw * 2) / 0.42), planks = [];
  const sag = (u) => -0.22 * (1 - (2 * u - 1) ** 2);
  const m = dyn(S, 0, 0, 0, (b) => {
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, x = o.x - o.hw + u * o.hw * 2, y = o.y + sag(u), c = wood[i % 3];
      b.box(0.34, 0.08, 1.2, c, x, y, Z0);
      planks.push({ x, y, c });
      if (i < n - 1) for (const z of [0.85, 2.15]) { const u2 = (i + 1) / n; b.box(0.44, 0.04, 0.04, 0xe8d3a8, x + 0.21, o.y + 0.75 + sag(u2) * 1.6, z, 0, 0, (sag((i + 1.5) / n) - sag(u)) * 3); }
      if (i % 2 === 0) for (const z of [0.85, 2.15]) b.box(0.03, 0.75, 0.03, 0xe8d3a8, x, y + 0.37, z);
    }
  });
  return {
    hit(ev) {
      m.visible = false;
      for (const p of planks) { const d = p.x - ev.x; fx.chunk({ x: p.x, y: p.y, z: Z0, vx: d * 2.2 + (Math.random() - 0.5) * 3, vy: 5 - Math.abs(d) * 1.2 + Math.random() * 3, vz: (Math.random() - 0.3) * 3, sx: 0.34, sy: 0.08, sz: 1.2, color: p.c, life: 2.2, spin: 7 }); }
      fx.burst({ x: ev.x, y: ev.y, n: 14, colors: [0xe8d3a8, 0xcf9a63], speed: 6, size: [0.05, 0.3], flat: true });
      fx.puff({ x: ev.x, y: ev.y, n: 5, color: 0xf3e3d0, size: 0.4 });
      sfx.obj('bridge');
    },
  };
};
function lineOf(o, S, items, poleCol, dustCol) {
  const { fx, sfx } = S, flying = [];
  const sag = (u) => 0.4 * (2 * u - 1) ** 2; // ends are 0.4 above the middle
  const m = dyn(S, 0, 0, 0, (b) => {
    const n = 14;
    for (let i = 0; i < n; i++) { const u0 = i / n, u1 = (i + 1) / n, x0 = o.x - o.hw + u0 * o.hw * 2, x1 = o.x - o.hw + u1 * o.hw * 2, y0 = o.y + sag(u0), y1 = o.y + sag(u1); b.box(Math.hypot(x1 - x0, y1 - y0) + 0.02, 0.035, 0.035, 0xfafafa, (x0 + x1) / 2, (y0 + y1) / 2, Z0, 0, 0, Math.atan2(y1 - y0, x1 - x0)); }
    items(b, sag, flying);
  });
  for (const s of [-1, 1]) { S.batch.cyl(0.09, 2.0, poleCol, o.x + s * o.hw, o.y + 0.4, 1.0, HP); S.batch.sph(0.13, poleCol, o.x + s * o.hw, o.y + 0.4, 2.0); }
  return {
    hit(ev) {
      m.visible = false;
      for (const f of flying) fx.chunk({ x: f.x, y: f.y, z: Z0, vx: (f.x - ev.x) * 1.5 + ev.vx * 0.3 + (Math.random() - 0.5) * 3, vy: 3 + Math.random() * 4, vz: Math.random() * 2, sx: f.w, sy: f.h, sz: 0.04, color: f.c, life: 2.6, g: 0.22, drag: 1.8, spin: 5 });
      fx.puff({ x: ev.x, y: ev.y, n: 3, color: dustCol, size: 0.3 });
      sfx.obj(o.kind);
    },
  };
}
B.clothesline = (o, S) => lineOf(o, S, (b, sag, fl) => {
  const rng = S.rng, n = Math.floor(o.hw * 2 / 0.85);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, x = o.x - o.hw + u * o.hw * 2, y = o.y + sag(u), c = rng.pick(PAL.cloth), type = rng.int(0, 3);
    b.box(0.05, 0.1, 0.06, 0xc79a5b, x - 0.15, y, Z0); b.box(0.05, 0.1, 0.06, 0xc79a5b, x + 0.15, y, Z0);
    if (type === 0) { b.box(0.5, 0.55, 0.04, c, x, y - 0.32, Z0); b.box(0.2, 0.22, 0.04, c, x - 0.33, y - 0.17, Z0, 0, 0, 0.5); b.box(0.2, 0.22, 0.04, c, x + 0.33, y - 0.17, Z0, 0, 0, -0.5); fl.push({ x, y: y - 0.3, w: 0.6, h: 0.55, c }); }
    else if (type === 1) { b.box(0.44, 0.25, 0.04, c, x, y - 0.17, Z0); b.box(0.19, 0.55, 0.04, c, x - 0.125, y - 0.5, Z0); b.box(0.19, 0.55, 0.04, c, x + 0.125, y - 0.5, Z0); fl.push({ x, y: y - 0.4, w: 0.44, h: 0.7, c }); }
    else if (type === 2) { b.box(0.62, 0.8, 0.04, c, x, y - 0.44, Z0); b.box(0.62, 0.1, 0.045, 0xffffff, x, y - 0.6, Z0); fl.push({ x, y: y - 0.4, w: 0.62, h: 0.8, c }); }
    else { for (const dx of [-0.14, 0.14]) { b.box(0.13, 0.38, 0.04, c, x + dx, y - 0.22, Z0); b.box(0.2, 0.12, 0.04, c, x + dx + 0.04, y - 0.4, Z0); fl.push({ x: x + dx, y: y - 0.25, w: 0.15, h: 0.4, c }); } }
  }
}, PAL.metal, 0xffffff);
B.bunting = (o, S) => lineOf(o, S, (b, sag, fl) => {
  const n = Math.floor(o.hw * 2 / 0.48);
  for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, x = o.x - o.hw + u * o.hw * 2, y = o.y + sag(u), c = PAL.cloth[i % PAL.cloth.length]; b.cone(0.2, 0.42, c, x, y - 0.22, Z0, Math.PI, 0, 0); fl.push({ x, y: y - 0.2, w: 0.3, h: 0.36, c }); }
}, PAL.woodDark, 0xfff1d6);
B.awning = (o, S) => {
  const { batch: sb, rng, fx, sfx } = S, c1 = rng.pick([0xff5d5d, 0x3fa7ff, 0x2ecc71, 0xff9f43, 0xb48cff]), w = o.hw * 2, depth = 2.7, tilt = 0.3;
  for (const s of [-1, 1]) { sb.cyl(0.04, depth + 0.1, PAL.metalDark, o.x + s * o.hw, o.y, depth / 2, HP + tilt); sb.cyl(0.035, 1.6, PAL.metalDark, o.x + s * o.hw, o.y - 0.5, 0.75, HP - 0.35); }
  sb.box(w + 0.1, 0.12, 0.12, 0xffffff, o.x, o.y + 0.4, 0.08);
  const n = 8, strips = [];
  const m = dyn(S, o.x, o.y, depth / 2, (b) => {
    for (let i = 0; i < n; i++) { const x = -o.hw + (i + 0.5) * (w / n), c = i % 2 ? 0xffffff : c1; b.box(w / n, 0.06, depth, c, x, 0, 0); b.box(w / n, 0.42, 0.06, c, x, -0.2, depth / 2); strips.push({ x: o.x + x, c }); }
  });
  m.rotation.x = tilt;
  return {
    hit(ev) {
      m.visible = false;
      for (const s of strips) for (let k = 0; k < 3; k++) fx.chunk({ x: s.x, y: o.y + 0.3 - k * 0.3, z: 0.5 + k * 0.9, vx: (s.x - ev.x) * 2 + (Math.random() - 0.5) * 2, vy: -2 + Math.random() * 5, vz: Math.random() * 2, sx: w / n, sy: 0.04, sz: 0.85, color: s.c, life: 2.2, g: 0.3, drag: 1.6, spin: 5 });
      fx.puff({ x: ev.x, y: ev.y, n: 4, color: 0xffffff, size: 0.35 });
      sfx.obj('awning');
    },
  };
};
B.sugar = (o, S) => {
  const { batch: sb, rng, fx, sfx } = S, hy = o.y, period = 1.15;
  const people = [];
  for (const s of [-1, 1]) {
    const bx = o.x + s * o.dx;
    drawBalcony(sb, { x: bx, y: o.btop, hw: o.bhw }, rng, 0.4, true);
    sb.box(1.0, 2.0, 0.1, 0x6b8fb8, bx, o.btop + 1.0, 0.05); sb.box(1.2, 2.15, 0.06, 0xffffff, bx, o.btop + 1.05, 0.02);
    const p = dyn(S, bx - s * 0.35, o.btop, 1.4, (b) => figure(b, 0, 0, 0, 1.05, rng));
    people.push(p);
  }
  const bag = dyn(S, o.x, hy, Z0, (b) => { b.box(0.5, 0.62, 0.3, 0xfffdf5, 0, 0, 0); b.box(0.52, 0.2, 0.31, 0x5a9bff, 0, 0, 0); b.box(0.3, 0.1, 0.2, 0xfffdf5, 0, 0.36, 0); });
  let burst = false, shock = 0;
  const x0 = o.x - o.dx + 0.75, x1 = o.x + o.dx - 0.75;
  return {
    hit(ev) {
      burst = true; shock = 1.6; bag.visible = false;
      fx.puff({ x: ev.x, y: ev.y, n: 46, color: 0xffffff, size: 0.75, spread: 0.8, life: 1.5, speed: 6, rise: 0.6 });
      fx.burst({ x: ev.x, y: ev.y, n: 40, colors: [0xffffff, 0xf5f8ff], speed: 9, size: [0.04, 0.09], life: 1.4, g: 0.5, drag: 1.5 });
      fx.burst({ x: ev.x, y: ev.y, n: 6, colors: [0xfffdf5, 0x5a9bff], speed: 5, flat: true, size: [0.15, 0.3], g: 0.3, drag: 2 });
      sfx.obj('sugar');
    },
    update(t, dt) {
      // the bag is lobbed back and forth so that it is exactly mid-arc when the faller arrives
      const ph = (t - o.tHit) / period + 0.5, k = Math.floor(ph);
      let u = ph - k;
      const e = u * u * (3 - 2 * u) * 0.3 + u * 0.7;
      const dirU = k % 2 === 0 ? e : 1 - e;
      if (!burst) {
        bag.position.set(x0 + (x1 - x0) * dirU, hy - 1.3 * (2 * e - 1) ** 2, Z0);
        bag.rotation.z = (k % 2 ? -1 : 1) * e * 6.283;
      }
      people.forEach((p, i) => {
        const catching = !burst && Math.abs(dirU - i) < 0.12;
        const hop = shock > 0 ? Math.abs(Math.sin(t * 16)) * 0.25 : catching ? 0.12 : 0;
        p.position.y = o.btop + hop;
        p.rotation.z = shock > 0 ? Math.sin(t * 22) * 0.12 : 0;
      });
      if (shock > 0) shock -= dt;
    },
  };
};
B.bird = (o, S) => {
  const { fx, sfx, rng } = S, col = rng.pick([0xff6b6b, 0x5a9bff, 0xffd23f, 0xffffff]);
  const g = new THREE.Group();
  S.group.add(g);
  const mk = (fn) => { const b = new Batch(); fn(b); const m = b.build(); g.add(m); return m; };
  mk((b) => { b.sph(0.26, col, 0, 0, 0, 1.4, 0.9, 0.9); b.sph(0.17, col, 0.32, 0.14, 0); b.cone(0.07, 0.2, 0xffa94d, 0.54, 0.12, 0, 0, 0, -HP); b.sph(0.04, 0x222222, 0.4, 0.2, 0.13); b.box(0.3, 0.04, 0.2, 0xffffff, -0.42, 0.02, 0, 0, 0, 0.2); });
  const wings = [1, -1].map((s) => { const w = mk((b) => b.box(0.34, 0.04, 0.62, 0xffffff, 0, 0, 0.31)); w.position.set(-0.05, 0.08, s * 0.12); w.scale.z = s; return w; });
  g.scale.x = o.dir;
  let dead = false;
  return {
    hit(ev) {
      dead = true; g.visible = false;
      fx.burst({ x: ev.x, y: ev.y, n: 30, colors: [col, 0xffffff], flat: true, speed: 7, up: 2, g: 0.15, drag: 2.5, life: 2.2, size: [0.1, 0.22] });
      fx.puff({ x: ev.x, y: ev.y, n: 4, color: 0xffffff, size: 0.3 });
      sfx.obj('bird');
    },
    update(t) {
      if (dead) return;
      let dx = (t - o.tHit) * o.speed;
      dx = ((((dx + 20) % 40) + 40) % 40) - 20; // loops across the screen, passing the hit point at tHit
      g.position.set(o.x + o.dir * dx, o.y + Math.sin(t * 5) * 0.06 * Math.min(1, Math.abs(dx)), Z0);
      const f = Math.sin(t * 18) * 0.8;
      wings[0].rotation.x = -f; wings[1].rotation.x = f;
    },
  };
};

export function buildObject(o, S) {
  const f = B[o.kind];
  return f ? f(o, S) : null;
}
