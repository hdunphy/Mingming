/**
 * Ticket 104: the preview-parity sweep - does the hover number match what the card actually does?
 *
 * Henry, playtest round 3, three independent breaks in one night: *"Blood Rite estimated 4 damage,
 * but it did 5 damage + another 5 dmg"*, *"Deep vein predicted 9 dmg dealt 36 dmg"*, *"The previews
 * are broken almost everywhere... hard to play when you don't have all the right information."*
 *
 * The ticket's instruction is a PARITY SUITE rather than whack-a-mole: for every attack card in the
 * registry, across sampled battle states, assert that the preview total equals the damage the
 * target actually takes when the card is played through the real reducer. Whatever this run finds
 * IS the repair worklist.
 *
 * The comparison is deliberately end-to-end: preview number vs the target's actual HP loss
 * (shield absorption included, because that is what the player sees). Anything the executor,
 * firmware, or a rider adds is therefore in scope - which is the whole point, since the reported
 * breaks were a conditional branch and a firmware multiplier, neither of which the preview's
 * single-ATTACK-action model can see.
 *
 * env: SPECIES (limit to one), CARD (limit to one), STATES (which sampled states, default all)
 */
import { computeDamagePreview } from '../src/ui/utils/damagePreview';
import { battleReducer } from '../src/engine/battleReducer';
import { GetProgramData, ProgramRegistry } from '../src/engine/data/programRegistry';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { BALANCE_SPECIES, matchupScenario } from '../src/debug/balance/balanceScenarios';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import type { IBattleState, IBattleEntity, ProgramData, StatusType } from '../src/engine/types';

const ONLY_SPECIES = process.env.SPECIES;
const ONLY_CARD = process.env.CARD;

/**
 * The sampled states. Each one is a knob the reported breaks actually rode:
 *   - `fresh`      the control - nothing on, nothing spent
 *   - `hurt`       below the 50% HP line, which is what `blood_rite`'s conditional branch reads
 *   - `piles`      duality stacks on both sides, which are +1 power each since ticket 102
 *   - `midturn`    two cards already played and Energy spent - the turn-history scalers
 *   - `hoard`      Energized banked, which is what `deep_vein` reads
 */
interface Sample {
    name: string;
    apply: (state: IBattleState) => IBattleState;
}

const withStatus = (e: IBattleEntity, type: StatusType, stacks: number): IBattleEntity => ({
    ...e,
    statusEffects: [...e.statusEffects.filter(s => s.type !== type), { type, stacks, duration: -1 } as never],
});

const SAMPLES: Sample[] = [
    { name: 'fresh', apply: s => s },
    {
        name: 'hurt',
        apply: s => ({
            ...s,
            playerParty: s.playerParty.map((e, i) => i === 0 ? { ...e, currentHp: Math.floor(e.maxHp * 0.3) } : e),
        }),
    },
    {
        name: 'piles',
        apply: s => ({
            ...s,
            playerParty: s.playerParty.map((e, i) => i === 0 ? withStatus(e, 'Strengthened', 6) : e),
            enemyParty: s.enemyParty.map((e, i) => i === 0 ? withStatus(e, 'Dazed', 4) : e),
        }),
    },
    {
        name: 'midturn',
        apply: s => ({ ...s, cardsPlayedThisTurn: 2, lastEnergySpent: 2 } as IBattleState),
    },
    {
        name: 'hoard',
        apply: s => ({
            ...s,
            playerParty: s.playerParty.map((e, i) =>
                i === 0 ? withStatus({ ...e, currentEnergy: e.maxEnergy }, 'Energized', 4) : e),
        }),
    },
    {
        // The event-count scalers. Without these, every CARDS_DRAWN_TRIGGERED / CARDS_DISCARDED
        // card resolves to zero damage and the sweep SKIPS it - which would have left the exact
        // class of card that broke (`deep_vein` is hoard-scaled) uncovered by its own suite.
        name: 'counters',
        apply: s => ({
            ...s,
            cardsDrawnThisTurn: 3,
            nonNaturalCardsDrawnThisTurn: 3,
            cardsDiscardedThisTurn: 3,
            lastEnergySpent: 2,
        } as IBattleState),
    },
    {
        // Statuses ON THE TARGET: DAZED_STACKS, DISTINCT_STATUS, BURN_TIMES_ENERGY, STATUS_COUNT.
        name: 'loaded',
        apply: s => ({
            ...s,
            lastEnergySpent: 2,
            enemyParty: s.enemyParty.map((e, i) => i === 0
                ? withStatus(withStatus(withStatus(withStatus(e, 'Dazed', 4), 'Burn', 2), 'Poison', 3), 'Weakened', 2)
                : e),
        } as IBattleState),
    },
    {
        // BARKSHIELD_STACKS reads the CASTER's shield.
        name: 'shielded',
        apply: s => ({
            ...s,
            playerParty: s.playerParty.map((e, i) => i === 0 ? withStatus(e, 'BarkShield', 8) : e),
        }),
    },
];

/** Total HP the TARGET loses - shield absorption included, because that is what the player sees. */
const hpOf = (s: IBattleState, id: string): number => {
    const e = s.playerParty.find(x => x.id === id) ?? s.enemyParty.find(x => x.id === id);
    return (e?.currentHp ?? 0) + (e?.tempHp ?? 0);
};

interface Mismatch {
    card: string; species: string; sample: string; preview: number; actual: number;
}
const mismatches: Mismatch[] = [];
const skipReasons: string[] = [];
const previews: string[] = [];
let checked = 0;
let skipped = 0;

for (const species of BALANCE_SPECIES) {
    if (ONLY_SPECIES && species !== ONLY_SPECIES) continue;
    const entry = MingmingRegistry[species];
    // BOTH OSes, and the union of their decks - the first sweep only covered availableOS[0] and
    // missed `deep_vein` entirely, which is one of the two breaks Henry actually reported.
    const os = entry.availableOS[0];
    const cards = [...new Set(entry.availableOS.flatMap(
        (o: string) => (entry.decks as Record<string, string[]>)[o] ?? []))];

    for (const cardId of cards) {
        if (ONLY_CARD && cardId !== ONLY_CARD) continue;
        let data: ProgramData;
        try { data = GetProgramData(cardId); } catch { continue; }
        if (!data.actions?.some(a => a.type === 'ATTACK')) continue;

        for (const sample of SAMPLES) {
            // A fresh battle per sample, so nothing leaks between them.
            const setup = matchupScenario({
                player: species, enemy: species === 'control' ? 'ymir' : 'control',
                playerOS: os, enemyOS: species === 'control' ? 'ymir_v1' : 'control_v1',
                seed: `parity:${species}:${cardId}:${sample.name}`,
            });
            let st = buildScenarioState({ ...setup, seed: setup.seed }) as IBattleState;
            // Put the card in hand at full Energy so playability never blocks the preview.
            const me = st.playerParty[0];
            const them = st.enemyParty[0];
            if (!me || !them) { skipped++; continue; }
            st = {
                ...st,
                activeSide: 'PLAYER',
                playerParty: st.playerParty.map((e, i) =>
                    i === 0 ? { ...e, currentEnergy: Math.max(e.maxEnergy, 4) } : e),
                playerDeck: {
                    ...st.playerDeck,
                    hand: [{ id: 'parity_card', dataId: cardId, currentCost: 0, isPlayable: true }],
                },
            } as IBattleState;
            st = sample.apply(st);

            const preview = computeDamagePreview(st, me.id, 'parity_card', them.id);
            if (preview.damage <= 0) {
                skipped++;
                skipReasons.push(`${cardId}/${sample.name}`);
                continue;
            }
            previews.push(`${cardId.padEnd(22)}${sample.name.padEnd(9)}${preview.damage}` +
                `${preview.lethal ? ' LETHAL' : ''}${preview.hitCount > 1 ? ` x${preview.hitCount}` : ''}`);

            const before = hpOf(st, them.id);
            const after = battleReducer(st, {
                type: 'PLAY_PROGRAM',
                payload: { sourceId: me.id, targetId: them.id, programId: 'parity_card' },
            });
            if (after === st) { skipped++; continue; }
            const actual = before - hpOf(after, them.id);
            checked++;
            if (actual !== preview.damage) {
                mismatches.push({ card: cardId, species, sample: sample.name, preview: preview.damage, actual });
            }
        }
    }
}

const byCard = new Map<string, Mismatch[]>();
for (const m of mismatches) {
    if (!byCard.has(m.card)) byCard.set(m.card, []);
    byCard.get(m.card)!.push(m);
}

console.error(`\nPREVIEW PARITY   ${checked} checks, ${skipped} skipped   ` +
    `**${mismatches.length} MISMATCHES across ${byCard.size} cards**\n`);
const rows = [...byCard.entries()].sort((a, b) => {
    const worst = (ms: Mismatch[]) => Math.max(...ms.map(m => Math.abs(m.actual - m.preview) / Math.max(1, m.preview)));
    return worst(b[1]) - worst(a[1]);
});
for (const [card, ms] of rows) {
    const d = ms.map(m => `${m.sample} ${m.preview}->${m.actual}`).join('  ');
    console.error(`  ${card.padEnd(22)}${d}`);
}
console.error(`\nregistry has ${Object.keys(ProgramRegistry).length} cards; this sweep covers ` +
    `both OS decks of every balance species.`);
if (process.env.SHOW === 'skips') {
    console.error(`\nSKIPPED (${skipReasons.length}) - no damage to the target, so no preview:`);
    console.error('  ' + [...new Set(skipReasons.map(r => r.split('/')[0]))].join('  '));
}
if (process.env.SHOW === 'previews') {
    console.error(`\nEVERY PREVIEW (${previews.length}):`);
    for (const line of previews) console.error('  ' + line);
}
