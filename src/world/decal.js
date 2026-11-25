// Blood splats that wrap around whatever was hit. A splat texture is projected onto the object's own
// triangles (three's DecalGeometry clips them to the projector box), so it bends over every facet and
// edge instead of floating as a blob. The decal is parented to the object, so it wobbles with it.
import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { sharedMaterial } from './batch.js';
import { mulberry32 } from '../rng.js';

let mats = null;
function splatTexture(seed) {
  const r = mulberry32(seed * 7919 + 3), R = (a, b) => a + r() * (b - a);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const blob = (x, y, rad) => { g.beginPath(); g.arc(x, y, rad, 0, 6.2832); g.fill(); };
  const layer = (col, shrink) => {
    g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round';
    const rnd = mulberry32(seed * 7919 + 3); // same shapes for every layer, just inset
    const Q = (a, b) => a + rnd() * (b - a);
    // main body: a lumpy cluster a little above centre (drips need room below)
    for (let i = 0; i < 11; i++) { const a = Q(0, 6.28), d = Q(0, 26); blob(128 + Math.cos(a) * d, 104 + Math.sin(a) * d * 0.8, Math.max(2, Q(20, 38) - shrink)); }
    // spikes thrown outward, each ending in a bead
    for (let i = 0; i < 13; i++) {
      const a = Q(0, 6.28), l = Q(48, 100), w = Math.max(1.5, Q(5, 12) - shrink);
      const x = 128 + Math.cos(a) * l, y = 104 + Math.sin(a) * l * 0.85;
      g.lineWidth = w; g.beginPath(); g.moveTo(128 + Math.cos(a) * 20, 104 + Math.sin(a) * 20); g.lineTo(x, y); g.stroke();
      blob(x, y, w * Q(0.7, 1.2));
    }
    // loose droplets
    for (let i = 0; i < 22; i++) { const a = Q(0, 6.28), d = Q(50, 118); blob(128 + Math.cos(a) * d, 108 + Math.sin(a) * d * 0.9, Math.max(1, Q(2, 7) - shrink * 0.5)); }
    // runs: gravity pulls a few trails down the surface
    for (let i = 0; i < 4; i++) {
      const x = 128 + Q(-34, 34), y1 = Q(165, 244), w = Math.max(1.5, Q(6, 11) - shrink);
      g.lineWidth = w; g.beginPath(); g.moveTo(x, 110); g.lineTo(x + Q(-3, 3), y1); g.stroke();
      blob(x, y1, w * 0.85);
    }
  };
  void R;
  layer('#6e0010', 0); // dark rim
  layer('#b3001b', 3.5);
  layer('#d90429', 8);
  // wet highlights
  g.fillStyle = 'rgba(255,170,170,0.5)';
  for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(128 + R(-26, 22), 96 + R(-24, 14), R(3, 8), R(2, 4), -0.6, 0, 6.2832); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function materials() {
  if (!mats) mats = [1, 2, 3, 4, 5].map((s) => new THREE.MeshToonMaterial({
    map: splatTexture(s), gradientMap: sharedMaterial().gradientMap, transparent: true, alphaTest: 0.04,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  }));
  return mats;
}

const helper = new THREE.Object3D(), inv = new THREE.Matrix4(), size = new THREE.Vector3(), pos = new THREE.Vector3();

// root: the object's mesh (child meshes are covered too). (x, y, z): contact point in world space.
// (nx, ny): direction from the surface towards the faller. s: splat width in world units.
export function splatOn(root, x, y, z, nx, ny, s) {
  root.updateMatrixWorld(true);
  // Project from between "towards the faller" and "towards the camera": the splat lands on the part of
  // the surface the player can actually see, and wraps over the edge towards the point of impact.
  helper.position.set(x + nx * 0.1, y + ny * 0.1, z + 0.35);
  pos.set(x + nx * 0.75, y + ny * 0.75, z + 1.0);
  helper.up.set(0, 1, 0);
  helper.lookAt(pos);
  size.set(s, s, 1.7);
  const m = materials()[(Math.random() * 5) | 0];
  const targets = [];
  root.traverse((o) => { if (o.isMesh && !o.userData.decal && o.geometry.attributes.normal) targets.push(o); });
  for (const t of targets) {
    const geo = new DecalGeometry(t, helper.position, helper.rotation, size);
    if (!geo.attributes.position || geo.attributes.position.count === 0) { geo.dispose(); continue; }
    geo.applyMatrix4(inv.copy(t.matrixWorld).invert());
    const d = new THREE.Mesh(geo, m);
    d.userData.decal = true; d.receiveShadow = true; d.renderOrder = 2;
    t.add(d);
  }
}
