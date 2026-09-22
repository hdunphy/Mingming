/** §1.4 Firmware, printed — ticket 149c-7. Run: npx vite-node scratch/t149c_osband.ts */
import { OS_BAND_MAX_PCT, OS_BAND_MIN_PCT, OS_FLAG_PCT, meanAttackScore, scoreAllOS } from '../src/debug/balance/powerscale';

const rows = scoreAllOS();
console.log(`${rows.length} firmware entries. Band ${OS_BAND_MIN_PCT}-${OS_BAND_MAX_PCT}%, flag >${OS_FLAG_PCT}%. `
    + `Mean attack score ${meanAttackScore().toFixed(2)}.\n`);
console.log(`${'os'.padEnd(24)} ${'name'.padEnd(22)} ${'%pool'.padStart(7)}  verdict`);
for (const r of rows) {
    const flags = [r.codeDriven ? 'code-driven' : '', r.unmeasured.length ? `unmeasured:${r.unmeasured.join(',')}` : '']
        .filter(Boolean).join(' ');
    console.log(`${r.id.padEnd(24)} ${r.name.padEnd(22)} ${String(r.pctOfPoolPerGame).padStart(6)}%  ${r.verdict.padEnd(11)} ${flags}`);
}
