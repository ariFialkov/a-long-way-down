// The faller. The torso centre is driven along the planned path; everything else (torso rotation,
// head, arms, legs) is a verlet ragdoll dragged along by it and colliding with the scenery, so the
// result is exact while the body still flops, whips and tumbles like a physics toy.
import * as THREE from 'three';
import { CFG } from './config.js';
import { sharedMaterial } from './world/batch.js';

const POSE = {
  pelvis: [0, 0.82, 0], neck: [0, 1.42, 0], shL: [-0.27, 1.38, 0], shR: [0.27, 1.38, 0], head: [0, 1.75, 0],
  elL: [-0.37, 1.08, 0.03], haL: [-0.4, 0.8, 0.1], elR: [0.37, 1.08, 0.03], haR: [0.4, 0.8, 0.1],
  knL: [-0.13, 0.43, 0.04], ftL: [-0.14, 0.05, 0.02], knR: [0.13, 0.43, 0.04], ftR: [0.14, 0.05, 0.02],
};
const NAMES = Object.keys(POSE);
const TORSO = ['pelvis', 'neck', 'shL', 'shR'];
const RAD = { head: 0.26, pelvis: 0.16, neck: 0.12, shL: 0.12, shR: 0.12 };
const EQ = [
  ['pelvis', 'neck'], ['pelvis', 'shL'], ['pelvis', 'shR'], ['neck', 'shL'], ['neck', 'shR'], ['shL', 'shR'],
  ['neck', 'head'], ['shL', 'elL'], ['elL', 'haL'], ['shR', 'elR'], ['elR', 'haR'],
  ['pelvis', 'knL'], ['knL', 'ftL'], ['pelvis', 'knR'], ['knR', 'ftR'],
];
// [a, b, min, max] soft joint limits, as fractions of the rest-pose distance (0 = unused)
const LIM = [
  ['head', 'pelvis', 0.92, 0], ['head', 'shL', 0.85, 0], ['head', 'shR', 0.85, 0],
  ['haL', 'shL', 0.45, 0], ['haR', 'shR', 0.45, 0], ['ftL', 'pelvis', 0.6, 0], ['ftR', 'pelvis', 0.6, 0],
  ['knL', 'knR', 0.7, 3.2], ['ftL', 'ftR', 0.6, 4.5], ['knL', 'neck', 0.55, 0], ['knR', 'neck', 0.55, 0],
  ['elL', 'pelvis', 0.5, 0], ['elR', 'pelvis', 0.5, 0], ['haL', 'head', 0.3, 0], ['haR', 'head', 0.3, 0],
];
const SUIT = 0x2f6bff, SUIT2 = 0xffffff, SKIN = 0xffd2b0, HELMET = 0xffc93c, SHOE = 0xff4757;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0), _col = new THREE.Color(), HALF = Math.PI / 2;

export class Ragdoll {
  constructor(scene) {
    this.p = {};
    for (const n of NAMES) {
      const [x, y, z] = POSE[n];
      this.p[n] = { x, y, z, px: x, py: y, pz: z, r: RAD[n] || 0.1, torso: TORSO.includes(n) };
    }
    this.list = NAMES.map((n) => this.p[n]);
    const dist = (a, b) => Math.hypot(POSE[a][0] - POSE[b][0], POSE[a][1] - POSE[b][1], POSE[a][2] - POSE[b][2]);
    this.eq = EQ.map(([a, b]) => [this.p[a], this.p[b], dist(a, b)]);
    this.lim = LIM.map(([a, b, lo, hi]) => [this.p[a], this.p[b], dist(a, b) * lo, hi ? dist(a, b) * hi : 0]);
    this.h = 1 / 120;
    this.time = 0;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildMeshes();
  }
  buildMeshes() {
    const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: sharedMaterial().gradientMap });
    const mats = { suit: toon(SUIT), suit2: toon(SUIT2), skin: toon(SKIN), helmet: toon(HELMET), shoe: toon(SHOE), dark: toon(0x23263a) };
    const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; this.group.add(m); return m; };
    const bone = (a, b, r, mat) => {
      const len = Math.hypot(POSE[a][0] - POSE[b][0], POSE[a][1] - POSE[b][1], POSE[a][2] - POSE[b][2]);
      return { a: this.p[a], b: this.p[b], r, len, mesh: add(new THREE.CapsuleGeometry(r, len, 3, 8), mat) };
    };
    this.bones = [
      bone('shL', 'elL', 0.085, mats.suit), bone('elL', 'haL', 0.075, mats.suit),
      bone('shR', 'elR', 0.085, mats.suit), bone('elR', 'haR', 0.075, mats.suit),
      bone('knL', 'ftL', 0.09, mats.suit), bone('knR', 'ftR', 0.09, mats.suit),
    ];
    // thighs start at a hip offset from the pelvis, so they get their own entries
    this.thighL = add(new THREE.CapsuleGeometry(0.105, 0.36, 3, 8), mats.suit);
    this.thighR = add(new THREE.CapsuleGeometry(0.105, 0.36, 3, 8), mats.suit);
    this.hands = [add(new THREE.SphereGeometry(0.095, 10, 8), mats.skin), add(new THREE.SphereGeometry(0.095, 10, 8), mats.skin)];
    this.feet = [add(new THREE.SphereGeometry(0.12, 10, 8), mats.shoe), add(new THREE.SphereGeometry(0.12, 10, 8), mats.shoe)];
    this.feet.forEach((f) => f.scale.set(1, 0.8, 1.5));
    // torso
    this.torso = new THREE.Group();
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.3, 4, 10), mats.suit);
    chest.scale.set(1.4, 1, 0.95); chest.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.02), mats.suit2);
    stripe.position.z = 0.195;
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.07, 12), mats.dark);
    belt.scale.z = 0.72; belt.position.y = -0.2;
    this.torso.add(chest, stripe, belt);
    this.group.add(this.torso);
    // head
    this.head = new THREE.Group();
    this.skinMat = mats.skin;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), mats.skin);
    skull.castShadow = true;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.285, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), mats.helmet);
    helmet.rotation.x = -0.25; helmet.castShadow = true;
    const hstripe = new THREE.Mesh(new THREE.TorusGeometry(0.287, 0.02, 6, 16, Math.PI), mats.suit2);
    hstripe.rotation.set(0, Math.PI / 2, 0);
    this.head.add(skull, helmet, hstripe);
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff }), black = new THREE.MeshBasicMaterial({ color: 0x1b1d2e });
    this.eyes = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), white);
      e.position.set(s * 0.1, -0.02, 0.225);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), black);
      pu.position.set(0, -0.01, 0.052);
      e.add(pu); this.head.add(e); this.eyes.push(e);
    }
    this.mouth = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), black);
    this.mouth.position.set(0, -0.14, 0.225); this.mouth.scale.set(1, 0.3, 0.4);
    this.head.add(this.mouth);
    this.group.add(this.head);
    // injuries
    this.damage = 0; this.marks = [];
    this.markGeo = new THREE.SphereGeometry(1, 8, 6);
    this.markMats = [0x7b3fa0, 0x5a2a82, 0xc9184a, 0xb00020].map((c) => new THREE.MeshToonMaterial({ color: c, gradientMap: sharedMaterial().gradientMap }));
    this.shiner = new THREE.Mesh(this.markGeo, this.markMats[1]);
    this.shiner.scale.set(0.095, 0.1, 0.03); this.shiner.position.set(-0.1, -0.03, 0.212); this.shiner.visible = false;
    this.lump = new THREE.Mesh(this.markGeo, this.markMats[2]);
    this.lump.scale.set(0.07, 0.06, 0.05); this.lump.position.set(0.13, -0.11, 0.2); this.lump.visible = false;
    this.nose = new THREE.Mesh(this.markGeo, this.markMats[3]);
    this.nose.scale.set(0.025, 0.07, 0.02); this.nose.position.set(0.02, -0.09, 0.25); this.nose.visible = false;
    this.head.add(this.shiner, this.lump, this.nose);
  }
  // Take a knock: k = 0..1. Bruises and cuts accumulate over the fall; the face gets steadily worse.
  hurt(k = 0.5) {
    this.damage += 0.5 + k;
    const n = k > 0.6 ? 2 : 1;
    for (let i = 0; i < n && this.marks.length < 46; i++) {
      const cut = Math.random() < 0.35, m = new THREE.Mesh(this.markGeo, this.markMats[(cut ? 2 : 0) + ((Math.random() * 2) | 0)]);
      const a = Math.random() * Math.PI * 2, size = 0.045 + Math.random() * 0.05 + k * 0.03, pick = Math.random();
      let parent;
      if (pick < 0.22) { // face / head, below the helmet line
        parent = this.head;
        const el = -0.2 - Math.random() * 0.7, az = (Math.random() - 0.5) * 2.6;
        m.position.set(Math.sin(az) * Math.cos(el) * 0.255, Math.sin(el) * 0.255, Math.cos(az) * Math.cos(el) * 0.255);
        m.scale.set(size, size, size * 0.4); m.lookAt(0, 0, 0); m.scale.multiplyScalar(0.8);
      } else if (pick < 0.5) { // torso
        parent = this.torso;
        m.position.set(Math.cos(a) * 0.27, (Math.random() - 0.5) * 0.5, Math.sin(a) * 0.185);
        m.scale.set(size * 1.3, size * 1.3, size * 0.5); m.rotation.y = HALF - a;
      } else { // a limb
        const all = [...this.bones, { mesh: this.thighL, r: 0.105, len: 0.36 }, { mesh: this.thighR, r: 0.105, len: 0.36 }];
        const bn = all[(Math.random() * all.length) | 0];
        parent = bn.mesh;
        m.position.set(Math.cos(a) * bn.r * 0.95, (Math.random() - 0.5) * bn.len, Math.sin(a) * bn.r * 0.95);
        m.scale.set(size, size * 1.2, size * 0.5); m.rotation.y = HALF - a;
      }
      parent.add(m); this.marks.push(m);
    }
    if (this.damage > 2.5) this.shiner.visible = true;
    if (this.damage > 4.5) this.nose.visible = true;
    if (this.damage > 6.5) this.lump.visible = true;
    this.skinMat.color.setHex(SKIN).lerp(_col.setHex(0xe58f86), Math.min(0.55, this.damage * 0.045));
  }
  heal() {
    for (const m of this.marks) m.removeFromParent();
    this.marks.length = 0; this.damage = 0;
    this.shiner.visible = this.lump.visible = this.nose.visible = false;
    this.skinMat.color.setHex(SKIN);
  }

  // Scripted standing pose on the edge (menu). crouch 0..1 = wind-up for the jump.
  setPose(ox, oy, oz, time, crouch = 0) {
    const breathe = Math.sin(time * 2.1) * 0.012, sway = Math.sin(time * 1.3) * 0.02;
    const peek = Math.max(0, Math.sin(time * 0.6)) ** 4; // leans forward for a nervous look down
    for (const n of NAMES) {
      let [x, y, z] = POSE[n];
      const upper = y > 1;
      if (upper) { y += breathe; z += peek * 0.14 * (y - 0.8); y -= peek * 0.03; }
      if (n === 'haL' || n === 'haR') { x += sway * (n === 'haL' ? 1 : -1); z += crouch * -0.35 + peek * 0.1; y += crouch * 0.12; }
      if (n === 'elL' || n === 'elR') z += crouch * -0.18;
      if (n === 'head') { z += peek * 0.08; y -= peek * 0.04; }
      if (y > 0.5) y -= crouch * 0.3 * Math.min(1, (y - 0.4) / 0.4);
      if (upper) z += crouch * 0.16;
      if (n === 'knL' || n === 'knR') z += crouch * 0.26;
      const p = this.p[n];
      p.x = p.px = ox + x; p.y = p.py = oy + y; p.z = p.pz = oz + z;
    }
    this.mouth.scale.set(1, 0.3 + peek * 0.5, 0.4);
    this.sync();
  }
  // Let go: every particle gets the launch velocity (plus a little chaos).
  release(vx, vy) {
    const h = this.h;
    for (const p of this.list) {
      const k = p.torso ? 0 : 1;
      p.px = p.x - (vx + (Math.random() - 0.5) * 3 * k) * h;
      p.py = p.y - (vy + (Math.random() - 0.5) * 3 * k) * h;
      p.pz = p.z - (Math.random() - 0.5) * 2 * k * h;
    }
    this.mouth.scale.set(1.3, 1.5, 0.4);
  }
  // Spin the torso (called on impacts). w in rad/s around the view axis, wobble adds off-axis tumble.
  kick(w, wobble = 0) {
    const h = this.h, c = this.centroid(_a);
    const wx = (Math.random() - 0.5) * wobble, wy = (Math.random() - 0.5) * wobble;
    for (const n of TORSO) {
      const p = this.p[n], rx = p.x - c.x, ry = p.y - c.y, rz = p.z - c.z;
      p.px -= (wy * rz - w * ry) * h; p.py -= (w * rx - wx * rz) * h; p.pz -= (wx * ry - wy * rx) * h;
    }
  }
  // Shove the loose limbs (impact direction).
  jolt(vx, vy, amt = 1) {
    const h = this.h;
    for (const p of this.list) if (!p.torso) {
      p.px -= (vx + (Math.random() - 0.5) * 6) * amt * h;
      p.py -= (vy + (Math.random() - 0.5) * 6) * amt * h;
      p.pz -= (Math.random() - 0.5) * 5 * amt * h;
    }
  }
  centroid(out) {
    let x = 0, y = 0, z = 0;
    for (const n of TORSO) { const p = this.p[n]; x += p.x; y += p.y; z += p.z; }
    return out.set(x / 4, y / 4, z / 4);
  }

  // One fixed physics step. (tx,ty) = planned torso centre. flail 0..1 = panicked limb waving.
  step(tx, ty, solids, flail) {
    const h = this.h, h2 = h * h, G = CFG.G;
    this.time += h;
    const t = this.time;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i], damp = p.torso ? 0.998 : 0.991;
      let ax = 0, ay = -G, az = (CFG.Z0 - p.z) * 14;
      if (flail > 0 && !p.torso && i > 4) {
        const ph = i * 1.7;
        ax += Math.sin(t * 13 + ph) * 55 * flail; ay += Math.cos(t * 11 + ph * 1.3) * 55 * flail; az += Math.sin(t * 9 + ph) * 25 * flail;
      }
      const vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp, vz = (p.z - p.pz) * damp;
      p.px = p.x; p.py = p.y; p.pz = p.z;
      p.x += vx + ax * h2; p.y += vy + ay * h2; p.z += vz + az * h2;
    }
    for (let it = 0; it < 6; it++) {
      for (const [a, b, len] of this.eq) {
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz) || 1e-6, k = ((d - len) / d) * 0.5;
        a.x += dx * k; a.y += dy * k; a.z += dz * k; b.x -= dx * k; b.y -= dy * k; b.z -= dz * k;
      }
      for (const [a, b, lo, hi] of this.lim) {
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz) || 1e-6;
        let k = 0;
        if (d < lo) k = ((d - lo) / d) * 0.25; else if (hi && d > hi) k = ((d - hi) / d) * 0.25; else continue;
        a.x += dx * k; a.y += dy * k; a.z += dz * k; b.x -= dx * k; b.y -= dy * k; b.z -= dz * k;
      }
      if (it % 2 === 1) this.collide(solids);
      // pin: translate the rigid torso so its centre sits exactly on the planned path
      const c = this.centroid(_a), ox = tx - c.x, oy = ty - c.y, oz = CFG.Z0 - c.z;
      for (const n of TORSO) { const p = this.p[n]; p.x += ox; p.y += oy; p.z += oz; }
    }
    for (const p of this.list) { if (p.z < p.r + 0.12) p.z = p.r + 0.12; else if (p.z > 3.1) p.z = 3.1; }
  }
  collide(solids) {
    for (const p of this.list) {
      for (let i = 0; i < solids.length; i++) {
        const s = solids[i];
        if (s.k === 'c') {
          const dx = p.x - s.x, dy = p.y - s.y, rr = s.r + p.r, d2 = dx * dx + dy * dy;
          if (d2 < rr * rr && d2 > 1e-8) {
            const d = Math.sqrt(d2), k = (rr - d) / d;
            p.x += dx * k; p.y += dy * k;
            p.px += (p.x - p.px) * 0.12; p.py += (p.y - p.py) * 0.12;
          }
        } else {
          const x0 = s.x0 - p.r, x1 = s.x1 + p.r, y0 = s.y0 - p.r, y1 = s.y1 + p.r;
          if (p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) {
            const l = p.x - x0, r = x1 - p.x, d = p.y - y0, u = y1 - p.y, m = Math.min(l, r, d, u);
            if (m === u) p.y = y1; else if (m === d) p.y = y0; else if (m === l) p.x = x0; else p.x = x1;
            p.px += (p.x - p.px) * 0.25; p.py += (p.y - p.py) * 0.12; p.pz += (p.z - p.pz) * 0.2;
          }
        }
      }
    }
  }

  setBone(mesh, ax, ay, az, bx, by, bz) {
    mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    _d.set(bx - ax, by - ay, bz - az).normalize();
    mesh.quaternion.setFromUnitVectors(_up, _d);
  }
  sync() {
    const P = this.p;
    for (const b of this.bones) this.setBone(b.mesh, b.a.x, b.a.y, b.a.z, b.b.x, b.b.y, b.b.z);
    // torso frame
    _a.set(P.neck.x - P.pelvis.x, P.neck.y - P.pelvis.y, P.neck.z - P.pelvis.z).normalize(); // up
    _b.set(P.shR.x - P.shL.x, P.shR.y - P.shL.y, P.shR.z - P.shL.z).normalize(); // side
    _c.crossVectors(_b, _a).normalize(); // forward
    _b.crossVectors(_a, _c).normalize();
    _m.makeBasis(_b, _a, _c);
    this.torso.quaternion.setFromRotationMatrix(_m);
    this.torso.position.set((P.neck.x + P.pelvis.x) / 2, (P.neck.y + P.pelvis.y) / 2, (P.neck.z + P.pelvis.z) / 2);
    const hx = _b.x * 0.13, hy = _b.y * 0.13, hz = _b.z * 0.13;
    this.setBone(this.thighL, P.pelvis.x - hx, P.pelvis.y - hy, P.pelvis.z - hz, P.knL.x, P.knL.y, P.knL.z);
    this.setBone(this.thighR, P.pelvis.x + hx, P.pelvis.y + hy, P.pelvis.z + hz, P.knR.x, P.knR.y, P.knR.z);
    // head: up follows the neck, facing follows the chest
    _a.set(P.head.x - P.neck.x, P.head.y - P.neck.y, P.head.z - P.neck.z).normalize();
    _b.crossVectors(_a, _c).normalize();
    _d.crossVectors(_b, _a).normalize();
    _m.makeBasis(_b, _a, _d);
    this.head.quaternion.setFromRotationMatrix(_m);
    this.head.position.set(P.head.x, P.head.y, P.head.z);
    this.hands[0].position.set(P.haL.x, P.haL.y, P.haL.z);
    this.hands[1].position.set(P.haR.x, P.haR.y, P.haR.z);
    this.feet[0].position.set(P.ftL.x, P.ftL.y, P.ftL.z); this.feet[0].quaternion.copy(this.torso.quaternion);
    this.feet[1].position.set(P.ftR.x, P.ftR.y, P.ftR.z); this.feet[1].quaternion.copy(this.torso.quaternion);
  }
  face(mode) { // 'calm' | 'scream' | 'dizzy'
    const s = mode === 'scream' ? 1.25 : mode === 'dizzy' ? 0.7 : 1;
    this.eyes.forEach((e) => e.scale.setScalar(s));
    if (mode === 'scream') this.mouth.scale.set(1.3, 1.6, 0.4);
    else if (mode === 'dizzy') this.mouth.scale.set(1.5, 0.35, 0.4);
    else this.mouth.scale.set(1, 0.3, 0.4);
  }
}
