
import { battleReducer, validateProgramConstraints, getEffectiveCardCost, type BattleAction } from '../battleReducer';
import type { IBattleState, IBattleEntity } from '../types';
import { globalBattleEventBus } from '../events';
import { GetProgramData } from '../data/programRegistry';
import { PRNG } from '../core/PRNG';
import { executeCostCalculated } from '../resolutionEngine';
import { BURN_CONFIG } from '../StatusBehaviors';
import { STANCE_BONUS, STATUS_MODEL } from '../core/Hooks';
import { getOSBehavior } from '../data/firmwareRegistry';

/**
 * Mechanics-aware board evaluation - docs/wayfinder/deck-archetypes/tickets/19-ai-measurement-upgrade.md.
 *
 * The old hand-typed STATUS_SCORES table valued Poison at a flat -3/stack against a
 * quadratic mechanic and did not know Energized existed, so the AI never played
 * contagion or capacitor (0 plays in 100 audited battles - ticket 18). Every value
 * below is now DERIVED from what the mechanic actually does, in one currency:
 * eval points = HP_POINTS x HP. Derivations are approximations only where a
 * mechanic's value depends on the future (horizon constants, documented inline);
 * DoT/HoT totals use the exact engine formulas from StatusBehaviors.ts.
 */

/** Eval currency: points per HP (kept from the original eval - HP x 2). */
const HP_POINTS = 2;

/**
 * Ticket 44: the value of ending the game. Deliberately far above any reachable board score - a
 * full 200 HP frame with every buff is worth a few hundred - so that winning dominates every
 * positional consideration and losing is worse than any board, rather than competing with them.
 */
const TERMINAL_SCORE = 10000;

/**
 * A side's per-turn damage throughput, as a fraction of a frame's maxHp. Base-deck
 * battles decide in ~5 turns (balance suite averageTurns 5-6), so each side removes
 * ~a full frame over ~5 turns => ~20%/turn. Used to convert "a turn" or "a % damage
 * swing" into HP.
 */
const TURN_DAMAGE_FRACTION = 0.20;

/** Statuses that scale future turns are valued over the average remaining battle length. */
const STATUS_HORIZON_TURNS = 2.5;

/** 1 energy ~ 1/4 of a turn's throughput (4-energy turns at the balance frame). */
const ENERGY_TURN_FRACTION = 0.25;

/**
 * Ticket 27: cards in hand. The old eval scored HP and statuses only, so a card was worth
 * ZERO - "draw a card" payoffs were invisible and discarding cost nothing. The limiting
 * resource is ENERGY, not cards: a side casts about `maxEnergy` cards a turn however many it
 * holds, so the first `maxEnergy` cards carry real value and the rest is overdraw worth a
 * tenth as much. That is deliberately kind to discard archetypes - shedding cards you could
 * never afford to cast is nearly free, which is the trade a windmill deck is making.
 *
 * This is the truthful reading, and it re-rates decks accordingly: kraken's §2.3 moves
 * 0.57 -> 0.68, which says the kraken v1 list is stronger than the old eval could see.
 * Accepted knowingly - Water gets re-gated after every species has had a first pass.
 */
const CARD_VALUE_TURNS = 0.25;
const CARD_OVERDRAW_DISCOUNT = 0.1;

function handValue(state: IBattleState, side: 'PLAYER' | 'ENEMY'): number {
    const party = side === 'PLAYER' ? state.playerParty : state.enemyParty;
    const deck = side === 'PLAYER' ? state.playerDeck : state.enemyDeck;
    const frame = party[0];
    if (!frame) return 0;
    const window = Math.max(1, frame.maxEnergy);
    // Cards already cast this turn still count as held. Without this the term is a
    // double charge on the play decision: the search books the card's EFFECT in the leaf
    // state and simultaneously books -1 card, so a play only looked good if it beat the
    // stock value of the card it spent. On a 75 HP frame that is a 7.5-point toll, and
    // every sub-4-damage card in the game became strictly worse than ending the turn.
    // Counting in-flight cards makes PLAY neutral in this term while DRAW still gains and
    // DISCARD still costs - which is the only thing the term was added to see.
    const inFlight = side === state.activeSide ? (state.cardsPlayedThisTurn ?? 0) : 0;
    const held = deck.hand.length + inFlight;
    return HP_POINTS * frame.maxHp * TURN_DAMAGE_FRACTION * CARD_VALUE_TURNS
        * (Math.min(held, window) + Math.max(0, held - window) * CARD_OVERDRAW_DISCOUNT);
}

/** Mirrors Hooks.ts applyDamageModifiers: 2%/stack, net cap 25% either way. */
const STATUS_PCT_PER_STACK = 0.02;
const STATUS_PCT_CAP = 0.25;
const cappedPct = (stacks: number): number => Math.min(STATUS_PCT_CAP, stacks * STATUS_PCT_PER_STACK);

/** Total future Burn damage as a fraction of maxHp: tier table walked S -> 1 (Burn decays 1/turn). */
function burnTotalPercent(stacks: number): number {
    // Ticket 62: read the LIVE Burn tier table, not the static gameConfig one. Identical as
    // committed (BURN_CONFIG.tiers is that array), but a grid arm that changes the cap changes
    // the climb - and an eval that valued Burn off a stale table would judge every arm against
    // the wrong shape, which is the failure family ticket 40's Poison cap already cost us.
    const tiers = BURN_CONFIG.tiers;
    let total = 0;
    for (let s = stacks; s >= 1; s--) {
        const tier = tiers[s - 1] ?? tiers[tiers.length - 1];
        total += tier.damagePercent;
    }
    // Ticket 44: the same shape ticket 40 found in Poison. The decay sum is the right TOTAL, but
    // only if the battle lasts `stacks` more turns, and it does not - battles run 5-6. Burn's
    // top tier is 8%/turn, so the sum runs away fast: 10 stacks reads as 69% of a health bar,
    // which the holder will be dead long before collecting. Capped at the per-turn rate over the
    // same horizon every other future-scaling status uses. Below ~3 stacks the sum still binds,
    // because Burn genuinely does decay away inside the horizon.
    const perTurn = (tiers[Math.min(stacks, tiers.length) - 1] ?? tiers[tiers.length - 1]).damagePercent;
    return Math.min(total, perTurn * STATUS_HORIZON_TURNS);
}

/**
 * What `stacks` of a duality status are worth to their holder, in eval points.
 *
 * POWER shape: `powerPerStack` power on each attack across the horizon. A card's power converts to
 * damage through the pace divisor, so one power is worth `1 / POWER_PER_TURN_DAMAGE` of a turn's
 * throughput - approximated here from the same frame proxy the rest of this file uses, which keeps
 * the units consistent with `TURN_DAMAGE_FRACTION`.
 *
 * PERCENT shape: the historical capped-percentage reading, kept so the eval follows the engine if
 * the shape is ever switched back.
 */
function dualityValue(stacks: number, entity: IBattleEntity): number {
    if (STATUS_MODEL.shape !== 'POWER') {
        return HP_POINTS * entity.maxHp * TURN_DAMAGE_FRACTION * STATUS_HORIZON_TURNS * cappedPct(stacks);
    }
    // A typical card carries ~40 power (the 1e budget), so one power is ~1/40th of a card and a
    // turn is ~2 cards: `powerPerStack` stacks therefore move about `stacks / 80` of a turn's
    // damage per attack, across `STATUS_HORIZON_TURNS` turns of ~2 attacks each.
    const POWER_PER_CARD = 40;
    const CARDS_PER_TURN = 2;
    const fraction = (STATUS_MODEL.powerPerStack * stacks) / (POWER_PER_CARD * CARDS_PER_TURN);
    return HP_POINTS * entity.maxHp * TURN_DAMAGE_FRACTION * STATUS_HORIZON_TURNS * fraction;
}

/**
 * Eval contribution of one status instance on its holder (positive = good for the holder).
 */
function statusValue(type: string, stacks: number, entity: IBattleEntity): number {
    const s = stacks;
    switch (type) {
        case 'Poison':
            // 1% maxHp x stacks per tick, decrementing => total future damage
            // = maxHp/100 x S(S+1)/2 (StatusBehaviors PoisonBehavior.endTurn) - but ONLY if
            // the battle lasts S more turns, and it does not. Ticket 40 caps the sum at the
            // same horizon every other future-scaling status is valued over, which matters in
            // two places:
            //
            //  - A big pile was priced above the opponent's whole health bar. At 18 stacks on
            //    an 87 HP frame the uncapped sum is 171% of maxHp; the enemy dies long before
            //    collecting it.
            //  - nidhoggr_v1's ROOT_CORRUPTION stops poison decaying at 2+ stacks, so the
            //    triangular shape is not merely optimistic there, it is the WRONG SHAPE -
            //    corrupted poison is linear in turns. The uncapped value made cashing the pile
            //    in (`wither_feast`) score ~200 points WORSE than holding it, so the AI never
            //    played the deck's payoff card once in 100 games. Same failure family as
            //    ticket 34's Regen: the engine and the eval have to model the same shape.
            //
            // The cap is the honest floor for both shapes - hold or cash, you collect about
            // STATUS_HORIZON_TURNS more ticks either way, which is exactly the break-even the
            // detonate is designed around.
            return -HP_POINTS * entity.maxHp * 0.01 * Math.min(s * (s + 1) / 2, s * STATUS_HORIZON_TURNS);
        case 'Burn':
            // Tiered % maxHp per tick (1.5/3.5/8%), decays 1/turn. Def shred ignored (small).
            return -HP_POINTS * entity.maxHp * burnTotalPercent(s);
        case 'Regen':
            // 3% maxHp x stacks per tick, decrementing; healing past full is wasted,
            // so the total is capped at the holder's missing HP.
            // Ticket 34: flat 3%/turn for `s` turns - LINEAR in stacks, not triangular.
            return HP_POINTS * Math.min(0.03 * s * entity.maxHp, entity.maxHp - entity.currentHp);
        case 'Energized':
            // +stacks energy next turn; 1 energy ~ ENERGY_TURN_FRACTION of a turn's damage.
            return HP_POINTS * entity.maxHp * TURN_DAMAGE_FRACTION * ENERGY_TURN_FRACTION * s;
        // TICKET 102: the duality pair is POWER now, not a capped percentage, so the eval has to
        // stop reading a ceiling that no longer exists. A stack is `powerPerStack` power on every
        // relevant attack over the horizon; `dualityValue` converts that into the same HP-points
        // currency everything else here uses, and is LINEAR in stacks because the effect is.
        //
        // This matters more than a tidy-up: while `statusValue` capped at 13 stacks, an AI holding
        // 20 Strengthened valued the 14th through 20th at zero and would happily trade them away.
        // The stance lesson from ticket 78 is the precedent - an eval that cannot see a mechanic
        // plays as if the mechanic is not there.
        case 'Strengthened':
            return dualityValue(s, entity);
        case 'Weakened':
            return -dualityValue(s, entity);
        case 'Sharp':
            return dualityValue(s, entity);
        case 'Dazed':
            return -dualityValue(s, entity);
        case 'Stunned':
            // Lose the next turn entirely: one full turn of throughput.
            return -HP_POINTS * entity.maxHp * TURN_DAMAGE_FRACTION;
        case 'Asleep':
            // Ticket 48: Asleep is only a lost turn for a unit that CANNOT act through it. At three
            // stacks the line below prices it at -60% of a health pool, so without this the search
            // would never play a self-sleep card and draugr_v1 would measure as unplayable for a
            // reason that looks nothing like balance. Same failure family as ticket 40's Poison
            // horizon, caught before the run this time.
            if (getOSBehavior(entity.activeOS ?? '')?.actsWhileAsleep) return 0;
            // Skip `stacks` turns (max 3), same per-turn value as Stunned.
            return -HP_POINTS * entity.maxHp * TURN_DAMAGE_FRACTION * s;
        case 'BarkShield':
            // Absorb pool of stacks% maxHp, decaying 20%/turn: worth ~80% of face value.
            return HP_POINTS * entity.maxHp * (s / 100) * 0.8;
        case 'LightStance':
            // Ticket 78: the stances used to fall through to the `default: return 0` below,
            // which meant the AI could not see any reason to END ITS TURN holding one. That is
            // the whole of hel_v1's design - group your damage, close on a Light card so the
            // shield is up while the opponent swings - and the search was blind to it. Measured
            // in ticket 77: forcing the correct line by policy was worth +5.3 points of field
            // and took the damage she absorbs in Light stance from 25% to 48%.
            //
            // Valued as ONE opponent turn of throughput times the reduction. One turn, not
            // STATUS_HORIZON_TURNS, because a stance is not durational - it survives exactly
            // until its holder casts a card of the other element, which is typically their very
            // next action. This is the honest floor for a status that reliably covers the swing
            // you are about to take and rarely more.
            return HP_POINTS * entity.maxHp * TURN_DAMAGE_FRACTION * STANCE_BONUS.light;
        case 'DarkStance':
            // Worth strictly LESS than LightStance at the moment a turn ends, and the asymmetry
            // is real rather than a thumb on the scale for hel: Light pays on the opponent's
            // NEXT turn, which is certain and immediate, while Dark pays only on your own next
            // turn, only if the first thing you do is attack, and only if you are still alive.
            // Same-turn Dark damage needs no term here at all - the search simulates the attack
            // and sees the bigger number directly, so pricing it at full value would count it
            // twice. Halved for the contingency.
            return HP_POINTS * entity.maxHp * TURN_DAMAGE_FRACTION * STANCE_BONUS.dark * 0.5;
        default:
            // StableOS, Awoken, marker statuses: situational, valued 0.
            return 0;
    }
}

/**
 * Calculates the 'Board Score' for a single entity.
 * Formula: (Current_HP x HP_POINTS) + Sum(mechanics-derived status values)
 */
function getEntityScore(entity: IBattleEntity): number {
    if (entity.currentHp <= 0) return 0; // Dead units have 0 score

    // Ticket 27: HP is CONCAVE, not linear - the last sliver keeps you alive, the top of the
    // bar is spendable. Linear HP made the AI take the bigger damage line right up to death
    // (fenrir_v1 dove to 13.9% average HP in 40/40 games and cast its heal once). Blended 85%
    // toward sqrt and 15% back toward linear per Henry: enough to make healing urgent while
    // dying and spending cheap while healthy, without rewriting every matchup's instincts.
    const hpFraction = entity.currentHp / Math.max(1, entity.maxHp);
    const concavity = 0.85;
    let score = HP_POINTS * entity.maxHp
        * (concavity * Math.sqrt(hpFraction) + (1 - concavity) * hpFraction);

    for (const status of entity.statusEffects) {
        score += statusValue(status.type, status.stacks, entity);
    }

    // Ticket 27: an INSTALLED daemon is worth something. Its whole value is future hooks, and
    // scoring installs at 0 meant the AI almost never played one - core_overclock_daemon and
    // hoofbeat_daemon both sat at an 18% play rate for 0 damage. Valued at half a turn's
    // throughput apiece, a deliberate under-estimate since the alternative was zero. Measured:
    // both rose to ~60% played.
    score += (entity.daemons?.length ?? 0) * HP_POINTS * entity.maxHp * TURN_DAMAGE_FRACTION * 0.5;

    return score;
}

/**
 * Evaluates the total board state for a specific side.
 * Formula: Sum(Ally_Scores) - Sum(Enemy_Scores)
 * Higher is better.
 */
function evaluateState(state: IBattleState, side: 'PLAYER' | 'ENEMY'): number {
    const myPartyKey = side === 'PLAYER' ? 'playerParty' : 'enemyParty';
    const oppPartyKey = side === 'PLAYER' ? 'enemyParty' : 'playerParty';

    const myScore = state[myPartyKey].reduce((sum, e) => sum + getEntityScore(e), 0);
    const oppScore = state[oppPartyKey].reduce((sum, e) => sum + getEntityScore(e), 0);

    // Kill bonus: strongly incentivize finishing off enemies
    // Ticket 44: the TERMINAL case, which ticket 38's flat -50 only approximated. Losing your
    // last unit is not "a unit worth 50 points died", it is the game. Scoring it as a constant
    // meant a board with enough upside could still outrank being alive.
    //
    // The symmetry falls out for free and is the point: a win is +TERMINAL, a loss -TERMINAL,
    // and a MUTUAL kill lands at exactly 0 - between the two, which is what a draw is worth.
    // The per-unit +-50 below still governs multi-unit parties where some but not all are down.
    const myAlive = state[myPartyKey].some(e => e.currentHp > 0);
    const oppAlive = state[oppPartyKey].some(e => e.currentHp > 0);
    if (!myAlive || !oppAlive) {
        return (oppAlive ? 0 : TERMINAL_SCORE) - (myAlive ? 0 : TERMINAL_SCORE);
    }

    const oppDead = state[oppPartyKey].filter(e => e.currentHp <= 0).length;
    // Ticket 38: the kill bonus used to have no counterpart, so A MUTUAL KILL EVALUATED AS A
    // WIN. A dead unit scores 0 (getEntityScore's early return) and the concave HP curve makes
    // a nearly-dead one worth very little on top of that, so trading your own last ~60 points
    // for `oppScore + 50` was always correct arithmetic - even though the result is a DRAW.
    // It went unnoticed until hel_v2, who pays HP for her cards: 61% of her games ended as
    // mutual kills. Symmetric and same magnitude, deliberately: the conservative fix. (A truer
    // one would make losing your LAST unit near-terminal rather than -50, but that is a bigger
    // change to every matchup's instincts than this evidence supports.)
    const myDead = state[myPartyKey].filter(e => e.currentHp <= 0).length;

    return myScore - oppScore + handValue(state, side)
        - handValue(state, side === 'PLAYER' ? 'ENEMY' : 'PLAYER') + (oppDead * 50) - (myDead * 50);
}

/** A depth-0 first action with the best same-turn continuation found behind it. */
interface Candidate {
    action: BattleAction;
    score: number;
    leafState: IBattleState;
}

/**
 * Recursive search to find the best sequence of actions for the current turn.
 * Simulates permutations of playable cards.
 */
interface SequenceResult {
    score: number;
    firstAction: BattleAction | null;
    leafState: IBattleState;
}

function findBestSequence(
    state: IBattleState,
    side: 'PLAYER' | 'ENEMY',
    depth: number,
    maxDepth: number,
    candidates?: Candidate[]
): SequenceResult {
    // 1. Evaluate current state
    const currentScore = evaluateState(state, side);

    // 2. Base Cases
    if (depth >= maxDepth) {
        return { score: currentScore, firstAction: null, leafState: state };
    }

    // 3. Generate Valid Actions
    const activeDeckKey = side === 'PLAYER' ? 'playerDeck' : 'enemyDeck';
    const activePartyKey = side === 'PLAYER' ? 'playerParty' : 'enemyParty';
    const oppPartyKey = side === 'PLAYER' ? 'enemyParty' : 'playerParty';

    const hand = state[activeDeckKey].hand;
    const myParty = state[activePartyKey].filter(e => e.currentHp > 0);
    const oppParty = state[oppPartyKey].filter(e => e.currentHp > 0);

    if (myParty.length === 0 || oppParty.length === 0) {
        return { score: currentScore, firstAction: null, leafState: state };
    }

    let bestScore = currentScore;
    let bestAction: BattleAction | null = null;
    let bestLeaf: IBattleState = state;
    const siblings = CENSUS ? new Set<string>() : null;
    const deferred: Array<{
        action: BattleAction; nextState: IBattleState; immediate: number; order: number;
    }> | null = BEAM > 0 && depth > 0 ? [] : null;

    for (const card of hand) {
        const programData = GetProgramData(card.dataId);

        // Determine valid targets based on card target type
        let potentialTargets: IBattleEntity[] = [];

        if (programData.target === 'Self') {
            potentialTargets = [...myParty]; // Self cards target own units
            // A lifesteal card (ATTACK on TARGET plus HEAL on SELF) is an attack, not a
            // heal: its payload target is consumed by the ATTACK, and the HEAL resolves
            // against the source regardless. Bucketing it with heals aimed the attack at
            // the caster, so crimson_draw/blood_rite/leech_strike/drain_life hit their own
            // Mingming and dealt zero to the opponent. Only cards with no TARGET-scoped
            // ATTACK are ally-targeting.
        } else if (
            programData.actions.some(a => a.type === 'HEAL') &&
            !programData.actions.some(a => a.type === 'ATTACK' && a.target === 'TARGET') &&
            programData.target !== 'Side'
        ) {
            potentialTargets = [...myParty]; // Heal cards target allies
        } else if (programData.target === 'Side' || programData.target === 'All') {
            // Side/All can target either side; try both
            potentialTargets = [...oppParty, ...myParty];
        } else {
            potentialTargets = [...oppParty]; // Single attacks target enemies
        }

        for (const source of myParty) {
            // Per-source, per-candidate: an X-cost card prices itself at this source's
            // current Energy, so the search sees its real cost without special-casing.
            const printedCost = getEffectiveCardCost(source, programData, card.currentCost);
            // Ticket 36: onCostCalculated can zero a card's cost (hel_v2 UNDERWORLD_GATEWAY).
            // getEffectiveCardCost does NOT run that hook - the reducer applies it separately
            // in handlePlayProgram - so the AI must price the card the same way or it will skip
            // cards it can actually afford. Without this, Hel never considers soul_tithe (3e on
            // a 2-Energy frame) and it measures as a 100% dead card for a reason that looks
            // nothing like balance.
            //
            // The returned state is DISCARDED on purpose: the search must not leak state, and
            // cost hooks are modifiers, not mutators. Target is `undefined` here because the
            // candidate target is not chosen until the loop below - the signature allows it,
            // and inventing one would silently mis-price target-conditional cost hooks.
            const effectiveCost = executeCostCalculated(state, source, undefined, programData, printedCost).cost;
            if (source.currentEnergy < effectiveCost) continue;

            // A Self card ignores the loop variable - `effectiveTargetId` below is the CASTER - so
            // iterating every potential target emits the IDENTICAL action once per target and
            // simulates it from scratch each time, then recurses into an identical subtree. In 1v1
            // there is one target and it costs nothing; in 3v3 `AI_CENSUS=1` measured it at 18.1%
            // of all simulations. Collapsing it is exact: the removed actions are byte-identical to
            // the one kept.
            //
            // It is exact per candidate but NOT a no-op on the decision, and that is a fix rather
            // than a regression: `getBestAction` takes the top `LOOKAHEAD_TOP_N` candidates, and
            // those slots were being filled with three copies of one action, so the lookahead was
            // examining one distinct line where it believed it was examining three.
            const targetsForSource = programData.target === 'Self' ? [source] : potentialTargets;

            for (const target of targetsForSource) {
                // Validate constraints BEFORE simulating
                if (!validateProgramConstraints(state, source, target, programData, effectiveCost)) {
                    continue; // Skip this card/target combo — constraints not met
                }

                // For Self cards, the effective target is always the source
                const effectiveTargetId = programData.target === 'Self' ? source.id : target.id;

                const action: BattleAction = {
                    type: 'PLAY_PROGRAM',
                    payload: {
                        sourceId: source.id,
                        targetId: effectiveTargetId,
                        programId: card.id
                    }
                };

                if (siblings) {
                    census.enumerated++;
                    const k = `${source.id}|${effectiveTargetId}|${card.id}`;
                    if (siblings.has(k)) census.duplicate++; else siblings.add(k);
                }

                // Simulate
                const nextState = battleReducer(state, action);
                if (CENSUS) census.simulated++;

                // Skip if state didn't change (reducer rejected it)
                if (nextState === state) continue;

                if (deferred !== null) {
                    // Beam: hold the candidate with its IMMEDIATE score and recurse later, into
                    // only the best `BEAM` of them.
                    deferred.push({
                        action, nextState, order: deferred.length,
                        immediate: evaluateState(nextState, side),
                    });
                    continue;
                }

                // Recursive Call
                const result = findBestSequence(nextState, side, depth + 1, maxDepth);

                if (depth === 0 && candidates) {
                    candidates.push({ action, score: result.score, leafState: result.leafState });
                }

                if (result.score > bestScore) {
                    bestScore = result.score;
                    bestLeaf = result.leafState;
                    if (depth === 0) {
                        bestAction = action;
                    }
                }
            }
        }
    }

    if (deferred !== null && deferred.length > 0) {
        let explore = deferred;
        if (deferred.length > BEAM) {
            // Select the best BEAM by immediate score, then RESTORE ENUMERATION ORDER before
            // recursing. Both halves matter. Selecting is the optimisation; restoring the order is
            // what stops the beam changing anything it did not prune - `bestScore` improves on a
            // strict `>`, so among equal-scoring lines the first one VISITED wins, and recursing in
            // score order silently re-picks ties. That bug cost a measurement: at AI_BEAM=16, well
            // above 1v1's branching and pruning nothing there, 23 of 90 grid cells still moved.
            explore = [...deferred].sort((a, b) => b.immediate - a.immediate).slice(0, BEAM);
            explore.sort((a, b) => a.order - b.order);
            if (CENSUS) census.pruned += deferred.length - explore.length;
        }
        for (const d of explore) {
            const result = findBestSequence(d.nextState, side, depth + 1, maxDepth);
            if (result.score > bestScore) {
                bestScore = result.score;
                bestLeaf = result.leafState;
            }
        }
    }

    return { score: bestScore, firstAction: bestAction, leafState: bestLeaf };
}

// --- 1-turn lookahead (ticket 19) ---
//
// The same-turn search cannot value setup cards: capacitor's Energized pays out at the
// next energy refill, which used to be past the horizon. The lookahead re-ranks the
// top same-turn candidates by what the board looks like after playing out the turn,
// letting both sides' end-of-turn statuses tick, and taking the best reply next turn.
//
// - The OPPONENT IS MODELED AS PASSING (their DoTs/decays still tick): modeling their
//   real turn needs their hidden hand - perfect-info cheating or determinization at
//   x2+ cost (rejected in ticket 19). This undervalues defense uniformly; documented.
// - The next-turn hand is a CHANCE NODE: own drawpile CONTENTS are known, only order
//   is hidden. Valued as the mean over LOOKAHEAD_DETERMINIZATIONS seed-derived
//   reshuffles of the drawpile (deterministic per battle seed). A reshuffle of the
//   discard pile (drawpile exhausted) falls back to the engine's own seeded shuffle.

const MAX_DEPTH = 3; // Same-turn sequence depth (unchanged)

/**
 * TICKET 108 - THE SCREENING TIER. `AI_LITE=1` narrows the lookahead instead of removing it.
 *
 * Henry's objection to a greedy screening tier was the right one: greedy is BIASED AGAINST
 * DECISION-HEAVY CARDS, which is exactly what the fun program keeps adding. A screen that
 * systematically under-rates hold-or-cash cards would rank arms wrongly in the one direction the
 * project cares about - `drink_deep`, `momentum_crash` and `bracing_cold` are all cards whose whole
 * point is that the greedy line is wrong.
 *
 * So the cheap tier keeps the lookahead and shrinks it: TWO candidates instead of three, ONE
 * determinization instead of two. That is 2 lookahead evaluations per contested decision where full
 * does 6 - the same KIND of judgement, a third of the work. The reply depth is deliberately NOT
 * reduced: it is what makes a lookahead a lookahead.
 *
 * Full lookahead remains the default and the only thing a ship gate may use.
 *
 * ------------------------------------------------------------------------------------------------
 * CALIBRATED, AND THE RULES THAT CAME OUT OF IT (ticket 108 - research/three-tier-ai.md)
 * ------------------------------------------------------------------------------------------------
 * Measured, not assumed. Three findings decide how these tiers may be used:
 *
 * 1. LITE RANKS LIKE FULL. Across a six-arm knob sweep (`rimebreaker` power 0/10/15/20/25/30 on
 *    `draugr_v2`) lite reproduced full's ordering exactly, and its per-cell disagreement with full
 *    (MAD 5.7-6.7) is SMALLER than full's disagreement with ITSELF across seed bases (MAD 6.0-13.2).
 *    At arm-ranking grade the tier is not the dominant error term; the seed base is.
 *
 * 2. LITE COMPRESSES THE SPREAD AND BIASES WEAK ARMS UP. Over that sweep full spanned 41.7 -> 76.0
 *    and lite 49.8 -> 76.3: lite reads ~77% of the slope, and the gap is largest where the arm is
 *    weakest (+8.2 points at power 0, +0.3 at power 30). It is reading the deck's FLOOR - a shallower
 *    search finds fewer of the losing lines. So:
 *
 *      **SCREEN WITH LITE, CONFIRM THE WINNER WITH FULL. Never read a band verdict off lite.**
 *
 *    An in-band/out-of-band call near 35 or 80 is exactly where an 8-point upward bias flips a
 *    verdict, and a deck-health number is not a ranking.
 *
 * 3. GREEDY IS NOT SAFE FOR NUMERIC KNOBS - THE OPPOSITE OF WHAT WAS EXPECTED. Marginal card value
 *    (deck field with the card printed, minus with its power zeroed):
 *
 *      | card                        | full  | lite  | greedy |
 *      | momentum_crash (consume)    | +5.25 | +4.67 | +0.75  |
 *      | zephyr_strike (flat 15)     | +3.67 | +3.00 | +0.67  |
 *      | stampede (her biggest card) | +26.7 |   -   | +28.6  |
 *      | rimebreaker (ANY_STATUS)    | +19.8 | +15.3 | +15.2  |
 *
 *    Greedy priced two of those four correctly and compressed the other two by 5-7x, and nothing in
 *    the card's text predicts which. It reads a change the deck can SUBSTITUTE AROUND as nearly
 *    free, because without lookahead it simply plays something else. A power knob is usually
 *    exactly that kind of change. **Greedy is a decision-density probe (ticket 99), not a screen.**
 */
const env = typeof process !== 'undefined' ? process.env : ({} as Record<string, string | undefined>);
const LITE = env.AI_LITE === '1';
const LOOKAHEAD_TOP_N = LITE ? 2 : 3;
const LOOKAHEAD_DETERMINIZATIONS = LITE ? 1 : 2;
const LOOKAHEAD_REPLY_DEPTH = 2;

/**
 * `AI_CENSUS=1`: count what the same-turn enumeration actually walks. Off by default and behind a
 * constant, so the shipped search is untouched. It exists because the 3v3 cost turned out to be
 * enumeration rather than search depth, and "how many candidates" had been an estimate: it measured
 * 83 reducer simulations per decision at 1v1 against 16,677 at 3v3, and 18.1% of the 3v3 ones
 * byte-identical repeats (research/3v3-optimisation.md).
 */
const CENSUS = env.AI_CENSUS === '1';
export const census = { enumerated: 0, duplicate: 0, simulated: 0, pruned: 0, decisions: 0 };
export function censusReset(): void {
    census.enumerated = 0; census.duplicate = 0; census.simulated = 0;
    census.pruned = 0; census.decisions = 0;
}
export function censusNewDecision(): void { census.decisions++; }

/**
 * SAME-TURN BEAM (`AI_BEAM=<n>`, 0 = off, and off IS the default).
 *
 * `findBestSequence` recurses over every ordering of every play available this turn, so its cost is
 * roughly `branching ^ MAX_DEPTH`. Branching is `casters x hand x targets` - about 6 in 1v1 and about
 * 20 in 3v3 - which is why a 3v3 decision costs ~95x a 1v1 one rather than 3x.
 *
 * The beam still enumerates every candidate at a node (the simulation IS the score, so that part
 * cannot be skipped) but RECURSES into only the best `BEAM` of them, cutting the exponent rather
 * than the base.
 *
 * SIZING IT AGAINST 1v1. Measured on 90 grid cells (`draugr_v2`, `hel_v2`, `huldra_v1` field rows):
 * `AI_BEAM` of 6, 8, 12 and 16 are all BIT-IDENTICAL to no beam at all; 4 moves 7 of the 90. So 6 is
 * the boundary and **8 is the recommended setting**, keeping headroom while still running 3v3 ~2x
 * faster than the beamless search.
 *
 * That identity is EMPIRICAL, not structural, and the difference matters. `AI_CENSUS=1` shows
 * `AI_BEAM=8` pruning 3 candidates even at 1v1 - so 1v1 branching does exceed 8 occasionally, and
 * the beam is not a no-op there; those 3 lines simply were not going to win. A wider roster, a
 * bigger hand or a new card could change that. **Re-run the grid gate before trusting a beam width
 * after any change to the card pool** - do not read "bit-identical on 90 cells" as "cannot move".
 *
 * It is an APPROXIMATION in 3v3, ranked on the immediate score, so it inherits the bias ticket 108
 * measured in the cheap AI tier: it under-reads lines whose payoff is one play further on. Depth 0
 * is never beamed - that is the layer producing the candidate list `getBestAction` ranks, and
 * truncating it would hide legal plays from the decision entirely.
 */
const BEAM = Number(env.AI_BEAM ?? 0);

/** What tier is live, for a harness that wants to record it beside its numbers. */
export const AI_TIER: 'greedy' | 'lite' | 'full' =
    env.AI_GREEDY === '1' ? 'greedy' : LITE ? 'lite' : 'full';
/**
 * Dominance pruning: when the best same-turn candidate leads the runner-up by more
 * than this many eval points (12 = 6 HP), the decision is not close and the
 * lookahead is skipped. Most moves are clear-cut; this keeps the lookahead's cost
 * concentrated on the genuinely contested choices (setup-vs-tempo calls).
 */
const LOOKAHEAD_DOMINANCE_MARGIN = 12;

/**
 * DECISION TAP - ticket 99's instrument seam, and the same shape as the store's `setActionTap`:
 * production ships it inert, and only debug code ever fills it.
 *
 * Henry's playtest finding was that most decks play themselves - one line is obviously best, every
 * hand, so there is no game to play. That is measurable from inside this function and nowhere else:
 * the AI already computes what every candidate line is worth, and the shape of that distribution IS
 * the answer. A turn where the best play leads by 40 eval points is a deck playing itself; a turn
 * where the top two sit within a couple of points, and where LOOKING A TURN AHEAD changes the pick,
 * is a decision.
 *
 * Zero cost when unset: one null check per decision.
 */
export interface DecisionRecord {
    side: 'PLAYER' | 'ENEMY';
    turn: number;
    /** Lines that beat standing pat. 0 = no play was worth making; 1 = no choice existed. */
    candidates: number;
    /** Eval points between the best and second-best line. Undefined when there was no second. */
    gap?: number;
    /** True when the gap was inside the dominance margin - the decision was contested. */
    close: boolean;
    /** True when the 1-turn lookahead ran (close, not lethal, not a stalled battle). */
    lookaheadRan: boolean;
    /** True when the lookahead picked a DIFFERENT line than the greedy ranking would have. */
    flipped: boolean;
}

let decisionTap: ((record: DecisionRecord) => void) | null = null;

/** Install (or clear, with `null`) the decision tap. Debug-only. */
export function setDecisionTap(tap: ((record: DecisionRecord) => void) | null): void {
    decisionTap = tap;
}

/**
 * `AI_GREEDY=1` disables the 1-turn lookahead, leaving the same-turn greedy ranking.
 *
 * This is ticket 99's first proxy: the win-rate difference between the two modes is what thinking
 * one turn ahead is WORTH on a given deck. A deck that scores the same either way is a deck whose
 * decisions do not matter - which is exactly the complaint the ticket exists to quantify.
 */
const GREEDY_ONLY = env.AI_GREEDY === '1';

function allDead(party: ReadonlyArray<IBattleEntity>): boolean {
    return party.every(e => e.currentHp <= 0);
}

/**
 * Value of a candidate's leaf state one turn later: END_TURN (our ticks), opponent
 * passes (their ticks), our energy refills (Energized cashes) and we draw a
 * determinized hand, then the best depth-limited reply is scored.
 */
function lookaheadValue(
    leaf: IBattleState,
    side: 'PLAYER' | 'ENEMY',
    candidateIndex: number
): number {
    const deckKey = side === 'PLAYER' ? 'playerDeck' : 'enemyDeck';
    let total = 0;

    for (let d = 0; d < LOOKAHEAD_DETERMINIZATIONS; d++) {
        // Determinize the unknown draw order: reshuffle our own drawpile copy.
        const rng = new PRNG(`lookahead|${leaf.seed}|${leaf.turn}|${candidateIndex}|${d}`);
        const { shuffled } = rng.shuffle([...leaf[deckKey].drawpile]);
        const determinized: IBattleState = {
            ...leaf,
            [deckKey]: { ...leaf[deckKey], drawpile: shuffled }
        };

        // Our turn ends: our statuses tick, side flips (opponent refills/draws).
        const afterOurEnd = battleReducer(determinized, { type: 'END_TURN' });

        // Opponent passes: their statuses tick, side flips back, we refill + draw.
        const afterTheirPass = battleReducer(afterOurEnd, { type: 'END_TURN' });

        const oppKey = side === 'PLAYER' ? 'enemyParty' : 'playerParty';
        const myKey = side === 'PLAYER' ? 'playerParty' : 'enemyParty';
        if (allDead(afterTheirPass[oppKey]) || allDead(afterTheirPass[myKey])) {
            // Battle decided by ticks alone - score the terminal board.
            total += evaluateState(afterTheirPass, side);
            continue;
        }

        // Best reply next turn, depth-limited.
        total += findBestSequence(afterTheirPass, side, 0, LOOKAHEAD_REPLY_DEPTH).score;
    }

    return total / LOOKAHEAD_DETERMINIZATIONS;
}

export function getBestAction(state: IBattleState): BattleAction {
    // 1. First check if any entity on the active side has an intent to execute
    // (Intents are generated in PRE_TURN for enemies)
    const activePartyKey = state.activeSide === 'PLAYER' ? 'playerParty' : 'enemyParty';
    const activeParty = state[activePartyKey];

    // Find first alive unit with an intent that hasn't executed yet
    for (const entity of activeParty) {
        if (entity.currentHp > 0 && entity.currentIntent) {
            return {
                type: 'EXECUTE_INTENT',
                payload: { sourceId: entity.id }
            };
        }
    }

    // 2. Enemy behavior is locked in at battle creation via enemyMode:
    // 'MOVES' (default) — Slay-the-Spire style: ONLY telegraphed intents, never
    // cards. Once every intent has executed, the enemy turn is over.
    // 'CARDS' — explicit opt-in (BattleOptions.enemyMode at createBattleState):
    // the enemy has no intents and instead falls through to the card-play
    // simulation below.
    if (state.activeSide === 'ENEMY' && (state.enemyMode ?? 'MOVES') === 'MOVES') {
        return { type: 'END_TURN' };
    }

    // 3. Card-play tactical simulation: the player side (Balance Tester /
    // the headless batch sims), or card-user enemies (enemyMode === 'CARDS').
    const side = state.activeSide;

    // Silence events during AI simulation to prevent log spam and side effects
    globalBattleEventBus.mute();
    try {
        const candidates: Candidate[] = [];
        findBestSequence(state, side, 0, MAX_DEPTH, candidates);

        // Only strictly-improving first actions qualify (same bar as the original
        // greedy: it never acted unless some sequence beat standing pat).
        const baseline = evaluateState(state, side);
        const improving = candidates.filter(c => c.score > baseline);
        if (improving.length === 0) {
            decisionTap?.({
                side, turn: state.turn, candidates: 0,
                close: false, lookaheadRan: false, flipped: false,
            });
            return { type: 'END_TURN' };
        }

        // Sort by same-turn score (Array.prototype.sort is stable: ties keep
        // hand/target enumeration order - deterministic).
        improving.sort((a, b) => b.score - a.score);

        // Lethal short-circuit: if the best same-turn line already ends the battle,
        // take it - no future to weigh.
        const oppPartyKey = side === 'PLAYER' ? 'enemyParty' : 'playerParty';
        if (allDead(improving[0].leafState[oppPartyKey])) {
            return improving[0].action;
        }

        const topN = improving.slice(0, LOOKAHEAD_TOP_N);
        if (topN.length === 1) {
            decisionTap?.({
                side, turn: state.turn, candidates: improving.length,
                close: false, lookaheadRan: false, flipped: false,
            });
            return topN[0].action;
        }
        const gap = topN[0].score - topN[1].score;
        if (gap > LOOKAHEAD_DOMINANCE_MARGIN) {
            decisionTap?.({
                side, turn: state.turn, candidates: improving.length,
                gap, close: false, lookaheadRan: false, flipped: false,
            });
            return topN[0].action;
        }
        if (GREEDY_ONLY) {
            decisionTap?.({
                side, turn: state.turn, candidates: improving.length,
                gap, close: true, lookaheadRan: false, flipped: false,
            });
            return topN[0].action;
        }
        // Stalled battles (docs/balance_testing.md 2.2 calls >30 turns a stall) get
        // greedy play only: the lookahead cannot un-stall a matchup whose decks
        // cannot close, and 400-game 60-turn mirror stalls dominate suite wall-clock.
        if (state.turn > 30) {
            decisionTap?.({
                side, turn: state.turn, candidates: improving.length,
                gap, close: true, lookaheadRan: false, flipped: false,
            });
            return topN[0].action;
        }

        // Re-rank the top candidates by their 1-turn lookahead value; ties resolve
        // to the better same-turn score (earlier index), keeping determinism.
        let best = topN[0];
        let bestValue = -Infinity;
        for (let i = 0; i < topN.length; i++) {
            const value = lookaheadValue(topN[i].leafState, side, i);
            if (value > bestValue) {
                bestValue = value;
                best = topN[i];
            }
        }
        // FLIPPED is the signal ticket 99 is really after: the greedy ranking and the one-turn
        // lookahead disagreed, so the turn contained a decision that a shallower player gets wrong.
        decisionTap?.({
            side, turn: state.turn, candidates: improving.length,
            gap, close: true, lookaheadRan: true, flipped: best !== topN[0],
        });
        return best.action;
    } finally {
        globalBattleEventBus.unmute();
    }
}
