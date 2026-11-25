// Particles (instanced debris boxes + soft puffs), thrown props and floating score pop-ups.
import * as THREE from 'three';
import { sharedMaterial } from './world/batch.js';
import { CFG } from './config.js';

const MAXB = 900, MAXP = 260;
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const _e = new THREE.Euler(), _c = new THREE.Color(), _v = new THREE.Vector3();
const rr = (a, b) => a + Math.random() * (b - a);

export class FX {
  constructor(scene, camera, layer) {
    this.scene = scene; this.camera = camera; this.layer = layer;
    this.boxes = []; this.puffs = []; this.flyers = []; this.pops = [];
    const bm = new THREE.MeshToonMaterial({ gradientMap: sharedMaterial().gradientMap });
    this.boxMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bm, MAXB);
    this.boxMesh.castShadow = true;
    const pm = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false });
    this.puffMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), pm, MAXP);
    for (const m of [this.boxMesh, this.puffMesh]) {
      m.frustumCulled = false; m.count = 0;
      m.setColorAt(0, _c.set(0xffffff));
      scene.add(m);
    }
  }
  chunk(o) {
    if (this.boxes.length >= MAXB) this.boxes.shift();
    this.boxes.push({
      x: o.x, y: o.y, z: o.z ?? CFG.Z0, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      sx: o.sx, sy: o.sy ?? o.sx, sz: o.sz ?? o.sx, color: o.color, life: o.life ?? 1.6, age: 0,
      g: o.g ?? 1, drag: o.drag ?? 0.4, rx: rr(0, 6), ry: rr(0, 6), rz: rr(0, 6),
      wx: rr(-1, 1) * (o.spin ?? 8), wy: rr(-1, 1) * (o.spin ?? 8), wz: rr(-1, 1) * (o.spin ?? 8),
    });
  }
  // n debris bits flying out of a point. size: [min,max]; flat => thin petals/cloth scraps
  burst({ x, y, z = CFG.Z0, n = 12, colors, speed = 6, up = 3, size = [0.08, 0.18], flat = false, life = 1.3, g = 1, drag = 0.6, spread = 0.3, vx = 0, vy = 0 }) {
    for (let i = 0; i < n; i++) {
      const a = rr(0, Math.PI * 2), sp = speed * rr(0.35, 1), s = rr(size[0], size[1]);
      this.chunk({
        x: x + rr(-spread, spread), y: y + rr(-spread, spread), z: z + rr(-spread, spread),
        vx: Math.cos(a) * sp + vx, vy: Math.sin(a) * sp * 0.7 + up + vy, vz: rr(-0.4, 1) * sp * 0.5,
        sx: s, sy: flat ? s * 0.18 : s * rr(0.6, 1.2), sz: flat ? s * rr(0.6, 1) : s * rr(0.6, 1.2),
        color: colors[(Math.random() * colors.length) | 0], life: life * rr(0.7, 1.2), g, drag,
      });
    }
  }
  puff({ x, y, z = CFG.Z0, n = 6, color = 0xffffff, size = 0.5, spread = 0.5, life = 0.7, rise = 1, speed = 2 }) {
    for (let i = 0; i < n; i++) {
      if (this.puffs.length >= MAXP) this.puffs.shift();
      const a = rr(0, Math.PI * 2), sp = rr(0.2, 1) * speed;
      this.puffs.push({
        x: x + rr(-spread, spread), y: y + rr(-spread, spread) * 0.6, z: z + rr(-spread, spread) * 0.5,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 + rise, vz: rr(-0.2, 0.6) * sp,
        s: size * rr(0.6, 1.3), color, life: life * rr(0.7, 1.3), age: 0,
      });
    }
  }
  // A whole mesh sent flying (goats, gnomes, sugar bags...). opts.update(mesh, age) for custom motion.
  flyer(mesh, o) {
    this.flyers.push({ mesh, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, g: o.g ?? 1, spin: o.spin ?? 6, life: o.life ?? 3, age: 0, update: o.update });
  }
  popup(x, y, z, text, cls = '') {
    const el = document.createElement('div');
    el.className = 'pop ' + cls;
    el.innerHTML = `<span>${text}</span>`;
    this.layer.appendChild(el);
    this.pops.push({ el, pos: new THREE.Vector3(x, y, z), age: 0 });
  }
  update(dt) {
    const G = CFG.G;
    let n = 0;
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const b = this.boxes[i];
      b.age += dt;
      if (b.age > b.life) { this.boxes.splice(i, 1); continue; }
      const d = Math.exp(-b.drag * dt);
      b.vx *= d; b.vz *= d; b.vy = b.vy * d - G * b.g * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (b.z < 0.12) { b.z = 0.12; b.vz = Math.abs(b.vz) * 0.4; }
      b.rx += b.wx * dt; b.ry += b.wy * dt; b.rz += b.wz * dt;
    }
    for (const b of this.boxes) {
      const k = Math.min(1, (b.life - b.age) / 0.25);
      _m.compose(_p.set(b.x, b.y, b.z), _q.setFromEuler(_e.set(b.rx, b.ry, b.rz)), _s.set(b.sx * k, b.sy * k, b.sz * k));
      this.boxMesh.setMatrixAt(n, _m);
      this.boxMesh.setColorAt(n, _c.setHex(b.color));
      n++;
    }
    this.boxMesh.count = n;
    this.boxMesh.instanceMatrix.needsUpdate = true;
    if (this.boxMesh.instanceColor) this.boxMesh.instanceColor.needsUpdate = true;

    n = 0;
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.age += dt;
      if (p.age > p.life) { this.puffs.splice(i, 1); continue; }
      const d = Math.exp(-2.5 * dt);
      p.vx *= d; p.vy *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    for (const p of this.puffs) {
      const u = p.age / p.life, s = p.s * (0.35 + 1.2 * Math.sqrt(u)) * (u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1);
      _m.compose(_p.set(p.x, p.y, p.z), _q.identity(), _s.set(s, s, s));
      this.puffMesh.setMatrixAt(n, _m);
      this.puffMesh.setColorAt(n, _c.setHex(p.color));
      n++;
    }
    this.puffMesh.count = n;
    this.puffMesh.instanceMatrix.needsUpdate = true;
    if (this.puffMesh.instanceColor) this.puffMesh.instanceColor.needsUpdate = true;

    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i], m = f.mesh;
      f.age += dt;
      if (f.age > f.life) { m.removeFromParent(); this.flyers.splice(i, 1); continue; }
      f.vy -= G * f.g * dt;
      m.position.x += f.vx * dt; m.position.y += f.vy * dt; m.position.z += f.vz * dt;
      m.rotation.z += f.spin * dt; m.rotation.x += f.spin * 0.4 * dt;
      if (f.update) f.update(m, f.age, dt);
    }

    const w = this.layer.clientWidth, h = this.layer.clientHeight;
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.age += dt;
      if (p.age > 1.15) { p.el.remove(); this.pops.splice(i, 1); continue; }
      _v.copy(p.pos).project(this.camera);
      p.el.style.transform = `translate(${((_v.x + 1) / 2) * w}px, ${((1 - _v.y) / 2) * h}px)`;
    }
  }
  clear() {
    this.boxes.length = 0; this.puffs.length = 0;
    for (const f of this.flyers) f.mesh.removeFromParent();
    this.flyers.length = 0;
    for (const p of this.pops) p.el.remove();
    this.pops.length = 0;
  }
}
