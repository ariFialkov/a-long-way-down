// Geometry batching: hundreds of little coloured primitives are baked into a single mesh per chunk
// (one draw call, one shared toon material, colour stored per vertex).
import * as THREE from 'three';
import { mulberry32 } from '../rng.js';

const templates = new Map();
function tpl(key, make) {
  let t = templates.get(key);
  if (!t) {
    let g = make();
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.normal) g.computeVertexNormals();
    t = { pos: g.attributes.position.array, nor: g.attributes.normal.array };
    templates.set(key, t);
  }
  return t;
}
function rockTemplate(variant) {
  return tpl('rock' + variant, () => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const rnd = mulberry32(variant * 7919 + 13), p = g.attributes.position;
    const seen = new Map(); // same jitter for coincident vertices so the rock stays watertight
    for (let i = 0; i < p.count; i++) {
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      let k = seen.get(key);
      if (k == null) { k = 0.78 + rnd() * 0.42; seen.set(key, k); }
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
    }
    g.computeVertexNormals(); // non-indexed => flat facets
    return g;
  });
}

const _c = new THREE.Color(), _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3();
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const colCache = new Map();
function rgb(hex) {
  let c = colCache.get(hex);
  if (!c) { _c.setHex(hex); c = [_c.r, _c.g, _c.b]; colCache.set(hex, c); }
  return c;
}

let toonMat = null;
export function sharedMaterial() {
  if (!toonMat) {
    const ramp = new THREE.DataTexture(new Uint8Array([105, 165, 215, 255]), 4, 1, THREE.RedFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
    toonMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
  }
  return toonMat;
}

export class Batch {
  constructor() { this.pos = []; this.nor = []; this.col = []; }
  get empty() { return this.pos.length === 0; }
  add(t, color, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    _n.getNormalMatrix(_m);
    const c = rgb(color), P = t.pos, N = t.nor, pos = this.pos, nor = this.nor, col = this.col;
    for (let i = 0; i < P.length; i += 3) {
      _v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(_m);
      pos.push(_v.x, _v.y, _v.z);
      _v.set(N[i], N[i + 1], N[i + 2]).applyMatrix3(_n).normalize();
      nor.push(_v.x, _v.y, _v.z);
      col.push(c[0], c[1], c[2]);
    }
    return this;
  }
  box(w, h, d, color, x, y, z, rx, ry, rz) {
    return this.add(tpl('box', () => new THREE.BoxGeometry(1, 1, 1)), color, x, y, z, w, h, d, rx, ry, rz);
  }
  // cylinder along Y by default; rx = PI/2 points it out of the wall (along Z)
  cyl(r, h, color, x, y, z, rx, ry, rz, rTop = 1) {
    const key = 'cyl' + rTop;
    return this.add(tpl(key, () => new THREE.CylinderGeometry(rTop, 1, 1, 8)), color, x, y, z, r, h, r, rx, ry, rz);
  }
  cone(r, h, color, x, y, z, rx, ry, rz) {
    return this.add(tpl('cone', () => new THREE.ConeGeometry(1, 1, 7)), color, x, y, z, r, h, r, rx, ry, rz);
  }
  sph(r, color, x, y, z, sx = 1, sy = 1, sz = 1) {
    return this.add(tpl('sph', () => new THREE.SphereGeometry(1, 8, 5)), color, x, y, z, r * sx, r * sy, r * sz);
  }
  rock(r, color, x, y, z, variant = 0, sx = 1, sy = 1, sz = 1, rz = 0) {
    return this.add(rockTemplate(((variant % 8) + 8) % 8), color, x, y, z, r * sx, r * sy, r * sz, variant * 1.3, variant * 2.1, rz);
  }
  // raw triangle (used for the cliff face); flat normal
  tri(a, b, c, color) {
    const col = rgb(color);
    _v.subVectors(b, a); _p.subVectors(c, a); _v.cross(_p).normalize();
    for (const q of [a, b, c]) { this.pos.push(q.x, q.y, q.z); this.nor.push(_v.x, _v.y, _v.z); this.col.push(col[0], col[1], col[2]); }
    return this;
  }
  build({ shadow = true, receive = true, material } = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    const m = new THREE.Mesh(g, material || sharedMaterial());
    m.castShadow = shadow; m.receiveShadow = receive;
    this.pos = this.nor = this.col = null;
    return m;
  }
}

export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && o.material !== toonMat && o.material.dispose) o.material.dispose();
  });
  root.removeFromParent();
}

const texCache = new Map();
// Small canvas-drawn label texture (shop signs etc.)
export function labelTexture(text, bg, fg) {
  const key = text + bg + fg;
  let t = texCache.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 128, 128);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 64;
    g.font = `700 ${size}px Fredoka, system-ui, sans-serif`;
    while (g.measureText(text).width > 96 && size > 12) { size -= 4; g.font = `700 ${size}px Fredoka, system-ui, sans-serif`; }
    g.fillText(text, 64, 68);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, t);
  }
  return t;
}
