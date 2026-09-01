/**
 * TICKET 129 — the hand economy at 3v3: leftover energy, leftover cards, and what an extra draw does.
 *
 * Henry: *"I seem to always play all my cards and often have an energy left over especially in these
 * zoo decks. The strategy then becomes what order instead of which cards to play. I've been
 * wondering what an extra card draw for every mingming might do."*
 *
 * That is two claims and a proposal, and they need separating before anything is tuned:
 *
 *   1. **The hand empties.** Cards left at end of turn should be ~0.
 *   2. **Energy is left over.** Unspent energy should be > 0 while the hand is empty - which is a
 *      DIFFERENT complaint from ticket 98's wasted-energy metric, where a body sat flush because
 *      the shared hand held nothing IT could cast. Both are measured here because they want
 *      opposite fixes: an empty hand wants more draw, a full hand with idle bodies wants cheaper
 *      or better-spread cards.
 *   3. **`--extradraw N` is the proposal**: +N `cardDraw` on every unit, which at 3v3 is +3N to the
 *      shared refill (`sum(cardDraw) - alive + 1`).
 *
 * IT ALSO COUNTS THE HAND-LIMIT CLIP, which decides whether Henry's "maybe up the hand limit"
 * is needed at all: `HAND_SIZE_LIMIT` is 9 and the refill is `min(total, 9 - hand.length)`. If the
 * clip never binds today, raising the limit changes nothing and only the draw matters.
 *
 * AND the triggered-draw rate, which is what `feedback_loop_daemon` is paid by:
 * `IBattleState.nonNaturalCardsDrawnThisTurn` counts exactly the draws its hook fires on
 * (`when: { isNaturalDraw: false }`). Henry: *"I draw about 1-3 times a hand"* - this is that claim,
 * measured, and it is what turns the daemon's price from an assumption into a number.
 *
 * Run: npx vite-node scratch/handeconomy.ts -- --width 3 --extradraw 0 --iter 4
 */

function arg(name: string, dflt?: string): string {
    const i = process.argv.indexOf(`--${name}`);
    const v = i === -1 ? undefined : process.argv[i + 1];
    if (v === undefined || v.startsWith('--')) {
        if (dflt === undefined) throw new Error(`handeconomy: --${name} is required`);
        return dflt;
    }
    return v;
}

const WIDTH = Number(arg('width', '3'));
const EXTRA = Number(arg('extradraw', '0'));
const ITER = Number(arg('iter', '4'));
const BEAM = arg('beam', '8');
/**
 * `--zeronerf 0.15` scales every 0-cost card's ATTACK power down by 15%.
 *
 * Henry: *"I like the extra card draw but I don't like the turns going down. Do we need to reduce
 * the damage on 0e cards? maybe thats why zoo is so strong."* The mechanism is real and worth
 * stating: **the energy cap does not restrain a 0-cost card, only the hand does.** So +1 draw a
 * body converts almost directly into extra 0e damage, while a 2e card still has to be paid for.
 * That is why more draw shortens the game rather than widening the choice.
 *
 * Applied to `programs.json` before the registry loads - `GetProgramData` inflates a fresh object
 * per call, so mutating anything later is the ticket-103 dead-arm trap.
 */
const ZERONERF = Number(arg('zeronerf', '0'));
/**
 * `--hpbuff 0.25` scales every unit's maxHp (and current HP) up by 25%, both sides.
 *
 * Henry: *"Maybe we give everyone a flat HP buff to extend games because the cards played just
 * shows that you were always leaving energy on the table which feels bad and its tough to get out
 * combos with only 3 cards and no drawing."*
 *
 * It is the OPPOSITE lever from `--extradraw` and worth measuring as such. Extra draw gives you more
 * cards per turn and shortens the game (measured: 5.2 -> 3.8 turns). More HP gives you more TURNS at
 * the same cards per turn, so the same deck gets drawn deeper over a battle without any one turn
 * getting bigger. If the complaint is "I cannot assemble a combo", those two are very different
 * medicines and only one of them keeps the pace.
 */
const HPBUFF = Number(arg('hpbuff', '0'));

if (ZERONERF > 0) {
    const PROGRAMS = (await import('../src/engine/data/programs.json')).default as unknown as
        Record<string, { baseCost: number | string; actions?: Array<{ type: string; power?: number }> }>;
    let touched = 0, before = 0, after = 0;
    for (const [, card] of Object.entries(PROGRAMS)) {
        if (card.baseCost !== 0 || !card.actions) continue;
        for (const a of card.actions) {
            if (a.type !== 'ATTACK' || typeof a.power !== 'number' || a.power <= 0) continue;
            before += a.power;
            a.power = Math.round(a.power * (1 - ZERONERF));
            after += a.power;
            touched++;
        }
    }
    // ASSERT THE ARM TOOK. A nerf that quietly hit nothing reads exactly like "this lever does
    // nothing", which is the failure family that has cost this project four measurements.
    if (touched === 0) throw new Error(`handeconomy: --zeronerf ${ZERONERF} touched NO 0e attack`);
    console.log(`ZERONERF ${(ZERONERF * 100).toFixed(0)}%: ${touched} attacks on 0e cards, `
        + `total power ${before} -> ${after}`);
}

const P = 'process', E = 'env';
const penv = ((globalThis as unknown as Record<string, Record<string, Record<string, string>>>)[P] ??= {} as never);
((penv[E] ??= {} as never)).AI_BEAM = BEAM;

async function main(): Promise<void> {
    const { battleReducer } = await import('../src/engine/battleReducer');
    const { getBestAction } = await import('../src/engine/ai/TacticalAI');
    const { buildScenarioState } = await import('../src/debug/scenarios/buildScenarioState');
    const { teamScenario } = await import('../src/debug/balance/balanceScenarios');
    const { deriveSeeds } = await import('../src/debug/balance/runBatch');
    const { HAND_SIZE_LIMIT } = await import('../src/engine/deckLogic');
    const { globalBattleEventBus } = await import('../src/engine/events');
    const { GetProgramData } = await import('../src/engine/data/programRegistry');
    const { numericBaseCost } = await import('../src/engine/types');
    type St = import('../src/engine/types').IBattleState;
    type Ent = import('../src/engine/types').IBattleEntity;

    type Member = readonly [string, string];
    // The zoo panel Henry names, and a control panel to read it against - his claim is that the
    // leftover energy is worst "especially in these zoo decks", so the two must be separable.
    const PANELS: Record<string, [Member[], Member[]]> = {
        zoo: [
            [['jormungandr', 'jormungandr_v1'], ['sleipnir', 'sleipnir_v1'], ['hraesvelgr', 'hraesvelgr_v1']],
            [['kraken', 'kraken_v1'], ['huldra', 'huldra_v1'], ['draugr', 'draugr_v2']],
        ],
        control: [
            [['kraken', 'kraken_v1'], ['huldra', 'huldra_v1'], ['draugr', 'draugr_v2']],
            [['jormungandr', 'jormungandr_v1'], ['sleipnir', 'sleipnir_v1'], ['hraesvelgr', 'hraesvelgr_v1']],
        ],
    };

    interface Acc {
        turns: number; battles: number;
        energyLeft: number; energyTotal: number;
        idleBodies: number; bodyTurns: number;
        cardsLeft: number; handAtRefill: number;
        clipped: number; clippedCards: number; refills: number;
        wanted: number; handAtTurnStart: number; turnStarts: number;
        /** Cards cast, split by whether they cost anything - the 0e share of the turn. */
        castsZero: number; castsPaid: number;
        triggered: number[];               // non-natural draws per turn, SIDE-WIDE
        /**
         * Per-unit triggered draws - what `feedback_loop_daemon` is actually paid by.
         *
         * Its hook is `onCardDraw` gated `when: { source: SELF, isNaturalDraw: false }`, and
         * `resolutionEngine` sets that source to the unit that CAUSED the draw. At 3v3 the deck is
         * shared, so an ally casting the draw card procs nothing. The side-wide number above is
         * therefore an UPPER BOUND on what the daemon sees, and this is the real one.
         */
        ownerTriggered: number[];
    }
    const blank = (): Acc => ({
        turns: 0, battles: 0, energyLeft: 0, energyTotal: 0, idleBodies: 0, bodyTurns: 0,
        cardsLeft: 0, handAtRefill: 0, clipped: 0, clippedCards: 0, refills: 0, triggered: [],
        wanted: 0, handAtTurnStart: 0, turnStarts: 0, ownerTriggered: [],
        castsZero: 0, castsPaid: 0,
    });

    /** +EXTRA cardDraw and/or +HPBUFF maxHp on every unit, both sides - applied symmetrically. */
    const bump = (s: St): St => {
        if (EXTRA === 0 && HPBUFF === 0) return s;
        const one = (e: Ent): Ent => {
            const maxHp = HPBUFF === 0 ? e.maxHp : Math.round(e.maxHp * (1 + HPBUFF));
            return {
                ...e,
                cardDraw: e.cardDraw + EXTRA,
                maxHp,
                // Scaled, not topped up: starting at full is what the battle already does, and
                // adding flat HP to a wounded unit would be a heal rather than a bigger frame.
                currentHp: HPBUFF === 0 ? e.currentHp : Math.round(e.currentHp * (1 + HPBUFF)),
            };
        };
        return { ...s, playerParty: s.playerParty.map(one), enemyParty: s.enemyParty.map(one) };
    };

    for (const [label, [mine, theirs]] of Object.entries(PANELS)) {
        const acc = blank();
        const setup = teamScenario({
            player: mine.slice(0, WIDTH) as Member[],
            enemy: theirs.slice(0, WIDTH) as Member[],
            seed: `handecon:${label}:w${WIDTH}`,
        });

        for (const seed of deriveSeeds(setup.seed, ITER)) {
            let state: St = bump(buildScenarioState({ ...setup, seed }));
            acc.battles++;
            let guard = 0;
            let side = state.activeSide;
            /** What each side was holding when it last gave up its turn - the cap's real input. */
            const lastEndHand = new Map<string, number>();

            while (guard++ < 3000) {
                // A turn: play until the AI ends it, then read the leftovers BEFORE the end resolves.
                const partyKey = state.activeSide === 'PLAYER' ? 'playerParty' : 'enemyParty';
                const deckKey = state.activeSide === 'PLAYER' ? 'playerDeck' : 'enemyDeck';

                // WHETHER THE HAND CAP CLIPPED THIS TURN'S REFILL.
                //
                // Measured against the hand THIS SIDE ENDED ITS LAST TURN HOLDING, which is what
                // the reducer's `min(wanted, LIMIT - hand.length)` actually sees. The first version
                // of this compared `wanted` against the room left in the hand as it stands HERE -
                // which is already post-refill - and reported the cap clipping 84% of refills and
                // eating three cards a turn. That number was an artefact of reading the tape after
                // the draw had happened, and it pointed at exactly the change Henry was asking
                // about, which is the worst direction for a measurement error to fail in.
                const alive = state[partyKey].filter((e: Ent) => e.currentHp > 0);
                const prevEnd = lastEndHand.get(state.activeSide);
                if (alive.length > 0 && prevEnd !== undefined) {
                    const wanted = alive.reduce((t: number, e: Ent) => t + e.cardDraw, 0) - alive.length + 1;
                    const room = HAND_SIZE_LIMIT - prevEnd;
                    acc.refills++;
                    acc.handAtRefill += prevEnd;
                    acc.wanted += wanted;
                    if (wanted > room) { acc.clipped++; acc.clippedCards += wanted - room; }
                }
                acc.handAtTurnStart += state[deckKey].hand.length;
                acc.turnStarts++;
                const energyAtStart = state[partyKey]
                    .filter((e: Ent) => e.currentHp > 0)
                    .reduce((t: number, e: Ent) => t + e.currentEnergy, 0);
                const spentBy = new Map<string, number>();

                let acted = 0;
                while (acted++ < 60) {
                    const action = getBestAction(state);
                    if (action.type === 'END_TURN') break;
                    if (action.type === 'PLAY_PROGRAM') {
                        const pay = action.payload as { sourceId: string; programId: string };
                        spentBy.set(pay.sourceId, (spentBy.get(pay.sourceId) ?? 0) + 1);
                        const inHand = state[deckKey].hand.find(c => c.id === pay.programId);
                        const data = inHand ? GetProgramData(inHand.dataId) : undefined;
                        if (data && numericBaseCost(data.baseCost) === 0) acc.castsZero++;
                        else acc.castsPaid++;
                    }
                    const next = globalBattleEventBus.runMuted(() => battleReducer(state, action));
                    if (next === state) break;
                    state = next;
                }

                // Leftovers, read at the moment the side gives up its turn.
                const endParty = state[partyKey].filter((e: Ent) => e.currentHp > 0);
                acc.turns++;
                acc.energyTotal += Math.max(1, energyAtStart);
                acc.energyLeft += endParty.reduce((t: number, e: Ent) => t + e.currentEnergy, 0);
                acc.bodyTurns += endParty.length;
                acc.idleBodies += endParty.filter((e: Ent) => !spentBy.has(e.id)).length;
                acc.cardsLeft += state[deckKey].hand.length;
                lastEndHand.set(state.activeSide, state[deckKey].hand.length);
                acc.triggered.push(state.nonNaturalCardsDrawnThisTurn ?? 0);
                // Every living body's own count, so the distribution across a shared deck is
                // visible rather than averaged away.
                for (const e of endParty) {
                    acc.ownerTriggered.push((e as unknown as { nonNaturalDrawsThisTurn?: number })
                        .nonNaturalDrawsThisTurn ?? 0);
                }

                const ended = globalBattleEventBus.runMuted(() =>
                    battleReducer(state, { type: 'END_TURN' } as never));
                if (ended === state) break;
                state = ended;
                side = state.activeSide;
                void side;

                if (state.playerParty.every((e: Ent) => e.currentHp <= 0)
                    || state.enemyParty.every((e: Ent) => e.currentHp <= 0)) break;
                if (state.turn > 40) break;
            }
        }

        const mean = (a: number[]): number => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
        const share = (a: number, b: number): string => `${((a / Math.max(1, b)) * 100).toFixed(1)}%`;
        console.log(`PANEL ${label}  width ${WIDTH}  extradraw +${EXTRA}  hpbuff +${(HPBUFF * 100).toFixed(0)}%  beam ${BEAM}  `
            + `${acc.battles} battles, ${acc.turns} side-turns`);
        console.log(`  energy unspent at end of turn : ${share(acc.energyLeft, acc.energyTotal)}`
            + `  (${(acc.energyLeft / Math.max(1, acc.turns)).toFixed(2)} per turn)`);
        console.log(`  bodies that spent NOTHING     : ${share(acc.idleBodies, acc.bodyTurns)}`);
        console.log(`  cards left in hand at end     : ${(acc.cardsLeft / Math.max(1, acc.turns)).toFixed(2)}`);
        console.log(`  hand carried INTO the refill  : ${(acc.handAtRefill / Math.max(1, acc.refills)).toFixed(2)}`
            + `   (limit ${HAND_SIZE_LIMIT}, so room ${(HAND_SIZE_LIMIT - acc.handAtRefill / Math.max(1, acc.refills)).toFixed(2)})`);
        console.log(`  refill WANTED                 : ${(acc.wanted / Math.max(1, acc.refills)).toFixed(2)} cards`);
        console.log(`  hand after the refill         : ${(acc.handAtTurnStart / Math.max(1, acc.turnStarts)).toFixed(2)}`);
        console.log(`  refills CLIPPED by the limit  : ${share(acc.clipped, acc.refills)}`
            + `  losing ${(acc.clippedCards / Math.max(1, acc.refills)).toFixed(2)} cards/refill`);
        console.log(`  triggered draws per turn      : mean ${mean(acc.triggered).toFixed(2)} side-wide`
            + `   zero on ${share(acc.triggered.filter(x => x === 0).length, acc.triggered.length)} of turns`);
        console.log(`  ...PER UNIT (what a daemon sees): mean ${mean(acc.ownerTriggered).toFixed(2)}`
            + `   zero on ${share(acc.ownerTriggered.filter(x => x === 0).length, acc.ownerTriggered.length)} of unit-turns`
            + `   best unit-turn ${Math.max(0, ...acc.ownerTriggered)}`);
        const casts = acc.castsZero + acc.castsPaid;
        console.log(`  cards cast per turn           : ${(casts / Math.max(1, acc.turns)).toFixed(2)}`
            + `   of which 0e: ${share(acc.castsZero, casts)}`);
        console.log(`  turns per battle              : ${(acc.turns / Math.max(1, acc.battles) / 2).toFixed(1)}`);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
