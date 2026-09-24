/**
 * EVERY CARD 162a AUTHORED, CAST ONCE, ON A BOARD THAT CAN SHOW WHAT IT DID.
 *
 * Henry, 2026-09-24: *"Can you run a headless test of each of the new cards to make sure there are
 * no bugs. I want a smooth play test tonight."*
 *
 * # WHY A DUMP AND NOT ONLY ASSERTIONS
 *
 * `cardEffects.test.ts` holds the assertions, and it is the thing that keeps working. This prints
 * what each card ACTUALLY DID, because a card can pass every assertion somebody thought to write
 * and still be wrong in a way nobody predicted — the whole reason to look is to find the effect you
 * would not have thought to assert. Two of the three bugs this found were of that kind.
 *
 * # THE BOARD, AND WHY IT IS STOCKED
 *
 * A card that reads a pile does nothing visible on an empty board, so the target starts with one of
 * everything a card in this collection might read (Burn, Poison, Dazed, Weakened) and the caster
 * starts with Sharp, Strength, Bark Shield and Burn of its own. Both sit at half HP so a heal and a
 * recoil are both visible, and the caster has a stocked drawpile so a DRAW is not silently a no-op.
 *
 * The second pass is the same cards against an EMPTY board, which is where a consume or a scaler
 * that misreads "nothing" as "something" shows up — `bark_smash` on no shield, `venom_glut` on a
 * clean target, `flashover` on an unburnt one.
 *
 * Run: npx vite-node scratch/t162_cardcheck.ts            (both passes)
 *      npx vite-node scratch/t162_cardcheck.ts -- --bare  (the empty board only)
 */
import { battleReducer } from '../src/engine/battleReducer';
import { createSparseBattleState, createSparseEntity } from '../src/debug/scenarios/scenarioTestSupport';
import { GetProgramData } from '../src/engine/data/programRegistry';
import type { IBattleState, IBattleEntity, StatusEffectInstance } from '../src/engine/types';

/** Every id whose actions `scratch/t162a_build.py` authored — the new 24 plus the 13 revised. */
const CARDS = [
    'soothe', 'mend', 'forage',
    'ignite', 'ember_jab', 'brand', 'flare_burst', 'pack_tactics', 'howl', 'snarl', 'snap',
    'brute_force', 'ragnarok_edge', 'desperate_strike', 'slag_strike', 'cinder_lance', 'sharp_edge',
    'flashover', 'wildfire',
    'crushing_depths', 'slander', 'ink_cloud', 'surge_protection', 'riptide_run', 'tide_pool',
    'tidal_battery', 'venom_fang', 'serpent_flurry', 'venom_glut', 'scald', 'boiling_surge',
    'maelstrom', 'hydro_blast', 'tidal_wave',
    'acorn_toss', 'seed_bomb', 'tend', 'bolster', 'verdant_ward', 'pollen_cloud', 'heckle',
    'pile_on', 'crippling_vine', 'sap_strength', 'shell_share', 'bark_smash', 'blightbloom',
    'overclock_core', 'short_fuse', 'static_ward', 'ember_ward', 'thermal_overload',
    'undertow', 'hoofbeat',
];

const FRAME = 1000;
const st = (id: string, type: string, stacks: number): StatusEffectInstance =>
    ({ id: `${id}-${type}`, type, stacks }) as StatusEffectInstance;

function board(stocked: boolean): IBattleState {
    const caster = createSparseEntity({
        id: 'p1', name: 'Caster', currentHp: FRAME / 2, maxHp: FRAME, currentEnergy: 5, maxEnergy: 5,
        statusEffects: stocked
            ? [st('p1', 'Sharp', 3), st('p1', 'Strengthened', 4), st('p1', 'BarkShield', 6), st('p1', 'Burn', 2)]
            : [],
    });
    const ally = createSparseEntity({
        id: 'p2', name: 'Ally', currentHp: FRAME / 2, maxHp: FRAME, currentEnergy: 5, maxEnergy: 5,
        statusEffects: stocked ? [st('p2', 'Weakened', 2)] : [],
    });
    const foe = (id: string, name: string) => createSparseEntity({
        id, name, currentHp: FRAME, maxHp: FRAME, currentEnergy: 3, maxEnergy: 3,
        statusEffects: stocked
            ? [st(id, 'Burn', 2), st(id, 'Poison', 3), st(id, 'Dazed', 3), st(id, 'Weakened', 2)]
            : [],
    });
    const pile = Array.from({ length: 6 }, (_, i) => (
        { id: `d${i}`, dataId: 'tackle', currentCost: 0, isPlayable: true }
    ));
    return createSparseBattleState({
        activeSide: 'PLAYER', phase: 'ACTION',
        playerParty: [caster, ally],
        enemyParty: [foe('e1', 'Foe A'), foe('e2', 'Foe B')],
        playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: pile, discard: [], exhaust: [], hand: [] },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], discard: [], exhaust: [], hand: [] },
    });
}

interface Snap { hp: number; energy: number; maxEnergy: number; status: Record<string, number> }
const snap = (e: IBattleEntity): Snap => ({
    hp: e.currentHp, energy: e.currentEnergy, maxEnergy: e.maxEnergy,
    status: Object.fromEntries(e.statusEffects.filter((s) => s.stacks !== 0).map((s) => [s.type, s.stacks])),
});
const find = (s: IBattleState, id: string) =>
    s.playerParty.find((e) => e.id === id) ?? s.enemyParty.find((e) => e.id === id)!;

/** What changed on one body, as a phrase, or '' when nothing did. */
function delta(before: Snap, after: Snap): string {
    const bits: string[] = [];
    if (after.hp !== before.hp) bits.push(`hp ${after.hp - before.hp > 0 ? '+' : ''}${after.hp - before.hp}`);
    if (after.energy !== before.energy) bits.push(`energy ${after.energy - before.energy > 0 ? '+' : ''}${after.energy - before.energy}`);
    if (after.maxEnergy !== before.maxEnergy) bits.push(`MAXenergy ${after.maxEnergy - before.maxEnergy > 0 ? '+' : ''}${after.maxEnergy - before.maxEnergy}`);
    for (const type of new Set([...Object.keys(before.status), ...Object.keys(after.status)])) {
        const d = (after.status[type] ?? 0) - (before.status[type] ?? 0);
        if (d !== 0) bits.push(`${type} ${d > 0 ? '+' : ''}${d}`);
    }
    return bits.join('  ');
}

function cast(dataId: string, stocked: boolean): { lines: string[]; problems: string[] } {
    const data = GetProgramData(dataId);
    const base = board(stocked);
    const aimAtAlly = data.allyTarget === true;
    const targetId = aimAtAlly ? 'p2' : 'e1';

    const withHand: IBattleState = {
        ...base,
        playerDeck: {
            ...base.playerDeck,
            hand: [{ id: 'h1', dataId, currentCost: data.baseCost as number, isPlayable: true }],
        },
    };
    const beforeAll = ['p1', 'p2', 'e1', 'e2'].map((id) => [id, snap(find(withHand, id))] as const);
    const beforeHand = withHand.playerDeck.hand.length;
    const beforeDraw = withHand.playerDeck.drawpile.length;

    const after = battleReducer(withHand, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: 'p1', targetId, programId: 'h1' },
    } as never);

    const lines: string[] = [];
    const problems: string[] = [];
    const drew = beforeDraw - after.playerDeck.drawpile.length;
    const handNow = after.playerDeck.hand.length;

    for (const [id, was] of beforeAll) {
        const d = delta(was, snap(find(after, id)));
        if (d) lines.push(`      ${id === 'p1' ? 'p1 CASTER' : id === 'p2' ? 'p2 ally  ' : id === 'e1' ? 'e1 TARGET' : 'e2 other '}  ${d}`);
    }
    if (drew !== 0) lines.push(`      drew ${drew}`);

    // ── the things that are a BUG whatever the card says ──────────────────────────────────────
    /*
     * A refused play leaves the card in hand. The arithmetic has to allow for the card's OWN draw,
     * though — `forage` and `ignite` both put a card back into the hand they just left, and the
     * naive check (`hand did not shrink`) called both of them refused on the first run of this
     * script. That is the shape of false positive worth writing down: an assertion about a card
     * that does not know what the card does.
     */
    if (handNow !== beforeHand - 1 + drew) {
        problems.push(`hand went ${beforeHand} -> ${handNow} on a cast that drew ${drew}: expected ${beforeHand - 1 + drew}`);
    }
    if (lines.length === 0) {
        problems.push('resolved with no observable effect on any body');
    }
    const casterAfter = snap(find(after, 'p1'));
    if (casterAfter.energy > 5 && dataId !== 'surge_protection' && dataId !== 'riptide_run') {
        problems.push(`gained Energy above the frame (${casterAfter.energy})`);
    }
    for (const id of ['p1', 'p2', 'e1', 'e2']) {
        for (const [type, stacks] of Object.entries(snap(find(after, id)).status)) {
            if (stacks < 0) problems.push(`${id} holds NEGATIVE ${type} (${stacks})`);
            if (!Number.isInteger(stacks) && type !== 'BarkShield') {
                problems.push(`${id} holds FRACTIONAL ${type} (${stacks})`);
            }
        }
    }
    return { lines, problems };
}

const BARE_ONLY = process.argv.includes('--bare');
let issues = 0;

for (const stocked of BARE_ONLY ? [false] : [true, false]) {
    console.log(`\n${'='.repeat(100)}`);
    console.log(stocked
        ? 'PASS 1 — STOCKED BOARD. Caster: 500/1000 hp, Sharp 3, Strength 4, Bark 6, Burn 2, 6-card drawpile.'
        : 'PASS 2 — EMPTY BOARD. No statuses anywhere. This is where a consume or a scaler that misreads'
          + '\n         "nothing" as "something" shows itself.');
    if (stocked) console.log('         Target e1: Burn 2, Poison 3, Dazed 3, Weakened 2.   Ally p2: Weakened 2, 500 hp.');
    console.log('='.repeat(100));

    for (const id of CARDS) {
        const data = GetProgramData(id);
        const { lines, problems } = cast(id, stocked);
        const aim = data.allyTarget ? 'at ALLY p2' : 'at FOE e1';
        console.log(`\n  ${data.name}  (${id}, ${data.baseCost}e ${data.target}${data.allyTarget ? '+ally' : ''}, ${aim})`);
        console.log(`      "${data.description}"`);
        for (const l of lines) console.log(l);
        for (const p of problems) { console.log(`      *** ${p}`); issues++; }
    }
}

console.log(`\n${'='.repeat(100)}`);
console.log(issues === 0 ? 'No automatic problems flagged.' : `${issues} automatic problem(s) flagged above — read the *** lines.`);
console.log('The flags are crude by design: refused plays, no-ops, negative or fractional stacks, runaway Energy.');
console.log('Everything else needs reading against the printed text, which is the point of the dump.');
