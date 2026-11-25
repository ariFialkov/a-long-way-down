// Round planner. Given a pre-determined outcome (sections fallen through + win units) it lays out the
// map and a piecewise-ballistic fall through it: every bounce, every smashed object and the final
// stopper are placed along the trajectory so the fall is worth exactly `units`. Pure data, no rendering.
import { CFG, KINDS, TOPPER_W } from './config.js';
import { RNG } from './rng.js';

const { G, BODY_R: R, SECTION_H: H, XLIM, OPEN_HW, FLOOR_T } = CFG;
const CLR = R + 0.3;

const kindsOf = (biome, mode) =>
  Object.keys(KINDS).filter((k) => KINDS[k].biome === biome && KINDS[k].mode === mode).map((k) => [k, KINDS[k].p]);

function flightTime(y0, vy, yT) {
  const d = vy * vy + 2 * G * (y0 - yT);
  return d < 0 ? null : (vy + Math.sqrt(d)) / G;
}
function airSamples(seg, out) {
  const dur = seg.t1 - seg.t0, n = Math.max(2, Math.ceil(dur * 90));
  for (let i = 0; i <= n; i++) {
    const tt = (dur * i) / n;
    out.push({ t: seg.t0 + tt, x: seg.x0 + seg.vx * tt, y: seg.y0 + seg.vy * tt - 0.5 * G * tt * tt });
  }
}
function sdist(s, x, y) {
  if (s.k === 'c') return Math.hypot(x - s.x, y - s.y) - s.r;
  return Math.hypot(Math.max(s.x0 - x, 0, x - s.x1), Math.max(s.y0 - y, 0, y - s.y1));
}
const aabb = (s) => (s.k === 'c' ? [s.x - s.r, s.x + s.r, s.y - s.r, s.y + s.r] : [s.x0, s.x1, s.y0, s.y1]);
function overlaps(a, b, m) {
  for (const sa of a.shapes) for (const sb of b.shapes) {
    const A = aabb(sa), B = aabb(sb);
    if (A[0] < B[1] + m && A[1] > B[0] - m && A[2] < B[3] + m && A[3] > B[2] - m) return true;
  }
  return false;
}
// Does the path (samples) run into obj? `own` = { t, pre, post }: the time window around the planned
// contact with this very object, during which touching it is the whole point.
function blocked(samples, obj, clr, own) {
  for (const s of obj.shapes) {
    if (own && s.smash) continue; // whatever rests on the platform is flattened on contact
    const c = own && s.core ? R * 0.9 : clr;
    for (const p of samples) {
      if (own && p.t > own.t - own.pre && p.t < own.t + own.post) continue;
      if (sdist(s, p.x, p.y) < c) return true;
    }
  }
  return false;
}
const rect = (x0, x1, y0, y1, extra) => ({ k: 'r', x0, x1, y0, y1, ...extra });
const circ = (x, y, r, extra) => ({ k: 'c', x, y, r, ...extra });

function mkPeg(kind, cx, cy, rng) {
  const K = KINDS[kind], r = rng.range(K.r[0], K.r[1]);
  return { kind, mode: 'peg', x: cx, y: cy, r, shapes: [circ(cx, cy, r, { solid: true, core: true })] };
}
function mkPlat(kind, cx, top, hw, rng) {
  const topper = rng.weighted(KINDS[kind].toppers);
  const shapes = [rect(cx - hw, cx + hw, top - 0.4, top, { solid: true, core: true })];
  if (topper !== 'none') shapes.push(rect(cx - hw * 0.8, cx + hw * 0.8, top, top + 1.0, { smash: true }));
  return { kind, mode: 'plat', x: cx, y: top, hw, topper, shapes };
}
function mkPass(kind, hx, hy, rng) {
  const K = KINDS[kind];
  const o = { kind, mode: 'pass', x: hx, y: hy, shapes: [] };
  if (K.hw) o.hw = rng.range(K.hw[0], K.hw[1]);
  if (kind === 'bridge') {
    o.shapes.push(rect(hx - o.hw, hx + o.hw, hy - 0.25, hy + 0.3, {}));
    o.shapes.push(rect(hx - o.hw - 1.2, hx - o.hw, hy - 0.9, hy + 0.05, { solid: true }));
    o.shapes.push(rect(hx + o.hw, hx + o.hw + 1.2, hy - 0.9, hy + 0.05, { solid: true }));
  } else if (kind === 'bunting' || kind === 'clothesline') {
    o.shapes.push(rect(hx - o.hw, hx + o.hw, hy - 0.9, hy + 0.4, {}));
    o.shapes.push(circ(hx - o.hw, hy + 0.4, 0.2, { solid: true }), circ(hx + o.hw, hy + 0.4, 0.2, { solid: true }));
  } else if (kind === 'awning') {
    o.shapes.push(rect(hx - o.hw, hx + o.hw, hy - 0.45, hy + 0.45, {}));
  } else if (kind === 'sugar') {
    o.dx = 3.6; o.bhw = 1.0; o.btop = hy - 2.5;
    for (const s of [-1, 1]) {
      const bx = hx + s * o.dx;
      o.shapes.push(rect(bx - o.bhw, bx + o.bhw, o.btop - 0.4, o.btop, { solid: true }));
      o.shapes.push(rect(bx - o.bhw, bx + o.bhw, o.btop, o.btop + 1.9, {}));
    }
  } else if (kind === 'bird') {
    o.dir = rng.sign(); o.speed = rng.range(3.5, 5);
  }
  return o;
}

function makeBiomes(n, rng, startBiome) {
  const out = [];
  let b = startBiome || rng.pick(['cliff', 'building']);
  while (out.length < n) {
    const run = rng.int(2, 4);
    for (let i = 0; i < run && out.length < n; i++) out.push(b);
    b = b === 'cliff' ? 'building' : 'cliff';
  }
  return out;
}
export function floorType(a, b) {
  if (a === b) return a === 'cliff' ? 'shelf' : 'balcony';
  return a === 'cliff' ? 'roof' : 'street';
}
export function floorShapes(yFloor, open) {
  return [
    rect(-80, open.x - open.hw, yFloor - FLOOR_T, yFloor, { solid: true, core: true }),
    rect(open.x + open.hw, 80, yFloor - FLOOR_T, yFloor, { solid: true, core: true }),
  ];
}

// The small run-out after hitting the stopper: two dying hops and a slide to rest.
function landing(xl, yl, vin, t) {
  const segs = [], events = [], samples = [];
  const v1 = { vx: vin.vx * 0.35, vy: Math.min(-vin.vy * 0.22, 4.5) };
  const t1 = (2 * v1.vy) / G, x1 = xl + v1.vx * t1;
  const v2 = { vx: v1.vx * 0.6, vy: v1.vy * 0.3 };
  const t2 = (2 * v2.vy) / G, x2 = x1 + v2.vx * t2;
  const v3 = v2.vx * 0.7, dur = 0.4, x3 = x2 + (v3 * dur) / 2;
  segs.push({ kind: 'air', t0: t, t1: t + t1, x0: xl, y0: yl, vx: v1.vx, vy: v1.vy });
  segs.push({ kind: 'air', t0: t + t1, t1: t + t1 + t2, x0: x1, y0: yl, vx: v2.vx, vy: v2.vy });
  const ts = t + t1 + t2;
  segs.push({ kind: 'slide', t0: ts, t1: ts + dur, x0: x2, y0: yl, y1: yl - 0.2, v0: v3 });
  segs.push({ kind: 'rest', t0: ts + dur, t1: Infinity, x0: x3, y0: yl - 0.2 });
  airSamples(segs[0], samples); airSamples(segs[1], samples);
  samples.push({ t: ts + dur, x: x3, y: yl });
  events.push({ t, type: 'land', x: xl, y: yl, speed: Math.hypot(vin.vx, vin.vy) });
  events.push({ t: t + t1, type: 'land2', x: x1, y: yl, speed: v1.vy });
  events.push({ t: ts + dur, type: 'stop', x: x3, y: yl - 0.2 });
  return { segs, events, samples, xEnd: x3, tEnd: ts + dur };
}

function planSection(S, entry, K, isFinal, rng, pre) {
  const { index: s, biome, yTop, yFloor } = S;
  const objs = [...pre], samples = [], segs = [], events = [];
  const stopMid = isFinal && rng.chance(0.6);
  const slots = K + (stopMid ? 1 : 0);
  const top = yTop - (s === 0 ? 7 : 5.5), bot = yFloor + 4.5;
  const spacing = (top - bot) / Math.max(slots, 1), ys = [];
  for (let i = 0; i < slots; i++) ys.push(top - spacing * (i + 0.5 + rng.range(-0.22, 0.22)));
  if (K === 0 && stopMid) ys[0] = top - rng.range(0, 0.55) * (top - bot); // straight onto a stopper: keep it short
  const pegKinds = kindsOf(biome, 'peg'), platKinds = kindsOf(biome, 'plat'), passKinds = kindsOf(biome, 'pass');
  let cur = { x: entry.x, y: entry.y, t: entry.t, vin: { vx: entry.vx, vy: entry.vy } };
  let movers = 0, passes = 0, open = null, land = null, stopper = null;

  for (let i = 0; i <= K; i++) {
    const last = i === K;
    const yT = !last ? ys[i] : !isFinal ? yFloor : stopMid ? ys[K] : yFloor + R;
    const xMax = last && !isFinal ? 5.0 : XLIM;
    let done = false;
    for (let a = 0; a < (i === 0 ? 1 : 40) && !done; a++) {
      let obj = null, vout, own = null, ev = null;
      const vin = cur.vin;
      if (i === 0) vout = { vx: vin.vx, vy: vin.vy };
      else {
        let mode = a > 14 ? 'peg' : rng.weighted([['peg', 0.52], ['plat', 0.24], ['pass', passes < 2 ? 0.24 : 0]]);
        if (mode === 'pass' && vin.vy > -7) mode = 'peg';
        if (mode === 'peg') {
          const vy = Math.min(Math.max(rng.range(0.15, 0.42) * -vin.vy, 1), 7.5);
          const tau = flightTime(cur.y, vy, yT);
          const xn = Math.max(-xMax, Math.min(xMax, cur.x * 0.75 + rng.range(-4.5, 4.5)));
          vout = { vx: Math.max(-7.5, Math.min(7.5, (xn - cur.x) / tau)), vy };
          let nx = vout.vx - vin.vx, ny = vout.vy - vin.vy;
          const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
          if (ny < 0.25) continue;
          const kind = rng.weighted(pegKinds);
          obj = mkPeg(kind, 0, 0, rng);
          obj.x = cur.x - nx * (R + obj.r); obj.y = cur.y - ny * (R + obj.r);
          obj.shapes[0].x = obj.x; obj.shapes[0].y = obj.y;
          own = { t: cur.t, pre: 0.1, post: 0.12 };
          ev = { type: 'hit', nx, ny };
        } else if (mode === 'plat') {
          // bounce off near the far edge of the little platform so the hop carries clear of it
          let vx = vin.vx * 0.6 + rng.range(-1.5, 1.5);
          if (Math.abs(vx) < 1.8) vx = (vx < 0 ? -1 : 1) * rng.range(1.8, 3.2);
          vout = { vx, vy: Math.min(Math.max(0.45 * -vin.vy, 3.5), 8) };
          const hw = rng.range(1.0, 1.4);
          obj = mkPlat(rng.weighted(platKinds), cur.x - Math.sign(vx) * hw * rng.range(0.4, 0.8), cur.y - R, hw, rng);
          own = { t: cur.t, pre: 0.16, post: 0.16 };
          ev = { type: 'hit', nx: 0, ny: 1 };
        } else {
          let kind = rng.weighted(passKinds);
          if (KINDS[kind].mover && movers > 0) continue;
          vout = { vx: vin.vx * 0.5 + rng.range(-1.2, 1.2), vy: vin.vy * rng.range(0.3, 0.45) };
          obj = mkPass(kind, cur.x, cur.y, rng);
          own = { t: cur.t, pre: 0.25, post: 0.3 };
          ev = { type: 'pass', nx: 0, ny: 1 };
        }
      }
      const tau = flightTime(cur.y, vout.vy, yT);
      if (tau == null || tau < 0.12 || tau > 2) continue;
      const xN = cur.x + vout.vx * tau;
      if (Math.abs(xN) > xMax) continue;
      // leaving through the floor: don't carry so much sideways speed that the next section can't cope
      if (last && !isFinal && Math.abs(xN + vout.vx * 1.1) > 5.4) continue;
      const seg = { kind: 'air', t0: cur.t, t1: cur.t + tau, x0: cur.x, y0: cur.y, vx: vout.vx, vy: vout.vy };
      const ns = [];
      airSamples(seg, ns);
      if (obj) {
        if (objs.some((o) => overlaps(o, obj, 0.3))) continue;
        if (blocked(samples, obj, CLR, own) || blocked(ns, obj, CLR, own)) continue;
      }
      let bad = false;
      for (const o of objs) {
        // the diving board at the very top is "own" for the opening jump
        if (blocked(ns, o, CLR, o.kind === 'outcrop' ? { t: 0, pre: 1, post: 0.9 } : null)) { bad = true; break; }
      }
      if (bad) continue;
      const vEnd = { vx: vout.vx, vy: vout.vy - G * tau };
      let nOpen = null, nLand = null, nStop = null;
      if (last && !isFinal) {
        nOpen = { x: xN + rng.range(-0.35, 0.35), hw: OPEN_HW };
        if (blocked(ns, { shapes: floorShapes(yFloor, nOpen) }, R + 0.15, null)) continue;
      } else if (last) {
        nLand = landing(xN, yT, vEnd, cur.t + tau);
        if (Math.abs(nLand.xEnd) > 6) continue;
        const lo = Math.min(xN, nLand.xEnd), hi = Math.max(xN, nLand.xEnd);
        if (stopMid) {
          const kind = biome === 'cliff' ? 'bigledge' : 'balcony';
          const x0 = lo - rng.range(1.3, 2.2), x1 = hi + rng.range(1.3, 2.2), topY = yT - R;
          nStop = { kind, mode: 'stop', x: (x0 + x1) / 2, y: topY, hw: (x1 - x0) / 2, shapes: [rect(x0, x1, topY - 0.5, topY, { solid: true, core: true })] };
          const o2 = { t: cur.t + tau, pre: 0.12, post: 99 };
          if (objs.some((o) => overlaps(o, nStop, 0.3)) || (obj && overlaps(obj, nStop, 0.3))) continue;
          if (blocked(samples, nStop, CLR, o2) || blocked(ns, nStop, CLR, o2)) continue;
        } else {
          // Landed on the section floor: put the opening tantalisingly close by.
          const dir = Math.sign(vEnd.vx) || 1;
          let ox = lo - OPEN_HW - rng.range(1.0, 2.4);
          if (dir < 0) ox = hi + OPEN_HW + rng.range(1.0, 2.4);
          if (Math.abs(ox) > 5.6) ox = dir < 0 ? lo - OPEN_HW - rng.range(1.0, 2.4) : hi + OPEN_HW + rng.range(1.0, 2.4);
          if (Math.abs(ox) > 6) continue;
          nOpen = { x: ox, hw: OPEN_HW };
        }
      }
      // commit
      if (obj) {
        obj.role = 'hit'; obj.tHit = cur.t;
        objs.push(obj);
        events.push({ ...ev, t: cur.t, obj, x: cur.x, y: cur.y, vx: vin.vx, vy: vin.vy, speed: Math.hypot(vin.vx, vin.vy) });
        if (obj.mode === 'pass') passes++;
        if (KINDS[obj.kind].mover) movers++;
      }
      segs.push(seg); for (const p of ns) samples.push(p);
      cur = { x: xN, y: yT, t: cur.t + tau, vin: vEnd };
      if (nOpen) open = nOpen;
      if (nLand) land = nLand;
      if (nStop) stopper = nStop;
      done = true;
    }
    if (!done) return null;
  }

  let exit = null;
  if (!isFinal) {
    events.push({ t: cur.t, type: 'clear', x: cur.x, y: yFloor });
    exit = { x: cur.x, y: yFloor, vx: cur.vin.vx, vy: cur.vin.vy, t: cur.t };
  } else {
    if (stopper) { stopper.role = 'stop'; objs.push(stopper); }
    if (!open) {
      // mid-air stopper: the opening sits somewhere else along the floor
      let ox = rng.range(-5, 5);
      if (Math.abs(ox - stopper.x) < stopper.hw * 0.5) ox = stopper.x > 0 ? stopper.x - stopper.hw - 2 : stopper.x + stopper.hw + 2;
      open = { x: Math.max(-5.5, Math.min(5.5, ox)), hw: OPEN_HW };
    }
    land.events[0].obj = stopper || null;
    for (const sg of land.segs) segs.push(sg);
    for (const e of land.events) events.push(e);
    for (const p of land.samples) samples.push(p);
  }
  placeDecoys(S, objs, samples, rng, open);
  return { objects: objs.filter((o) => o.kind !== 'outcrop'), segs, events, open, exit, stopper };
}

// Fill the rest of the section with things the character will NOT touch this round.
function placeDecoys(S, objs, samples, rng, open) {
  const { biome, yTop, yFloor, index } = S;
  const pegKinds = kindsOf(biome, 'peg'), platKinds = kindsOf(biome, 'plat');
  const passKinds = kindsOf(biome, 'pass').filter((k) => !KINDS[k[0]].mover);
  const floor = { shapes: floorShapes(yFloor, open) };
  const want = rng.int(8, 11);
  let placed = 0;
  for (let a = 0; a < 140 && placed < want; a++) {
    const x = rng.range(-6.6, 6.6), y = rng.range(yFloor + 3, yTop - (index === 0 ? 6 : 2.5));
    const mode = rng.weighted([['peg', 0.6], ['plat', 0.25], ['pass', 0.15]]);
    let o;
    if (mode === 'peg') o = mkPeg(rng.weighted(pegKinds), x, y, rng);
    else if (mode === 'plat') o = mkPlat(rng.weighted(platKinds), x, y, rng.range(1.0, 1.4), rng);
    else o = mkPass(rng.weighted(passKinds), x * 0.6, y, rng);
    if (objs.some((p) => overlaps(p, o, 0.7)) || overlaps(floor, o, 1.2)) continue;
    if (blocked(samples, o, R + 0.55, null)) continue;
    o.role = 'decoy';
    objs.push(o);
    placed++;
  }
}

export function planRound({ units, sections: N, seed, startBiome }) {
  const rng = new RNG(seed);
  const biomes = makeBiomes(N + 1, rng, startBiome);
  // hits per section, capped so every scoring event can be worth at least one unit
  const ks = [];
  for (let s = 0; s < N; s++) {
    const fin = s === N - 1;
    ks.push(units === 0 ? 0 : fin ? rng.int(N === 1 ? 1 : 0, 4) : rng.int(2, 5));
  }
  const budget = units - (N - 1);
  let total = ks.reduce((a, b) => a + b, 0);
  while (total > budget) { const i = rng.int(0, N - 1); if (ks[i] > 0) { ks[i]--; total--; } }

  const dir = rng.sign();
  let state = { x: 0, y: CFG.START_Y, vx: dir * rng.range(2.7, 3.3), vy: 5.2, t: 0 };
  const outcrop = { kind: 'outcrop', shapes: [rect(-1.2, 1.2, -0.6, 0, { solid: true })] };
  const sections = [], segs = [], events = [];
  let id = 1;
  for (let s = 0; s < N; s++) {
    const S = { index: s, biome: biomes[s], yTop: -s * H, yFloor: -(s + 1) * H };
    const fin = s === N - 1, minK = N === 1 && units > 0 ? 1 : 0;
    let r = null;
    for (let K = ks[s]; K >= minK && !r; K--) {
      for (let a = 0; a < 60 && !r; a++) {
        r = planSection(S, state, K, fin, new RNG(seed ^ Math.imul(s + 1, 97531) ^ Math.imul(a + 1, 7919) ^ (K << 20)), s === 0 ? [outcrop] : []);
      }
    }
    if (!r) throw new Error('planner: no valid layout for section ' + s);
    S.objects = r.objects;
    S.floor = { type: floorType(biomes[s], biomes[s + 1]), y: S.yFloor, open: r.open };
    S.stopper = r.stopper;
    for (const o of S.objects) { o.id = id++; o.sec = s; }
    for (const e of r.events) { e.sec = s; events.push(e); }
    for (const sg of r.segs) segs.push(sg);
    sections.push(S);
    state = r.exit;
  }
  // one more section below, purely so there is something to see through the last opening
  {
    const s = N, S = { index: s, biome: biomes[s], yTop: -s * H, yFloor: -(s + 1) * H, objects: [] };
    const open = { x: rng.range(-4, 4), hw: OPEN_HW };
    placeDecoys(S, S.objects, [], rng, open);
    S.floor = { type: floorType(biomes[s], biomes[s]), y: S.yFloor, open };
    for (const o of S.objects) { o.id = id++; o.sec = s; }
    sections.push(S);
  }

  // Split the win across everything that scores.
  const scoring = events.filter((e) => e.type === 'hit' || e.type === 'pass' || e.type === 'clear');
  if (scoring.length > units) throw new Error('planner: more scoring events than units');
  if (scoring.length) {
    const w = scoring.map((e) => {
      const depth = 1 + 0.35 * e.sec;
      if (e.type === 'clear') return 5 * (e.sec + 1) * rng.range(0.8, 1.2);
      const base = e.obj.mode === 'plat' ? TOPPER_W[e.obj.topper] : KINDS[e.obj.kind].w;
      return base * depth * rng.range(0.7, 1.3);
    });
    const sum = w.reduce((a, b) => a + b, 0), spare = units - scoring.length;
    let given = 0;
    scoring.forEach((e, i) => { e.value = 1 + Math.floor((spare * w[i]) / sum); given += e.value; });
    const order = scoring.map((_, i) => i).sort((a, b) => w[b] - w[a]);
    for (let i = 0; given < units; i++, given++) scoring[order[i % order.length]].value++;
  }
  for (const e of events) if (e.value == null) e.value = 0;
  const duration = events[events.length - 1].t;
  return { units, N, seed, biomes, sections, segs, events, duration, dir };
}

// Torso-centre position along the planned path at time t (segIndex hint makes this O(1) per frame).
export function evalPath(plan, t, hint = 0) {
  const segs = plan.segs;
  let i = Math.min(hint, segs.length - 1);
  while (i < segs.length - 1 && t >= segs[i].t1) i++;
  const s = segs[i], tt = Math.max(0, t - s.t0);
  if (s.kind === 'air') return { i, x: s.x0 + s.vx * tt, y: s.y0 + s.vy * tt - 0.5 * G * tt * tt, vx: s.vx, vy: s.vy - G * tt };
  if (s.kind === 'slide') {
    const dur = s.t1 - s.t0, u = Math.min(1, tt / dur);
    return { i, x: s.x0 + s.v0 * dur * (u - (u * u) / 2), y: s.y0 + (s.y1 - s.y0) * u, vx: s.v0 * (1 - u), vy: 0 };
  }
  return { i, x: s.x0, y: s.y0, vx: 0, vy: 0 };
}
