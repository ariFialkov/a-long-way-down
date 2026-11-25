// Chunk scenery: the wall itself (cliff face / building facades), background detail, the floor with
// its opening, and the summit the faller starts from. Everything static goes into one Batch per chunk.
// Surfaces are functions of world coordinates / per-stretch seeds, so neighbouring chunks line up.
import * as THREE from 'three';
import { Batch, labelTexture } from './batch.js';
import { railing, flower, buildObject } from './objects.js';
import { makeNpc } from './npc.js';
import { CFG, PAL, KINDS } from '../config.js';
import { RNG, hash2, noise2 } from '../rng.js';

const H = CFG.SECTION_H, W = CFG.WORLD_HW, HP = Math.PI / 2;
const mod = (a, n) => ((a % n) + n) % n;

// ------------------------------------------------------------------ cliff
export function cliffZ(x, y, seed) {
  let z = -1.3 + noise2(x * 0.11, y * 0.11, seed) * 1.3 + noise2(x * 0.33, y * 0.33, seed + 7) * 0.55;
  const ax = Math.abs(x);
  if (ax < 8.5) z = Math.min(z, 0.05);
  else z += Math.min(1, (ax - 8.5) / 6) * noise2(x * 0.07, y * 0.09, seed + 3) * 1.7;
  return z;
}
function cliffWall(b, yTop, seed, top) {
  const cx = 1.3, cy = H / 20, nx = Math.ceil(W / cx), iy0 = Math.round(yTop / cy);
  const vert = (ix, iy) => {
    const jx = (hash2(ix, iy, seed) - 0.5) * 0.7, jy = iy % 20 === 0 ? 0 : (hash2(ix, iy, seed + 1) - 0.5) * 0.6;
    const x = (ix + jx) * cx, y = (iy + jy) * cy;
    return new THREE.Vector3(x, y, cliffZ(x, y, seed));
  };
  const colorAt = (x, y, k) => {
    if (top && y > -1.1) return PAL.grass[mod(k, 3)];
    const band = Math.floor((y + noise2(x * 0.05, y * 0.05, seed + 11) * 7) / 3.1);
    const n = PAL.strata.length;
    return PAL.strata[mod(Math.floor(hash2(band, 3, seed) * n) + (hash2(k, band, seed) < 0.16 ? 1 : 0), n)];
  };
  for (let j = 0; j < 20; j++) {
    const iy = iy0 - j;
    let a = vert(-nx, iy), d = vert(-nx, iy - 1);
    for (let ix = -nx; ix < nx; ix++) {
      const bb = vert(ix + 1, iy), c = vert(ix + 1, iy - 1);
      const k = ix * 7 + iy * 13;
      if (hash2(ix, iy, seed + 5) < 0.5) { b.tri(a, d, bb, colorAt(a.x, (a.y + d.y) / 2, k)); b.tri(bb, d, c, colorAt(c.x, (bb.y + c.y) / 2, k + 1)); }
      else { b.tri(a, d, c, colorAt(a.x, (a.y + d.y) / 2, k)); b.tri(a, c, bb, colorAt(c.x, (bb.y + c.y) / 2, k + 1)); }
      a = bb; d = c;
    }
  }
}
function pine(b, x, y, z, s, rng) {
  b.cyl(0.14 * s, 0.9 * s, PAL.woodDark, x, y + 0.45 * s, z);
  const g = [0x4fb86a, 0x3fa65c, 0x62c97a];
  for (let i = 0; i < 3; i++) b.cone((0.85 - i * 0.2) * s, 1.1 * s, g[(i + (rng.int(0, 2))) % 3], x, y + (1.2 + i * 0.65) * s, z);
}
function cliffDecor(b, S, seed) {
  const { rng, yTop, yFloor } = S, zAt = (x, y) => cliffZ(x, y, seed);
  const rx = () => rng.range(-W + 2, W - 2), ry = () => rng.range(yFloor + 1.5, yTop - 1.5);
  for (let i = 0; i < 26; i++) { // moss
    const x = rx(), y = ry(), r = rng.range(0.6, 1.7);
    b.sph(r, rng.pick(PAL.moss), x, y, zAt(x, y) - 0.02, 1, rng.range(0.5, 0.9), 0.16);
    if (rng.chance(0.5)) b.sph(r * 0.6, rng.pick(PAL.moss), x + r * 0.7, y - r * 0.3, zAt(x + r * 0.7, y - r * 0.3), 1, 0.7, 0.18);
  }
  for (let i = 0; i < 16; i++) { // cracks
    let x = rx(), y = ry(), a = rng.range(-2.2, -0.9);
    for (let k = 0; k < rng.int(3, 6); k++) {
      const len = rng.range(0.5, 1.1), x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      b.box(len + 0.05, rng.range(0.06, 0.12), 0.1, PAL.crack, (x + x2) / 2, (y + y2) / 2, zAt((x + x2) / 2, (y + y2) / 2) + 0.03, 0, 0, a);
      x = x2; y = y2; a += rng.range(-0.9, 0.9);
    }
  }
  for (let i = 0; i < 5; i++) { // caves, some with something looking back at you
    const x = rx(), y = ry(), r = rng.range(0.8, 1.3), z = zAt(x, y);
    b.sph(r, PAL.cave, x, y, z, 1.2, 0.85, 0.2);
    for (let k = 0; k < 6; k++) { const a = Math.PI * (k / 5); b.rock(r * 0.32, rng.pick(PAL.rock), x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 0.85, z + 0.1, rng.int(0, 7)); }
    if (rng.chance(0.6)) for (const s of [-1, 1]) { b.sph(0.13, 0xfff7b0, x + s * 0.2, y - 0.05, z + 0.2, 1, 1.2, 0.5); b.sph(0.06, 0x222222, x + s * 0.2, y - 0.05, z + 0.27, 1, 1.4, 0.5); }
  }
  for (let i = 0; i < 22; i++) { // bushes + flowers
    const x = rx(), y = ry(), z = zAt(x, y);
    for (let k = 0; k < 3; k++) b.sph(rng.range(0.3, 0.55), rng.pick(PAL.grass), x + (k - 1) * 0.4, y + rng.range(-0.1, 0.2), z + 0.15, 1, 0.85, 0.6);
    if (rng.chance(0.5)) for (let k = 0; k < 3; k++) b.sph(0.1, rng.pick(PAL.flowers), x + rng.range(-0.5, 0.5), y + rng.range(0, 0.35), z + 0.42);
  }
  for (let i = 0; i < 12; i++) { // hanging vines
    const x = rx(), y0 = ry(), n = rng.int(4, 10);
    for (let k = 0; k < n; k++) {
      const y = y0 - k * 0.42, xx = x + Math.sin(k * 0.9 + i) * 0.14, z = zAt(xx, y) + 0.08;
      b.box(0.07, 0.46, 0.06, 0x4fae4a, xx, y, z);
      if (k % 2) b.sph(0.14, rng.pick(PAL.moss), xx + (k % 4 === 1 ? 0.14 : -0.14), y, z + 0.03, 1, 0.6, 0.4);
    }
  }
  for (let i = 0; i < 40; i++) { const x = rx(), y = ry(); b.rock(rng.range(0.15, 0.4), rng.pick(PAL.rock), x, y, zAt(x, y) + 0.05, rng.int(0, 7), 1, 1, 0.6); }
  for (let i = 0; i < 10; i++) { // mushrooms
    const x = rx(), y = ry(), z = zAt(x, y) + 0.2;
    b.cyl(0.06, 0.3, 0xfff1d6, x, y, z, HP); b.sph(0.18, rng.pick([0xff4757, 0xffa94d, 0xb48cff]), x, y, z + 0.18, 1, 1, 0.6);
  }
  // waterfall ribbon somewhere off to the side
  if (rng.chance(0.7)) {
    const x = rng.sign() * rng.range(11, 30), w = rng.range(1.2, 2.2);
    for (let y = yTop; y > yFloor; y -= 1.3) { b.box(w, 1.34, 0.12, 0x8fdcff, x, y - 0.65, zAt(x, y - 0.65) + 0.3); b.box(w * 0.3, 1.34, 0.14, 0xe4f7ff, x + Math.sin(y) * w * 0.25, y - 0.65, zAt(x, y - 0.65) + 0.32); }
  }
  // big stuff off to the sides (outside the play lane)
  b = S.batch;
  for (let i = 0; i < 16; i++) {
    const x = rng.sign() * rng.range(9, W - 3), y = ry(), z = zAt(x, y), r = rng.range(0.9, 1.9);
    if (rng.chance(0.45)) {
      b.rock(r, rng.pick(PAL.rock), x, y, z + 0.6, rng.int(0, 7), 1.5, 0.5, 1.6);
      b.box(r * 2.2, 0.12, 2.2, rng.pick(PAL.grass), x, y + r * 0.42, z + 1.0);
      pine(b, x + rng.range(-0.5, 0.5), y + r * 0.45, z + 1.2, rng.range(0.8, 1.4), rng);
    } else b.rock(r, rng.pick(PAL.rock), x, y, z + 0.4, rng.int(0, 7), 1, 0.9, 1.3);
  }
}

// ------------------------------------------------------------------ buildings
const ROWS = 6, RP = H / ROWS, COLP = 3.25, WW = 1.8, WH = 2.4;
function windowScene(b, S, x, y, zf, rng, live) {
  const trim = PAL.trim, zb = zf - 1.5, yb = y - WH / 2;
  // frame + sill
  b.box(WW + 0.3, 0.14, 0.16, trim, x, y + WH / 2 + 0.07, zf + 0.02); b.box(WW + 0.44, 0.16, 0.34, trim, x, yb - 0.08, zf + 0.1);
  b.box(0.14, WH, 0.16, trim, x - WW / 2 - 0.07, y, zf + 0.02); b.box(0.14, WH, 0.16, trim, x + WW / 2 + 0.07, y, zf + 0.02);
  const type = rng.weighted([['room', 0.38], ['blinds', 0.27], ['dark', 0.17], ['curtain', 0.18]]);
  const addNpc = (silhouette, z) => {
    const n = makeNpc(rng, x, yb + 0.1, z, { silhouette, s: silhouette ? 1.25 : 1.2 });
    S.group.add(n.group);
    S.anims.push(n.update);
  };
  if (type === 'room') {
    const wall = rng.pick(PAL.room);
    b.box(WW, WH, 0.1, wall, x, y, zb); b.box(WW, 0.1, 1.2, 0xc49a6c, x, yb + 0.05, zf - 0.9);
    b.box(WW, 0.5, 0.1, 0xffffff, x, yb + 0.25, zb + 0.06);
    // a busy neighbour gets the room to themselves; empty rooms get furniture instead
    if (live && rng.chance(0.62)) addNpc(false, zf - 0.85);
    else {
      const f = rng.int(0, 3);
      if (f === 0) { b.box(0.6, 0.5, 0.06, 0xffffff, x - 0.4, y + 0.5, zb + 0.08); b.box(0.48, 0.38, 0.07, rng.pick(PAL.cloth), x - 0.4, y + 0.5, zb + 0.1); }
      else if (f === 1) { b.cyl(0.04, 1.3, 0x6b7280, x + 0.55, yb + 0.65, zb + 0.4); b.cone(0.26, 0.3, 0xffe066, x + 0.55, yb + 1.4, zb + 0.4); }
      else if (f === 2) { b.cyl(0.16, 0.3, 0xd9774a, x - 0.55, yb + 0.2, zb + 0.4, Math.PI); b.sph(0.3, PAL.grass[1], x - 0.55, yb + 0.65, zb + 0.4, 1, 1.3, 1); }
      else { b.box(1.1, 0.08, 0.3, 0xa26c3f, x, y + 0.6, zb + 0.2); for (let i = 0; i < 4; i++) b.box(0.12, 0.3, 0.2, rng.pick(PAL.cloth), x - 0.4 + i * 0.22, y + 0.8, zb + 0.2); }
      if (rng.chance(0.3)) { b.box(0.9, 0.55, 0.08, 0x23263a, x + 0.2, yb + 0.9, zb + 0.3); b.box(0.8, 0.45, 0.09, rng.pick([0x7fd3ff, 0xffa3c4, 0xb8ffb0]), x + 0.2, yb + 0.9, zb + 0.31); }
    }
    const cur = rng.pick(PAL.cloth);
    b.box(0.22, WH, 0.08, cur, x - WW / 2 + 0.11, y, zf - 0.3); b.box(0.22, WH, 0.08, cur, x + WW / 2 - 0.11, y, zf - 0.3);
  } else if (type === 'blinds') {
    b.box(WW, WH, 0.06, 0xfff6e0, x, y, zf - 0.3);
    for (let i = 0; i < 8; i++) b.box(WW, 0.04, 0.07, 0xe6d6b0, x, yb + 0.15 + i * 0.3, zf - 0.29);
    if (live && rng.chance(0.55)) addNpc(true, zf - 0.24);
  } else if (type === 'dark') {
    b.box(WW, WH, 0.06, 0x4f7bb8, x, y, zf - 0.3);
    b.box(0.3, WH * 1.1, 0.07, 0x86b1e6, x - 0.3, y, zf - 0.29, 0, 0, -0.45); b.box(0.12, WH * 1.1, 0.07, 0x86b1e6, x + 0.2, y, zf - 0.29, 0, 0, -0.45);
    b.box(0.07, WH, 0.1, trim, x, y, zf - 0.26); b.box(WW, 0.07, 0.1, trim, x, y + 0.2, zf - 0.26);
  } else {
    const cur = rng.pick(PAL.cloth);
    b.box(WW, WH, 0.06, rng.pick(PAL.room), x, y, zf - 0.6);
    for (let i = 0; i < 6; i++) { if (i === 2 || i === 3) continue; b.box(WW / 6 + 0.02, WH, 0.08 + (i % 2) * 0.05, cur, x - WW / 2 + (i + 0.5) * (WW / 6), y, zf - 0.3); }
    if (rng.chance(0.4)) { const c = rng.pick([0x3b3b3b, 0xf2a65a, 0xffffff, 0x8d8d8d]); b.sph(0.2, c, x, yb + 0.2, zf + 0.05, 1.3, 0.9, 0.8); b.sph(0.14, c, x + 0.22, yb + 0.42, zf + 0.05); b.cone(0.05, 0.1, c, x + 0.16, yb + 0.57, zf + 0.05); b.cone(0.05, 0.1, c, x + 0.28, yb + 0.57, zf + 0.05); b.box(0.06, 0.3, 0.06, c, x - 0.3, yb + 0.3, zf + 0.05, 0, 0, 0.5); }
  }
  if (rng.chance(0.22)) { const c = rng.pick([0x4a9d7c, 0xd9534f, 0x3d6fb8, 0x8a5fbf]); for (const s of [-1, 1]) { b.box(0.5, WH, 0.08, c, x + s * (WW / 2 + 0.4), y, zf + 0.04); for (let i = 0; i < 5; i++) b.box(0.4, 0.05, 0.1, 0xffffff, x + s * (WW / 2 + 0.4), yb + 0.3 + i * 0.45, zf + 0.05); } }
  if (rng.chance(0.3)) { b.box(WW + 0.3, 0.3, 0.4, 0x8a5a3c, x, yb - 0.02, zf + 0.34); for (let i = 0; i < 5; i++) { b.sph(0.17, rng.pick(PAL.grass), x - 0.7 + i * 0.35, yb + 0.2, zf + 0.34); if (i % 2) flower(b, x - 0.7 + i * 0.35, yb + 0.22, zf + 0.4, rng); } }
}
function facade(b, S, x0, x1, zf, color, rng, live) {
  const { yTop } = S, w = x1 - x0, xc = (x0 + x1) / 2;
  const n = Math.floor((w - 1.2) / COLP), start = xc - ((n - 1) * COLP) / 2;
  const dark = new THREE.Color(color).multiplyScalar(0.9).getHex();
  b.box(w, H, 0.1, 0x2b2d42, xc, yTop - H / 2, zf - 1.9);
  for (let j = 0; j < ROWS; j++) {
    const base = yTop - (j + 1) * RP, wy = base + 0.95 + WH / 2;
    b.box(w, 0.95, 0.4, color, xc, base + 0.475, zf - 0.2);
    b.box(w, RP - 0.95 - WH, 0.4, color, xc, base + 0.95 + WH + (RP - 0.95 - WH) / 2, zf - 0.2);
    b.box(w + 0.1, 0.16, 0.16, PAL.trim, xc, base + 0.02, zf + 0.04);
    for (let k = 0; k <= n; k++) {
      const l = k === 0 ? x0 : start + (k - 1) * COLP + WW / 2, r = k === n ? x1 : start + k * COLP - WW / 2;
      b.box(r - l, WH, 0.4, color, (l + r) / 2, wy, zf - 0.2);
      if (rng.chance(0.22)) for (let q = 0; q < 3; q++) b.box(0.5, 0.2, 0.03, dark, (l + r) / 2 + rng.range(-0.3, 0.3) * (r - l - 0.6), wy + rng.range(-1, 1), zf + 0.005);
    }
    for (let k = 0; k < n; k++) windowScene(b, S, start + k * COLP, wy, zf, rng, live && Math.abs(start + k * COLP) < 16);
  }
  return { start, n };
}
function buildingWall(b, S, runSeed) {
  const r = new RNG(runSeed), cols = [...PAL.facades];
  const pick = () => cols.splice(r.int(0, cols.length - 1), 1)[0];
  const cMid = pick(), cL = pick(), cR = pick();
  const pipes = [r.int(-4, -1), r.int(1, 4)].map((k) => (k + 0.5) * COLP);
  const { rng, yTop } = S;
  facade(b, S, -14.8, 14.8, 0, cMid, rng, true);
  facade(b, S, -W, -14.8, -2.2, cL, rng, true);
  facade(b, S, 14.8, W, -1.3, cR, rng, true);
  for (const s of [-1, 1]) b.box(0.4, H, 2.8, cMid, s * 14.6, yTop - H / 2, -1.8);
  for (const x of pipes) { b.cyl(0.1, H, PAL.metal, x, yTop - H / 2, 0.14); for (let j = 0; j < ROWS; j++) b.box(0.3, 0.1, 0.24, PAL.metalDark, x, yTop - j * RP - 1.2, 0.12); }
  // ivy creeping over a stretch of wall
  for (let i = 0; i < 3; i++) { const x = rng.range(-W + 3, W - 3), y = rng.range(yTop - H + 3, yTop - 3), zf = x < -14.8 ? -2.2 : x > 14.8 ? -1.3 : 0; for (let k = 0; k < 14; k++) b.sph(rng.range(0.25, 0.5), rng.pick(PAL.moss), x + rng.range(-1.2, 1.2), y + rng.range(-2, 2), zf + 0.03, 1, 1, 0.25); }
}

// ------------------------------------------------------------------ floors (with the opening)
function floorSlab(b, type, x0, x1, y, rng) {
  if (x1 - x0 < 0.2) return;
  const len = x1 - x0, xc = (x0 + x1) / 2;
  if (type === 'shelf') {
    const col = PAL.rock[0];
    b.box(len, 0.7, 3.2, col, xc, y - 0.42, 1.6);
    b.box(len, 0.12, 3.3, PAL.grass[0], xc, y - 0.06, 1.65);
    for (let x = x0 + 0.8; x < x1 - 0.5; x += rng.range(1.6, 2.6)) {
      b.rock(rng.range(0.6, 0.95), rng.pick(PAL.rock), x, y - 0.75, rng.range(1.6, 2.8), rng.int(0, 7), 1.4, 0.55, 0.9);
      if (rng.chance(0.6)) b.sph(rng.range(0.15, 0.28), rng.pick(PAL.grass), x + 0.6, y + 0.02, rng.range(0.4, 3), 1, 0.8, 1);
      if (rng.chance(0.25) && Math.abs(x) > 7.5) pine(b, x, y, rng.range(0.6, 1.4), rng.range(0.7, 1.2), rng);
      if (rng.chance(0.3)) flower(b, x + 0.3, y, rng.range(0.4, 3), rng, 1.2);
    }
    for (const xe of [x0, x1]) if (Math.abs(xe) < W - 1) b.rock(0.5, PAL.rockDark, xe, y - 0.4, 1.6, rng.int(0, 7), 0.5, 0.8, 2.6);
  } else if (type === 'balcony') {
    b.box(len, 0.3, 3.1, PAL.slab, xc, y - 0.15, 1.55);
    b.box(len, 0.16, 0.12, 0xffffff, xc, y - 0.2, 3.12);
    for (let x = Math.ceil(x0 / COLP) * COLP + COLP / 2; x < x1; x += COLP) if (x > x0 + 0.2 && x < x1 - 0.2) b.box(0.16, 0.6, 2.0, 0xd5cfe0, x, y - 0.5, 1.0, 0.45);
    railing(b, x0 + 0.08, x1 - 0.08, y, 3.02, 0.85);
    for (let x = x0 + 1; x < x1 - 1; x += rng.range(2.5, 6)) if (rng.chance(0.6) && Math.abs(x) > 7.5) { b.cyl(0.22, 0.34, 0xd9774a, x, y + 0.17, 0.6, Math.PI); b.sph(0.34, rng.pick(PAL.grass), x, y + 0.6, 0.6, 1, 1.2, 1); }
  } else if (type === 'roof') {
    b.box(len, 0.6, 3.4, PAL.roofTile, xc, y - 0.3, 1.7);
    b.box(len, 0.24, 3.6, 0xffffff, xc, y - 0.7, 1.75);
    for (let z = 0.4; z < 3.3; z += 0.55) b.box(len, 0.06, 0.1, 0xcf6549, xc, y + 0.0, z);
    for (let x = x0 + 2; x < x1 - 2; x += rng.range(5, 9)) if (Math.abs(x) > 8) { b.box(0.7, 1.2, 0.7, 0xd98a6a, x, y + 0.6, 0.7); b.box(0.9, 0.16, 0.9, 0xffffff, x, y + 1.25, 0.7); }
  } else {
    b.box(len, 0.5, 3.4, PAL.street, xc, y - 0.25, 1.7);
    b.box(len, 0.24, 0.3, 0xe9ecf2, xc, y - 0.09, 3.32);
    b.box(len, 0.5, 3.5, 0x8a6a4f, xc, y - 0.75, 1.7); b.box(len, 0.14, 3.6, PAL.grass[1], xc, y - 0.5, 1.75);
    railing(b, x0 + 0.08, x1 - 0.08, y, 3.1, 0.8, 0x3d6b4f);
    for (let x = x0 + 2; x < x1 - 2; x += rng.range(5, 9)) if (Math.abs(x) > 8) {
      if (rng.chance(0.5)) { b.cyl(0.14, 0.5, 0xff4757, x, y + 0.25, 1.2); b.sph(0.16, 0xff4757, x, y + 0.52, 1.2); }
      else { b.cyl(0.08, 3.2, PAL.metalDark, x, y + 1.6, 0.8); b.sph(0.26, 0xfff3cf, x, y + 3.3, 0.8); }
    }
  }
}
function buildFloor(b, S) {
  const f = S.floor, rng = S.rng;
  if (!f) return;
  floorSlab(b, f.type, -W, f.open.x - f.open.hw, f.y, rng);
  floorSlab(b, f.type, f.open.x + f.open.hw, W, f.y, rng);
}

// ------------------------------------------------------------------ the summit / rooftop
function buildTop(b, group, biome, rng) {
  const cloudB = new Batch();
  for (let i = 0; i < 16; i++) {
    const x = rng.range(-110, 110), y = rng.range(4, 42), z = rng.range(-150, -60), s = rng.range(2.5, 6);
    for (let k = 0; k < 5; k++) cloudB.sph(s * rng.range(0.6, 1), 0xffffff, x + (k - 2) * s * 0.75, y + rng.range(-0.2, 0.3) * s, z, 1.2, 0.7, 0.8);
  }
  const clouds = cloudB.build({ shadow: false, receive: false, material: new THREE.MeshBasicMaterial({ vertexColors: true }) });
  group.add(clouds);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(9, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff3a0 }));
  sun.position.set(-48, 44, -190);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(14, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff7c9, transparent: true, opacity: 0.35 }));
  halo.position.copy(sun.position);
  group.add(sun, halo);

  if (biome === 'cliff') {
    b.box(W * 2, 1.0, 71, PAL.grass[0], 0, -0.5, -34.9);
    for (let i = 0; i < 40; i++) b.box(rng.range(2, 6), 0.05, rng.range(1.5, 5), PAL.grass[rng.int(1, 2)], rng.range(-W, W), 0.0 + i * 0.0015, rng.range(-30, -1.5)); // staggered heights: no two patches share a plane
    // the outcrop the faller stands on
    b.rock(1.35, PAL.rock[1], 0, -0.98, 1.2, 2, 0.95, 0.42, 1.35); // kept well below the turf so it can't poke through
    b.box(2.4, 0.5, 2.9, PAL.rock[0], 0, -0.3, 1.35); b.box(2.46, 0.14, 2.95, PAL.grass[2], 0, -0.045, 1.36); // turf tops out 2.5cm above the plateau so the two never share a plane
    b.rock(0.5, PAL.rockDark, -0.8, -0.8, 1.8, 5); b.rock(0.4, PAL.rock[2], 0.9, -0.7, 0.9, 1);
    for (let i = 0; i < 26; i++) { const x = rng.range(-W, W), z = rng.range(-34, -3); if (Math.abs(x) < 4 && z > -9) continue; pine(b, x, 0, z, rng.range(1.3, 2.8), rng); }
    for (let i = 0; i < 14; i++) b.rock(rng.range(0.4, 1.3), rng.pick(PAL.rock), rng.range(-W, W), 0.2, rng.range(-20, -1), rng.int(0, 7), 1, 0.8, 1);
    for (let i = 0; i < 60; i++) flower(b, rng.range(-18, 18), 0, rng.range(-7, -0.2), rng, 1.3);
    for (let i = 0; i < 22; i++) b.sph(rng.range(0.3, 0.6), rng.pick(PAL.grass), rng.range(-W, W), 0.15, rng.range(-10, 0.2), 1, 0.8, 1);
    for (let x = -W; x < W; x += 2.4) if (Math.abs(x) > 3.2) { b.box(0.14, 0.9, 0.14, PAL.wood[1], x, 0.45, -0.5); b.box(2.4, 0.1, 0.08, PAL.wood[0], x + 1.2, 0.72, -0.5); b.box(2.4, 0.1, 0.08, PAL.wood[0], x + 1.2, 0.4, -0.5); }
    for (let i = 0; i < 7; i++) { const x = -150 + i * 50 + rng.range(-12, 12), r = rng.range(34, 60); b.sph(r, [0x8fd9a0, 0x7fcfa6, 0xa3e2b0][i % 3], x, -r * 0.45, rng.range(-150, -95), 1.4, 0.75, 0.7); }
    for (let i = 0; i < 6; i++) { const x = -160 + i * 62 + rng.range(-15, 15), h = rng.range(55, 90), z = rng.range(-240, -200); b.cone(h * 0.6, h, 0xa9bfe6, x, h / 2 - 22, z); b.cone(h * 0.2, h * 0.34, 0xffffff, x, h * 0.84 - 22, z); }
  } else {
    b.box(29.6, 0.5, 29.8, 0xcfd3e6, 0, -0.25, -15.3);
    for (const [x0, x1] of [[-14.8, -1.35], [1.35, 14.8]]) { b.box(x1 - x0, 0.55, 0.35, 0xffffff, (x0 + x1) / 2, 0.27, -0.2); b.box(x1 - x0, 0.1, 0.45, 0xe1ddea, (x0 + x1) / 2, 0.58, -0.2); }
    for (const s of [-1, 1]) b.box(0.35, 0.55, 30, 0xffffff, s * 14.6, 0.27, -15.2);
    // diving board
    b.box(2.4, 0.14, 4.4, PAL.wood[2], 0, -0.045, 0.4); b.box(2.5, 0.2, 0.3, PAL.metalDark, 0, -0.24, -0.3);
    for (const s of [-1, 1]) b.box(0.12, 0.12, 2.9, PAL.metalDark, s * 0.9, -0.55, 1.0, -0.33);
    for (let i = 0; i < 6; i++) b.box(0.405, 0.16, 0.3, i % 2 ? 0x23263a : 0xffd23f, (-1.0 + i * 0.4) * 1.0125, -0.045, 2.47);
    // neighbouring roofs, a little taller
    for (const [x0, x1, zf, h, c] of [[-W, -14.8, -2.2, 4.2, 0xe6c9b8], [14.8, W, -1.3, 2.4, 0xc9d6ee]]) {
      b.box(x1 - x0, h, 0.4, c, (x0 + x1) / 2, h / 2, zf - 0.2); b.box(x1 - x0, 0.3, 30, 0xcfd3e6, (x0 + x1) / 2, h - 0.15, zf - 15.4);
      b.box(x1 - x0 + 0.2, 0.3, 0.6, 0xffffff, (x0 + x1) / 2, h + 0.1, zf - 0.2);
      for (let x = x0 + 2.5; x < x1 - 1.5; x += COLP) { b.box(1.4, Math.min(1.6, h - 1.2), 0.1, 0x4f7bb8, x, h / 2, zf + 0.02); b.box(1.6, 0.12, 0.2, 0xffffff, x, h / 2 - Math.min(1.6, h - 1.2) / 2, zf + 0.05); }
    }
    // rooftop clutter
    const tank = (x, z, h0) => { for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) b.box(0.14, 1.6, 0.14, PAL.metalDark, x + dx, h0 + 0.8, z + dz); b.cyl(1.3, 2.1, 0xc98b62, x, h0 + 2.65, z); b.cone(1.5, 0.9, 0x8a5a3c, x, h0 + 4.15, z); b.cyl(1.33, 0.12, 0x6b4a3a, x, h0 + 2.2, z); b.cyl(1.33, 0.12, 0x6b4a3a, x, h0 + 3.2, z); };
    tank(-6, -6.5, 0); tank(24, -8, 2.4);
    b.box(3, 2.6, 3, 0xffb3b3, 6, 1.3, -7); b.box(3.3, 0.2, 3.3, 0xffffff, 6, 2.7, -7); b.box(1, 1.9, 0.1, 0x6b8fb8, 6, 0.95, -5.45); b.sph(0.07, PAL.gold, 6.3, 0.95, -5.38);
    b.cyl(0.06, 2.4, 0xffffff, -2.9, 1.2, -4); b.cone(1.5, 0.7, 0xff5d8f, -2.9, 2.6, -4); b.box(1.5, 0.12, 0.6, 0x5a9bff, -2.9, 0.4, -3.2); b.box(0.6, 0.5, 0.12, 0x5a9bff, -3.5, 0.65, -3.2, 0, 0, 0.3);
    for (let i = 0; i < 5; i++) { const x = rng.range(-13, 13), z = rng.range(-12, -3); if (Math.abs(x) < 3) continue; b.box(1.3, 0.9, 1, 0xeef1f6, x, 0.45, z); b.cyl(0.3, 0.06, 0x4b5368, x, 0.92, z); }
    b.cyl(0.06, 5, PAL.metalDark, 4.5, 2.5, -9); for (let i = 0; i < 4; i++) b.box(1.6 - i * 0.3, 0.06, 0.06, PAL.metalDark, 4.5, 3.2 + i * 0.5, -9);
    b.cyl(0.06, 4, PAL.metalDark, -30, 6, -6); b.sph(0.9, 0xf4f6fb, -27, 5.2, -5, 1, 1, 0.3);
    for (const x of [-6, 6]) b.cyl(0.07, 2.6, PAL.wood[1], x, 1.3, -2.6);
    for (let i = 0; i < 4; i++) { const x = 2.2 + i * 0.55; b.sph(0.17, 0x9aa4b8, x, 0.78, -0.2, 1.3, 0.9, 0.9); b.sph(0.1, 0x7d87a0, x + 0.2, 0.94, -0.2); b.cone(0.04, 0.1, 0xffa94d, x + 0.32, 0.93, -0.2, 0, 0, -HP); }
    for (let i = 0; i <= 14; i++) { const u = i / 14, x = -6 + u * 12; b.sph(0.13, [0xffd23f, 0xff6b6b, 0x4ecdc4, 0xb48cff][i % 4], x, 2.5 - 0.7 * (1 - (2 * u - 1) ** 2), -2.6); }
    for (let i = 0; i < 6; i++) { const x = rng.range(-13.5, 13.5); if (Math.abs(x) < 2.5) continue; b.cyl(0.3, 0.45, 0xd9774a, x, 0.22, -1.2, Math.PI); b.sph(0.5, rng.pick(PAL.grass), x, 0.85, -1.2, 1, 1.2, 1); flower(b, x + 0.2, 1.0, -1.0, rng, 1.6); }
    for (let i = 0; i < 28; i++) { const x = -170 + i * 13 + rng.range(-3, 3), h = rng.range(30, 85), w = rng.range(8, 14), z = rng.range(-170, -80); b.box(w, h, w, [0xb9c8f2, 0xd4c3f5, 0xa9d8f0, 0xf5c9d8][i % 4], x, h / 2 - 50, z); }
  }
  return { clouds };
}

// ------------------------------------------------------------------ chunk assembly
// S: { index, biome, yTop, yFloor, floor, objects }. ctx: { fx, sfx, decorSeed, runSeed, top }
export function buildChunk(S, ctx) {
  // b: things that stick out (cast shadows). flat: the wall and its surface detail (only receives them).
  const group = new THREE.Group(), b = new Batch(), flat = new Batch(), rng = new RNG(ctx.decorSeed + S.index * 1013);
  const C = { ...S, group, batch: b, rng, fx: ctx.fx, sfx: ctx.sfx, anims: [] };
  if (S.biome === 'cliff') { cliffWall(flat, S.yTop, ctx.decorSeed, S.index === 0); cliffDecor(flat, C, ctx.decorSeed); }
  else buildingWall(flat, C, ctx.runSeed);
  let extras = null;
  if (S.index === 0) extras = buildTop(b, group, S.biome, new RNG(ctx.decorSeed + 5));
  buildFloor(b, C);
  const handles = new Map();
  for (const o of S.objects || []) { const h = buildObject(o, C); if (h) handles.set(o.id, h); }
  // purely decorative protrusions out wide, so widescreen views are just as busy as the play lane
  if (S.floor) {
    const kinds = Object.keys(KINDS).filter((k) => KINDS[k].biome === S.biome && (KINDS[k].mode === 'peg' || KINDS[k].mode === 'plat'));
    for (let i = 0; i < 22; i++) {
      const kind = rng.pick(kinds), K = KINDS[kind], x = rng.sign() * rng.range(9.5, W - 6), y = rng.range(S.yFloor + 3, S.yTop - 3);
      const zf = S.biome === 'building' ? (x < -14.8 ? -2.2 : x > 14.8 ? -1.3 : 0) : 0;
      const o = K.mode === 'peg' ? { kind, x, y, r: rng.range(K.r[0], K.r[1]) } : { kind, x, y, hw: rng.range(1, 1.4), topper: rng.weighted(K.toppers) };
      const sub = { ...C, group: new THREE.Group() };
      sub.group.position.z = zf; group.add(sub.group);
      if (K.mode === 'plat') { const bb = new Batch(); sub.batch = bb; const h = buildObject(o, sub); sub.group.add(bb.build()); if (h && h.update) C.anims.push((t, dt) => h.update(t, dt)); }
      else buildObject(o, sub);
    }
  }
  group.add(b.build(), flat.build({ shadow: false }));
  const updaters = [...C.anims];
  for (const h of handles.values()) if (h.update) updaters.push((t, dt) => h.update(t, dt));
  return { group, handles, updaters, extras };
}
export { labelTexture };
