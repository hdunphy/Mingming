/** Ticket 73: the standing full-field FTK scan, and the arm harness for the fix. */
import { runOne, deriveSeeds, DEFAULT_MAX_TURNS } from '../src/debug/balance/runBatch';
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { DRAW_SCALING_CAP, PLAY_COUNT_SCALING_CAP } from '../src/engine/actions/ActionExecutors';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import { ENV } from './_env';

const ITER = Number(ENV.ITER ?? 30);
/** The 14 cells ticket 69 found, as `deck:opponent`. */
const KNOWN = 'skoll_v1:jormungandr,jormungandr_v1:skoll,skoll_v2:jormungandr,fenrir_v2:jormungandr,jormungandr_v1:fenrir,jormungandr_v1:fafnir,gullinbursti_v2:jormungandr,fenrir_v1:jormungandr,fafnir_v1:jormungandr,jormungandr_v1:gullinbursti,jormungandr_v1:ratatoskr,jormungandr_v1:hel,gullinbursti_v1:jormungandr,hel_v2:jormungandr';

const all: Array<[string, string, string]> = [];
for (const sp of BALANCE_SPECIES)
    for (const os of (MingmingRegistry as any)[sp].availableOS)
        for (const opp of BALANCE_SPECIES) if (opp !== sp) all.push([sp, os, opp]);

const cells = ENV.FULL
    ? all
    : (ENV.CELLS ?? KNOWN).split(',').map(c => {
        const [os, opp] = c.split(':');
        const sp = all.find(a => a[1] === os)![0];
        return [sp, os, opp] as [string, string, string];
    });

function scan(label: string) {
    let total = 0; const rows: Array<[string, string, number]> = [];
    for (const [sp, os, opp] of cells) {
        const setup = matchupScenario({ player: sp, enemy: opp, playerOS: os, seed: `band:${os}:${opp}` });
        let n = 0;
        for (const seed of deriveSeeds(setup.seed, ITER))
            for (const side of ['PLAYER', 'ENEMY'] as const)
                if (runOne(setup, seed, DEFAULT_MAX_TURNS, side).ftk) n++;
        if (n) rows.push([os, opp, n]);
        total += n;
    }
    console.error(`ARM ${label.padEnd(18)} FTK ${String(total).padStart(3)} in ${String(rows.length).padStart(2)}/${cells.length} cells   ${rows.map(r => `${r[0]}-v-${r[1]}:${r[2]}`).join(' ')}`);
    return { label, total, rows };
}

const results: any[] = [];
for (const spec of (ENV.ARMS ?? 'live').split(';')) {
    const [name, capS, inkS, playS] = spec.split('|');
    // Each cap is set INDEPENDENTLY. An earlier version derived the play cap from the draw cap
    // and silently overwrote an explicit `playS`, so every arm that looked like "play 5" was
    // really running at 3 - the full-field scan is what caught it. Set what you mean.
    if (capS !== undefined) DRAW_SCALING_CAP.value = capS === '' ? Infinity : Number(capS);
    if (playS !== undefined) PLAY_COUNT_SCALING_CAP.value = playS === '' ? Infinity : Number(playS);
    // `name` with no `|` at all = the committed caps, untouched.
    if (inkS) {   // counterfactual: put ink_stream back on its pre-71 footing
        const [pow, sc] = inkS.split('@');
        (ProgramRegistry as any).ink_stream.actions[0].power = Number(pow);
        (ProgramRegistry as any).ink_stream.actions[0].scaling = sc;
    }   // no `inkS` = leave the registry exactly as committed. `CAPS=` (empty) means uncapped,
        // which with the committed powers is the PRE-FIX arm; omit CAPS entirely for the
        // shipped state.
    results.push(scan(name));
}
console.log(JSON.stringify(results));
