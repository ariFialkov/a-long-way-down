// Verifies the maths: exact paytable RTP, Monte-Carlo RTP, and that the planner can always build a
// fall worth exactly the drawn amount.   npm run sim [rounds]
import { PAYTABLE, RTP, MEAN_SECTIONS, drawOutcome } from '../src/outcome.js';
import { planRound } from '../src/planner.js';
import { mulberry32 } from '../src/rng.js';

const rounds = +process.argv[2] || 20000;
console.log(`paytable rows: ${PAYTABLE.length}   exact RTP: ${(RTP * 100).toFixed(6)}%   mean sections: ${MEAN_SECTIONS.toFixed(4)}`);
const rand = mulberry32(12345);
let paid = 0, secs = 0, zero = 0, over1 = 0, dur = 0, maxDur = 0, hits = 0, fail = 0, maxU = 0;
const t0 = Date.now();
for (let i = 0; i < rounds; i++) {
  const o = drawOutcome(rand);
  paid += o.units; secs += o.sections; if (!o.units) zero++; if (o.units >= 100) over1++; maxU = Math.max(maxU, o.units);
  try {
    const plan = planRound(o);
    const sum = plan.events.reduce((s, e) => s + e.value, 0);
    const clears = plan.events.filter((e) => e.type === 'clear').length;
    if (sum !== o.units || clears !== o.sections - 1 || plan.events.some((e) => e.value < 0)) throw new Error(`mismatch sum=${sum} units=${o.units} clears=${clears}`);
    if (plan.events.some((e) => ['hit', 'pass', 'clear'].includes(e.type) && e.value < 1)) throw new Error('scoring event worth 0');
    for (let k = 1; k < plan.events.length; k++) if (plan.events[k].t < plan.events[k - 1].t) throw new Error('events out of order');
    dur += plan.duration; maxDur = Math.max(maxDur, plan.duration);
    hits += plan.events.filter((e) => e.type === 'hit' || e.type === 'pass').length;
  } catch (e) { fail++; if (fail < 5) console.log('FAIL', JSON.stringify(o), e.message); }
}
console.log(`rounds: ${rounds}  (${((Date.now() - t0) / rounds).toFixed(2)} ms/plan)`);
console.log(`simulated RTP: ${(paid / rounds).toFixed(3)}%   avg sections: ${(secs / rounds).toFixed(3)}`);
console.log(`zero wins: ${((zero / rounds) * 100).toFixed(1)}%   wins >= stake: ${((over1 / rounds) * 100).toFixed(1)}%   max: ${maxU / 100}x`);
console.log(`avg fall: ${(dur / rounds).toFixed(2)}s  longest: ${maxDur.toFixed(1)}s  avg scoring hits: ${(hits / rounds).toFixed(2)}`);
console.log(`planner failures: ${fail}`);
process.exit(fail ? 1 : 0);
