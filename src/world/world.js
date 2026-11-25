// Owns the chunks of the current round: builds them (lazily, a little ahead of the faller), keeps
// their animations ticking, routes hit events to objects and exposes solid shapes for limb collisions.
import { buildChunk } from './scenery.js';
import { disposeTree } from './batch.js';
import { floorShapes } from '../planner.js';
import { CFG } from '../config.js';

export class World {
  constructor(scene, { plan, biome, decorSeed, fx, sfx }) {
    this.scene = scene; this.fx = fx; this.sfx = sfx; this.decorSeed = decorSeed;
    this.sections = plan ? plan.sections : [{ index: 0, biome, yTop: 0, yFloor: -CFG.SECTION_H, objects: [], floor: null }];
    this.chunks = new Map(); this.solidCache = new Map();
    this.T = 0; this.tJump = null;
    this.ensure(0);
    if (plan) setTimeout(() => this.chunks && this.ensure(1), 120);
  }
  runSeed(i) {
    let s = i;
    while (s > 0 && this.sections[s - 1].biome === this.sections[i].biome) s--;
    return this.decorSeed + s * 7717 + 1;
  }
  ensure(i) {
    if (!this.chunks || i < 0 || i >= this.sections.length || this.chunks.has(i)) return;
    const c = buildChunk(this.sections[i], { fx: this.fx, sfx: this.sfx, decorSeed: this.decorSeed, runSeed: this.runSeed(i) });
    this.scene.add(c.group);
    this.chunks.set(i, c);
  }
  solids(i) {
    let s = this.solidCache.get(i);
    if (!s) {
      s = [];
      for (const k of [i - 1, i]) {
        const S = this.sections[k];
        if (!S) continue;
        if (k === i) for (const o of S.objects) for (const sh of o.shapes) if (sh.solid) s.push(sh);
        if (S.floor) s.push(...floorShapes(S.floor.y, S.floor.open));
      }
      if (i === 0) s.push({ k: 'r', x0: -1.2, x1: 1.2, y0: -0.6, y1: 0, solid: true });
      this.solidCache.set(i, s);
    }
    return s;
  }
  hit(ev) {
    if (!ev.obj) return;
    const c = this.chunks.get(ev.obj.sec), h = c && c.handles.get(ev.obj.id);
    if (h && h.hit) h.hit(ev);
  }
  // camY / viewH: what the camera can currently see, so chunks out of shot are skipped entirely
  update(dt, cur, camY = 0, viewH = 1e3) {
    this.T += dt;
    const t = this.tJump == null ? this.T - 1000 : this.T - this.tJump;
    for (const [i, c] of this.chunks) {
      const S = this.sections[i], vis = Math.abs(i - cur) <= 1 && S.yTop + 8 > camY - viewH && S.yFloor - 3 < camY + viewH;
      c.group.visible = vis;
      if (!vis) continue;
      for (const u of c.updaters) u(t, dt);
      if (c.extras) c.extras.clouds.position.x = Math.sin(this.T * 0.02) * 12;
    }
  }
  dispose() {
    for (const c of this.chunks.values()) disposeTree(c.group);
    this.chunks.clear(); this.chunks = null;
  }
}
