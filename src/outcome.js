// Outcome engine. This is the only place the result of a round is decided; everything on screen is
// choreographed afterwards to arrive at exactly this number. In a real-money deployment this module
// would live on a certified server RNG, and the client would only receive { sections, units, seed }.
//
// A result is a number of sections fallen through plus a win in "units" (1 unit = 1/100 of the stake).

export const TARGET_RTP = 0.96;

// [sections, probability] - mean is exactly 3.0 sections.
const SECTION_DIST = [[1, 0.28], [2, 0.22], [3, 0.18], [4, 0.12], [5, 0.08], [6, 0.05], [7, 0.03], [8, 0.025], [10, 0.015]];
// Relative win multipliers per depth (scaled below so the whole table returns TARGET_RTP).
const RAW = {
  1: [0, 0.1, 0.2, 0.3, 0.5], 2: [0.2, 0.4, 0.6, 0.8, 1.2], 3: [0.5, 0.8, 1, 1.5, 2], 4: [0.8, 1.2, 1.5, 2, 3],
  5: [1.5, 2, 2.5, 3, 5], 6: [2, 3, 4, 5, 8], 7: [3, 5, 6, 8, 12], 8: [5, 8, 10, 15, 25], 10: [10, 20, 25, 50, 100],
};
const VAR_W = { 1: [0.3, 0.25, 0.2, 0.15, 0.1], default: [0.25, 0.25, 0.2, 0.2, 0.1] };

function buildTable() {
  const rows = [];
  for (const [n, pn] of SECTION_DIST) {
    const w = VAR_W[n] || VAR_W.default;
    RAW[n].forEach((m, i) => rows.push({ sections: n, raw: m, p: pn * w[i] }));
  }
  const rawRtp = rows.reduce((s, r) => s + r.p * r.raw, 0);
  const c = TARGET_RTP / rawRtp;
  for (const r of rows) r.units = Math.round(r.raw * c * 100);
  // Rounding to whole units leaves a tiny residual: cancel it exactly by moving a sliver of
  // probability between the lowest and highest single-section outcomes (section odds unchanged).
  const rtp = rows.reduce((s, r) => s + r.p * r.units, 0) / 100;
  const one = rows.filter((r) => r.sections === 1);
  const lo = one[0], hi = one[one.length - 1];
  const delta = ((TARGET_RTP - rtp) * 100) / (hi.units - lo.units);
  hi.p += delta; lo.p -= delta;
  if (lo.p <= 0 || hi.p <= 0) throw new Error('paytable residual fix out of range');
  // Symmetric +-jitter keeps each row's mean, so RTP is untouched while totals look organic.
  for (const r of rows) r.jitter = Math.max(0, Math.min(Math.floor(r.units * 0.12), r.units - r.sections * 3));
  return rows;
}

export const PAYTABLE = buildTable();
export const RTP = PAYTABLE.reduce((s, r) => s + r.p * r.units, 0) / 100;
export const MEAN_SECTIONS = PAYTABLE.reduce((s, r) => s + r.p * r.sections, 0);

function secureRandom() {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] / 4294967296;
}

export function drawOutcome(rand = secureRandom) {
  let r = rand(), row = PAYTABLE[PAYTABLE.length - 1];
  for (const e of PAYTABLE) { r -= e.p; if (r <= 0) { row = e; break; } }
  const j = row.jitter ? Math.floor(rand() * (2 * row.jitter + 1)) - row.jitter : 0;
  return { sections: row.sections, units: row.units + j, seed: Math.floor(rand() * 4294967296) >>> 0 };
}
