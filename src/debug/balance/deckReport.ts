/**
 * The Deck Report (v2) - `docs/wayfinder/debug-toolkit/tickets/26-deck-balance-report-v2-build.md`,
 * designed by ticket 25 (`research/25-deck-balance-report-v2-design.md`).
 *
 * WHAT THIS IS, AND WHAT IT IS NOT
 * --------------------------------
 * `balance_report.json` (v1) answers "what breached". It is the commit gate: no timestamp,
 * fixed path, diffable, and every ticket since 42 has hand-assembled its own view on top of
 * it because it cannot answer "how is this DECK doing".
 *
 * This is that second artifact, and it is deliberately a different file. It is generated on
 * demand (`npm run balance:deck`), it is NOT part of the commit gate, and it carries a
 * timestamp because nothing diffs it. v1 is untouched by this module.
 *
 * THE ONE IDEA WORTH UNDERSTANDING
 * --------------------------------
 * `powerscale` prices a card once, from its text, against fixed averages. `measuredScore`
 * replaces ONLY the two terms that vary at runtime - damage and status stacks - with what
 * the card actually did across N real games, and leaves every deterministic term alone. A
 * card that draws 2 always draws 2; re-measuring it just re-derives the constant.
 *
 *     measuredScore = staticScore - damagePortion - statusPortion
 *                                 + measuredDamage + measuredStatus
 *
 * So a large `scoreDelta` means "this card performs differently than its text implies", not
 * "the two formulas disagree".
 *
 * THE DoT ATTRIBUTION TRAP - read this before trusting a damage number
 * -------------------------------------------------------------------
 * Per-play damage is the HP delta across a single `PLAY_PROGRAM` dispatch. Burn and Poison
 * ticks resolve at END of turn and therefore attribute to NOTHING. A Burn card reads
 * `0.0 dmg/play` and looks dead while it is carrying the deck - this project has been bitten
 * by it once already (deck-archetypes HANDOFF, "Measurement facts").
 *
 * The residual (`totalDamage - sum(directDamage)`) is apportioned across DoT-applying cards
 * pro-rata to the stacks they applied. **That is an approximation and the field is nullable
 * precisely so it cannot be misread as measured-exact.** A card that applied no DoT status
 * gets `null`, not 0.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getInflatedProgramRegistry, GetProgramData } from '../../engine/data/programRegistry';
import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { numericBaseCost, type ProgramData } from '../../engine/types';
import { computeRegistryHash } from '../scenarios/registryHash';
import { budgetBandFor, calculatePowerscale } from './powerscale';
import type { BatchResult, PairedBatchResult, RunResult, SideTelemetry, Side } from './runBatch';

/** Bump when the JSON shape changes. v1 lives in `balanceReport.ts` and is a different file. */
export const DECK_REPORT_SCHEMA_VERSION = 2;

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const DECK_REPORT_DIR = resolve(REPO_ROOT, 'docs', 'balance');
export const DECK_REPORT_JSON_PATH = join(DECK_REPORT_DIR, 'deck_report.json');
export const DECK_REPORT_HTML_PATH = join(DECK_REPORT_DIR, 'deck_report.html');
/** The viewer, with a `__DECK_REPORT_JSON__` placeholder where the run's data goes. */
const VIEWER_TEMPLATE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'deckReportViewer.html');

/**
 * Statuses whose damage lands at end of turn, so it never attributes to the play that
 * applied them. The residual-apportioning in `buildCards` keys off exactly this list.
 */
const DOT_STATUSES = ['Burn', 'Poison'] as const;

/**
 * Confidence floors, calibrated against a real run rather than shipped as the design doc's
 * placeholders (ticket 26's checklist item). See `docs/balance/deck_report.json`'s
 * `config.thresholds` for what a given report used.
 *
 * - `matchupIterations` 150: the deck-archetypes HANDOFF measures §2.3 noise at +-4 points
 *   at 150 seeds and +-2.8 at 300, so 150 is where a matchup stops being a coin flip.
 * - `cardPlays` 20: below ~20 plays a per-card damage mean is dominated by which target it
 *   happened to hit.
 * - `deadRate` 0.50: CALIBRATED, not guessed. Across 79 real card rows (12 subjects, 160
 *   games each) the distribution is median 0.09, p75 0.23, p90 0.39, **p95 0.52**, max 0.87 -
 *   so 0.50 lands almost exactly on the 95th percentile and fires on 4 rows. The design doc
 *   proposed the same number; the run confirms it rather than inheriting it.
 * - `powerDivergence` 1.00: the design doc proposed 0.50, and the real distribution says that
 *   is too tight - median 0.20 and **p75 0.50**, so half of what it flagged was ordinary. At
 *   1.00 it fires on 10 of 76 rows (13%), and what it names are the per-stack scalers whose
 *   static score is a documented FLOOR rather than a price (`wither_feast` 8.0, `slander` 1.9,
 *   `avalanche` 1.6). Those SHOULD appear - the redline's job is to surface them, not to
 *   pretend they are defects.
 */
export const DECK_REPORT_THRESHOLDS = {
    matchupIterations: 150,
    cardPlays: 20,
    deadRate: 0.5,
    powerDivergence: 1.0,
} as const;

export type SuiteKind = 'mirror' | 'vs-control' | 'gauntlet' | 'os-variance' | 'custom';
export type Confidence = 'ok' | 'low-sample';

export interface DeckReportConfig {
    suites: SuiteKind[];
    iterations: number;
    maxTurns: number;
    seedBase: string;
    thresholds: typeof DECK_REPORT_THRESHOLDS;
}

export interface SubjectSummary {
    decisiveWinRate: number;
    winRate: number;
    averageTurns: number;
    avgDamagePerTurnDealt: number;
    avgDamagePerTurnTaken: number;
    avgStatusApplicationsPerGame: number;
    avgStatusStacksPerGame: number;
    mostUsedCard: string | null;
    leastUsedCard: string | null;
    highestDamageCard: string | null;
    deadCardIds: string[];
    deadCardRatio: number;
    mostUsedStatus: string | null;
    ftkCount: number;
    ftkRate: number;
    truncatedCount: number;
    firstMoverEdge: number | null;
    sideBias: number | null;
    sampleSize: number;
    confidence: Confidence;
}

export interface SubjectDeck {
    id: string;
    species: string;
    os: string;
    osFirmwareDescription: string;
    archetypeSummary: string;
    cardList: Array<{ id: string; count: number }>;
    summary: SubjectSummary;
}

export interface CardTelemetry {
    cardId: string;
    name: string;
    cost: number;
    element: string;
    description: string;
    subjectId: string;
    timesSeen: number;
    timesPlayed: number;
    handEntries: number;
    playRate: number;
    timesDeadInHand: number;
    deadRate: number;
    directDamageDealt: number;
    avgDirectDamagePerPlay: number;
    residualDamageShare: number | null;
    damageShareOfSubject: number;
    statusesApplied: Record<string, number>;
    staticScore: number;
    measuredScore: number;
    scoreDelta: number;
    sampleSize: number;
    confidence: Confidence;
    isMocked: false;
}

export interface StatusTelemetry {
    statusId: string;
    name: string;
    subjectId: string;
    totalStacksApplied: number;
    totalApplicationEvents: number;
    avgStacksPerGame: number;
    avgApplicationsPerGame: number;
    topSourceCards: string[];
    isMocked: false;
}

export interface DeckMatchupRecord {
    id: string;
    suite: string;
    role: string;
    label: string;
    subject: string;
    subjectOS: string;
    opponent: string;
    opponentOS: string;
    iterations: number;
    playerWins: number;
    enemyWins: number;
    draws: number;
    decisive: number;
    decisiveWinRate: number;
    winRate: number;
    averageTurns: number;
    deadCardRatio: number;
    enemyDeadCardRatio: number;
    ftkCount: number;
    truncatedCount: number;
    firstMoverEdge: number | null;
    sideBias: number | null;
    avgDamagePerTurnDealt: number | null;
    avgDamagePerTurnTaken: number | null;
    topCardsThisMatchup: string[] | null;
    topStatusesThisMatchup: string[] | null;
    redlineFlags: string[];
    confidence: Confidence;
    inconclusive: boolean;
}

export interface DeckRedlineRecord {
    section: string;
    kind: 'CARD_OVER_BUDGET' | 'TURN_COUNT' | 'OS_GAP' | 'FTK'
        | 'DEAD_CARD_HIGH' | 'POWER_DIVERGENCE' | 'LOW_SAMPLE';
    subject: string;
    metric: string;
    value: number;
    threshold: number;
    comparison: 'above' | 'below';
    detail: string;
}

export interface DeckReport {
    schemaVersion: typeof DECK_REPORT_SCHEMA_VERSION;
    generatedAt: string;
    command: string;
    registryHash: string;
    config: DeckReportConfig;
    control: { species: string; os: string } | null;
    subjects: SubjectDeck[];
    cards: CardTelemetry[];
    statuses: StatusTelemetry[];
    matchups: DeckMatchupRecord[];
    redlines: DeckRedlineRecord[];
    notes: { instrumentationPending: string[] };
}

/** One measured matchup, as handed to the builder. */
export interface MeasuredMatchup {
    id: string;
    suite: SuiteKind;
    role: string;
    label: string;
    subjectId: string;
    subjectSpecies: string;
    subjectOS: string;
    opponent: string;
    opponentOS: string;
    /** Which side of the batch the SUBJECT played. */
    subjectSide: Side;
    paired: PairedBatchResult;
}

const round = (n: number, dp = 2) => {
    const f = 10 ** dp;
    return Math.round(n * f) / f;
};

/** Merge every per-run `SideTelemetry` for one side of one batch. */
function mergeTelemetry(runs: ReadonlyArray<RunResult>, side: Side): SideTelemetry {
    const out: SideTelemetry = { seen: {}, instancesPlayed: {}, handEntries: {}, played: {}, directDamage: {}, statuses: {}, totalDamage: 0 };
    for (const run of runs) {
        const t = run.telemetry?.[side];
        if (!t) continue;
        out.totalDamage += t.totalDamage;
        for (const [k, v] of Object.entries(t.seen)) out.seen[k] = (out.seen[k] ?? 0) + v;
        for (const [k, v] of Object.entries(t.instancesPlayed)) out.instancesPlayed[k] = (out.instancesPlayed[k] ?? 0) + v;
        for (const [k, v] of Object.entries(t.handEntries)) out.handEntries[k] = (out.handEntries[k] ?? 0) + v;
        for (const [k, v] of Object.entries(t.played)) out.played[k] = (out.played[k] ?? 0) + v;
        for (const [k, v] of Object.entries(t.directDamage)) out.directDamage[k] = (out.directDamage[k] ?? 0) + v;
        for (const [k, byStatus] of Object.entries(t.statuses)) {
            const bucket = out.statuses[k] ?? (out.statuses[k] = {});
            for (const [s, v] of Object.entries(byStatus)) bucket[s] = (bucket[s] ?? 0) + v;
        }
    }
    return out;
}

/**
 * Damage per point of measured HP, expressed in powerscale's score units.
 *
 * `docs/power_curve_spec.md` rev 3: damage costs 3 power per 1% of a health pool, and a
 * pool is ~79 HP, so 1 HP of damage is `300/79` power and a score unit is 10 power.
 */
const POOL_HP = 79;
const SCORE_UNITS_PER_HP = (300 / POOL_HP) / 10;
/** Status stacks are priced the same way powerscale prices them; see `statusScoreOf`. */
function statusScoreOf(card: ProgramData, stacks: Record<string, number>): number {
    // Price a synthetic single-action card per status so the SAME tables are used rather
    // than a second, drifting copy of the rev 3 status prices.
    let total = 0;
    for (const [status, count] of Object.entries(stacks)) {
        if (count <= 0) continue;
        const probe: ProgramData = {
            ...card,
            actions: [{ type: 'STATUS', status, stacks: Math.round(count), target: 'TARGET' } as never],
        };
        total += calculatePowerscale(probe).statusPortion;
    }
    return total;
}

function buildCards(
    subjectId: string,
    telemetry: SideTelemetry,
    games: number,
    cardIds: ReadonlyArray<string>,
): CardTelemetry[] {
    const totalDirect = Object.values(telemetry.directDamage).reduce((a, b) => a + b, 0);
    const residual = Math.max(0, telemetry.totalDamage - totalDirect);

    // Residual is apportioned pro-rata to DoT stacks applied - see the module header. Cards
    // that applied no DoT get `null`, not a zero, so "not applicable" and "measured zero"
    // stay distinguishable in the viewer.
    const dotStacks: Record<string, number> = {};
    let dotTotal = 0;
    for (const [id, byStatus] of Object.entries(telemetry.statuses)) {
        const n = DOT_STATUSES.reduce((a, s) => a + (byStatus[s] ?? 0), 0);
        if (n > 0) { dotStacks[id] = n; dotTotal += n; }
    }

    const rows: CardTelemetry[] = [];
    for (const cardId of [...new Set(cardIds)]) {
        const data = GetProgramData(cardId);
        const stat = calculatePowerscale(data);
        const timesSeen = telemetry.seen[cardId] ?? 0;
        const instancesPlayed = telemetry.instancesPlayed[cardId] ?? 0;
        const handEntries = telemetry.handEntries[cardId] ?? 0;
        const timesPlayed = telemetry.played[cardId] ?? 0;
        const direct = telemetry.directDamage[cardId] ?? 0;
        const statuses = telemetry.statuses[cardId] ?? {};
        const share = dotTotal > 0 && dotStacks[cardId] ? residual * (dotStacks[cardId] / dotTotal) : null;

        // measuredScore: swap ONLY the damage and status terms (module header).
        const measuredDamage = timesPlayed > 0
            ? ((direct + (share ?? 0)) / timesPlayed) * SCORE_UNITS_PER_HP
            : 0;
        const perPlayStacks: Record<string, number> = {};
        if (timesPlayed > 0) for (const [s, v] of Object.entries(statuses)) perPlayStacks[s] = v / timesPlayed;
        const measuredStatus = timesPlayed > 0 ? statusScoreOf(data, perPlayStacks) : 0;
        const measured = timesPlayed > 0
            ? stat.score - stat.damagePortion - stat.statusPortion + measuredDamage + measuredStatus
            : stat.score;

        rows.push({
            cardId,
            name: data.name,
            cost: numericBaseCost(data.baseCost),
            element: data.element,
            description: data.description,
            subjectId,
            timesSeen,
            timesPlayed,
            handEntries,
            // Two denominators on purpose - see `SideTelemetry`. `playRate` is per hand-entry
            // ("when it was available, was it cast"); `deadRate` is per INSTANCE and means the
            // same thing the deck-level ratio means ("did this copy ever get played at all").
            playRate: handEntries > 0 ? round(timesPlayed / handEntries, 3) : 0,
            timesDeadInHand: Math.max(0, timesSeen - instancesPlayed),
            deadRate: timesSeen > 0 ? round(Math.max(0, timesSeen - instancesPlayed) / timesSeen, 3) : 0,
            directDamageDealt: round(direct, 1),
            avgDirectDamagePerPlay: timesPlayed > 0 ? round(direct / timesPlayed, 1) : 0,
            residualDamageShare: share === null ? null : round(share, 1),
            damageShareOfSubject: telemetry.totalDamage > 0
                ? round((direct + (share ?? 0)) / telemetry.totalDamage, 3) : 0,
            statusesApplied: Object.fromEntries(Object.entries(statuses).map(([k, v]) => [k, round(v, 1)])),
            staticScore: stat.score,
            measuredScore: round(measured, 2),
            scoreDelta: round(measured - stat.score, 2),
            sampleSize: timesPlayed,
            confidence: timesPlayed >= DECK_REPORT_THRESHOLDS.cardPlays ? 'ok' : 'low-sample',
            isMocked: false,
        });
    }
    void games;
    return rows.sort((a, b) => b.directDamageDealt - a.directDamageDealt);
}

function buildStatuses(subjectId: string, telemetry: SideTelemetry, games: number): StatusTelemetry[] {
    const totals: Record<string, { stacks: number; events: number; sources: Record<string, number> }> = {};
    for (const [cardId, byStatus] of Object.entries(telemetry.statuses)) {
        for (const [status, stacks] of Object.entries(byStatus)) {
            const rec = totals[status] ?? (totals[status] = { stacks: 0, events: 0, sources: {} });
            rec.stacks += stacks;
            rec.events += telemetry.played[cardId] ?? 0;
            rec.sources[cardId] = (rec.sources[cardId] ?? 0) + stacks;
        }
    }
    return Object.entries(totals).map(([statusId, rec]) => ({
        statusId,
        name: statusId,
        subjectId,
        totalStacksApplied: round(rec.stacks, 1),
        totalApplicationEvents: rec.events,
        avgStacksPerGame: games > 0 ? round(rec.stacks / games, 2) : 0,
        avgApplicationsPerGame: games > 0 ? round(rec.events / games, 2) : 0,
        topSourceCards: Object.entries(rec.sources)
            .sort((a, b) => b[1] - a[1]).slice(0, 3)
            .map(([id]) => GetProgramData(id).name),
        isMocked: false as const,
    })).sort((a, b) => b.totalStacksApplied - a.totalStacksApplied);
}

/**
 * Authored per-subject archetype text. Henry's standing report rule is that a balance report
 * carries archetype framing; deriving it from card data would produce a description of the
 * deck's contents, not of its intent, so it is authored and this map is the place.
 *
 * A subject with no entry is FLAGGED in the generator output rather than shipping a blank
 * appendix (ticket 26's checklist).
 */
export const ARCHETYPE_SUMMARIES: Record<string, string> = {
    fenrir_v1: 'UNBOUND_KERNEL berserker - attacks self-buff and cost 2% maxHP recoil. Ticket 26 shipped it at 0.00 and ticket 28 found the reason: the AI, not the deck.',
    fenrir_v2: 'CINDER_WALL_OS Burn engine - every Burn he applies, INCLUDING to himself, feeds Sharp. Holds ash_communion, the registry\'s loudest card redline.',
    fafnir_v1: 'HOARD_PROTOCOL - bank unused Energy 1:1 against an HP tax, then dump it into deep_vein. Four 0-costs so the AI never has to choose between acting and banking.',
    fafnir_v2: 'CORRUPTED_GOLD_OS - self-inflicted Poison feeds 2 Strengthened per distinct debuff at turn start. Poison rather than Weakened because Poison has no duality partner to annihilate against.',
    skoll_v1: 'TREACHERY_KERNEL glass cannon - Strength on incoming damage. The kernel OVER-feeds: peak Strength measures 13.7 stacks in 3.4-turn games against a 12.5 cap, so the ramp is pinned by turn 2.',
    skoll_v2: 'SOLAR_FLARE_OS - Fire cards against a heavily Burned target refund Energy.',
    jormungandr_v1: 'OUROBOROS_LOOP - an all-Water zero-cost storm where every third Water card refunds Energy and a card; serpents_coil is the cards-played payoff. Nothing here may be None-tier or the loop stops counting.',
    jormungandr_v2: 'VENOM_TRENCH_OS - tanky poison attrition on the roster\'s largest HP pool, into a contagion double-up.',
    gullinbursti_v1: 'UNSTOPPABLE_MASS prime-and-spike - a status card primes, and the next Attack lands with +3 power per stack of Sharp. Ticket 52 gave the prime that Sharp scaling; before it, v1 generated Sharp it had no way to spend.',
    gullinbursti_v2: 'KINETIC_RAM_OS multi-hit - Sharp adds flat damage to every hit, so three-hit cards triple it. The ram blunts its own edge: 1 self-Dazed a turn, and Dazed is Sharp\'s duality partner.',
    hraesvelgr_v1: 'GALE_FORCE_OS - voluntary discards become Air damage. Tempest-heavy, which is why its dead-card ratio needs reading against shed-by-effect rather than rot.',
    hraesvelgr_v2: 'UPDRAFT_KERNEL - permanent scaling on each full cycle of the deck. Carries a standing 48% dead-card reading that predates ticket 46 and nobody has diagnosed.',
    sleipnir_v1: 'MOMENTUM_DRIVE - the same 0-cost fuel ratatoskr_v1 runs, but into raw Strength rather than card volume.',
    sleipnir_v2: 'WAR_STEED_OS - Air attacks generate 0-cost Hoof Strike tokens, so the deck widens as it goes.',
    valkyrie_v1: 'VALHALLA_UPLINK - applying any positive status pays out. PLACEHOLDER deck, untuned; do not read its numbers as balance signal.',
    valkyrie_v2: 'CRUSADER_KERNEL - Light attacks scale on the NUMBER of distinct positive statuses she holds, not their stacks. PLACEHOLDER deck, untuned.',
    audhumbla_v1: 'GENESIS_FIRMWARE - every third Heal or Skill permanently raises her Energy ceiling. PLACEHOLDER deck, untuned.',
    audhumbla_v2: 'NOURISH_ROUTINE - overheal converts into Light damage, so healing past full is offence. PLACEHOLDER deck, untuned.',
    control_v1: 'The instrument, not a Mingming. No firmware, None element (inert in both directions), every card priced exactly at band. It is the FLOOR: beating it is a low bar and the reading is by how much.',
    kraken_v1: 'ABYSSAL_INK draw engine - four draw cards feed the ink, ink_stream is the clock.',
    kraken_v2: 'TIDAL_CRUSH ramp into 3-energy Water payoffs.',
    ratatoskr_v1: 'GOSSIP_NODE card spam. Five 0-costs, each doubled by echo_chamber tokens; seed_bomb is the payoff. shrug_off is its only answer to a status clock.',
    ratatoskr_v2: 'INSTIGATOR_OS Dazed stacking. Same fuel, opposite payoff: slander reads raw Dazed stacks and ignores the +-25% cap.',
    draugr_v1: 'PERMAFROST_WAKE - sleeps on purpose. Asleep is a stance he pays a card to enter; nightmare and barrow_rot cash it, and the wake pays 1 Energized and a card.',
    draugr_v2: 'GRAVE_CHILL_OS - cheap debuff variety, cashed by rimebreaker, which scales on the same distinct-debuff count the firmware gates on.',
    ymir_v1: 'GLACIER_HEART_SYS - the wall IS the weapon. 5 BarkShield at turn start, cast off as damage by avalanche without consuming it.',
    ymir_v2: 'GLACIAL_PACE - two big cards a turn, no 0-costs and no neutral tier, since a None card gets neither STAB nor the Ice bonus.',
    nidhoggr_v1: 'ROOT_CORRUPTION turns poison into a permanent RATE; wither_feast cashes the pile.',
    nidhoggr_v2: 'BLOOD_SCENT pays 1 Energy and a card per below-half crossing.',
    hel_v1: 'TWILIGHT_CADENCE sets her stance from the element she casts, at end of action.',
    hel_v2: 'UNDERWORLD_GATEWAY zeroes her Energy cost and taxes every card at 5% maxHP - the only Mingming who casts 3-energy cards freely, with her own hand as her clock.',
    huldra_v1: 'ALLURE_PROXY mirrors buffs as a hex; hexbloom converts the Weakened pile into Poison at x2 without consuming it.',
    huldra_v2: 'BARK_SHIELD_OS shield wall on a Poison clock - she wins inside the shield\'s life.',
};

export function buildDeckReport(params: {
    command: string;
    config: DeckReportConfig;
    control: { species: string; os: string } | null;
    subjects: Array<{
        id: string;
        species: string;
        os: string;
        matchups: MeasuredMatchup[];
    }>;
}): { report: DeckReport; warnings: string[] } {
    const warnings: string[] = [];
    const registry = getInflatedProgramRegistry();
    void registry;

    const subjects: SubjectDeck[] = [];
    const cards: CardTelemetry[] = [];
    const statuses: StatusTelemetry[] = [];
    const matchups: DeckMatchupRecord[] = [];
    const redlines: DeckRedlineRecord[] = [];

    for (const subject of params.subjects) {
        const definition = MingmingRegistry[subject.species];
        const cardList = definition?.decks?.[subject.os] ?? [];
        const counts: Record<string, number> = {};
        for (const id of cardList) counts[id] = (counts[id] ?? 0) + 1;

        // Merged with EACH matchup's own side. Merging `allRuns` under a single side was the
        // first version and it silently attributed the opponent's cards to the subject
        // wherever the subject sat on the other side of the batch - ymir_v1's status table
        // listed ymir_v2's cards. Per-matchup merge, then combine.
        const blank = (): SideTelemetry => ({ seen: {}, instancesPlayed: {}, handEntries: {}, played: {}, directDamage: {}, statuses: {}, totalDamage: 0 });
        const merged: SideTelemetry = blank();
        const oppMerged: SideTelemetry = blank();
        const absorb = (into: SideTelemetry, from: SideTelemetry) => {
            into.totalDamage += from.totalDamage;
            for (const [k, v] of Object.entries(from.seen)) into.seen[k] = (into.seen[k] ?? 0) + v;
            for (const [k, v] of Object.entries(from.instancesPlayed)) into.instancesPlayed[k] = (into.instancesPlayed[k] ?? 0) + v;
            for (const [k, v] of Object.entries(from.handEntries)) into.handEntries[k] = (into.handEntries[k] ?? 0) + v;
            for (const [k, v] of Object.entries(from.played)) into.played[k] = (into.played[k] ?? 0) + v;
            for (const [k, v] of Object.entries(from.directDamage)) into.directDamage[k] = (into.directDamage[k] ?? 0) + v;
            for (const [k, byStatus] of Object.entries(from.statuses)) {
                const bucket = into.statuses[k] ?? (into.statuses[k] = {});
                for (const [s, v] of Object.entries(byStatus)) bucket[s] = (bucket[s] ?? 0) + v;
            }
        };

        let games = 0;
        let pooledDecisive = 0, pooledWins = 0, pooledIterations = 0, pooledTurns = 0;
        let ftk = 0, truncated = 0, deadNumerator = 0, deadDenominator = 0;
        let firstMoverEdge: number | null = null, sideBias: number | null = null;

        for (const m of subject.matchups) {
            const p = m.paired.pooled;
            const subjectIsPlayer = m.subjectSide === 'PLAYER';
            const wins = subjectIsPlayer ? p.playerWins : p.enemyWins;
            pooledWins += wins;
            pooledDecisive += p.decisive;
            pooledIterations += p.iterations;
            pooledTurns += p.averageTurns * p.iterations;
            ftk += p.ftkCount;
            truncated += p.truncatedCount;
            const deadRatio = subjectIsPlayer ? p.deadCardRatio : p.enemyDeadCardRatio;
            deadNumerator += deadRatio * p.iterations;
            deadDenominator += p.iterations;
            // Turn-order stats come from the MIRROR where one exists: it is the only matchup
            // where the two sides are identical, so it is the only one where a side bias is
            // about the harness rather than about the decks.
            if (firstMoverEdge === null || m.suite === 'mirror') {
                firstMoverEdge = m.paired.firstMoverEdge; sideBias = m.paired.sideBias;
            }
            games += p.runs.length;

            const subjTel = mergeTelemetry(p.runs, m.subjectSide);
            const oppTel = mergeTelemetry(p.runs, subjectIsPlayer ? 'ENEMY' : 'PLAYER');
            absorb(merged, subjTel);
            absorb(oppMerged, oppTel);
            const turnsTotal = p.averageTurns * p.iterations;
            const topCards = Object.entries(subjTel.directDamage)
                .sort((a, b) => b[1] - a[1]).slice(0, 3)
                .map(([id]) => GetProgramData(id).name);
            const statusTotals: Record<string, number> = {};
            for (const byStatus of Object.values(subjTel.statuses))
                for (const [s, v] of Object.entries(byStatus)) statusTotals[s] = (statusTotals[s] ?? 0) + v;
            const topStatuses = Object.entries(statusTotals)
                .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s);

            const confidence: Confidence =
                p.iterations >= DECK_REPORT_THRESHOLDS.matchupIterations ? 'ok' : 'low-sample';
            const flags: string[] = [];
            if (p.ftkCount > 0) flags.push('FTK');
            if (p.averageTurns > 30) flags.push('TURN_COUNT');
            if (confidence === 'low-sample') flags.push('LOW_SAMPLE');

            matchups.push({
                id: m.id, suite: m.suite, role: m.role, label: m.label,
                subject: m.subjectSpecies, subjectOS: m.subjectOS,
                opponent: m.opponent, opponentOS: m.opponentOS,
                iterations: p.iterations,
                playerWins: p.playerWins, enemyWins: p.enemyWins, draws: p.draws, decisive: p.decisive,
                decisiveWinRate: round(p.decisive > 0 ? wins / p.decisive : 0, 3),
                winRate: round(wins / p.iterations, 3),
                averageTurns: round(p.averageTurns, 2),
                deadCardRatio: round(p.deadCardRatio, 4),
                enemyDeadCardRatio: round(p.enemyDeadCardRatio, 4),
                ftkCount: p.ftkCount, truncatedCount: p.truncatedCount,
                firstMoverEdge: round(m.paired.firstMoverEdge, 4),
                sideBias: round(m.paired.sideBias, 4),
                avgDamagePerTurnDealt: turnsTotal > 0 ? round(subjTel.totalDamage / turnsTotal, 2) : null,
                avgDamagePerTurnTaken: turnsTotal > 0 ? round(oppTel.totalDamage / turnsTotal, 2) : null,
                topCardsThisMatchup: topCards.length ? topCards : null,
                topStatusesThisMatchup: topStatuses.length ? topStatuses : null,
                redlineFlags: flags,
                confidence,
                inconclusive: p.decisive === 0,
            });

            if (confidence === 'low-sample') {
                redlines.push({
                    section: 'deck-report', kind: 'LOW_SAMPLE', subject: m.id,
                    metric: 'iterations', value: p.iterations,
                    threshold: DECK_REPORT_THRESHOLDS.matchupIterations, comparison: 'below',
                    detail: `${m.label} ran ${p.iterations} games; under ${DECK_REPORT_THRESHOLDS.matchupIterations} a win rate carries about +-4 points of noise. Confidence flag, not a balance finding.`,
                });
            }
        }

        const totalTurns = pooledTurns;

        const subjectCards = buildCards(subject.id, merged, games, cardList);
        cards.push(...subjectCards);
        const subjectStatuses = buildStatuses(subject.id, merged, games);
        statuses.push(...subjectStatuses);

        const played = subjectCards.filter(c => c.timesSeen > 0);
        const mostUsed = [...played].sort((a, b) => b.playRate - a.playRate)[0] ?? null;
        const leastUsed = [...played].sort((a, b) => a.playRate - b.playRate)[0] ?? null;
        const topDamage = [...subjectCards].sort((a, b) => b.directDamageDealt - a.directDamageDealt)[0] ?? null;
        const totalStacks = subjectStatuses.reduce((a, s) => a + s.totalStacksApplied, 0);
        const totalEvents = subjectStatuses.reduce((a, s) => a + s.totalApplicationEvents, 0);

        const osBehaviour = getOSBehavior(subject.os);
        if (!ARCHETYPE_SUMMARIES[subject.id]) {
            warnings.push(`No authored archetypeSummary for '${subject.id}' - the appendix will read blank. Add one to ARCHETYPE_SUMMARIES in deckReport.ts.`);
        }

        subjects.push({
            id: subject.id,
            species: subject.species,
            os: subject.os,
            osFirmwareDescription: osBehaviour?.description ?? '(no firmware)',
            archetypeSummary: ARCHETYPE_SUMMARIES[subject.id] ?? '',
            cardList: Object.entries(counts).map(([id, count]) => ({ id, count })),
            summary: {
                decisiveWinRate: round(pooledDecisive > 0 ? pooledWins / pooledDecisive : 0, 3),
                winRate: round(pooledIterations > 0 ? pooledWins / pooledIterations : 0, 3),
                averageTurns: round(pooledIterations > 0 ? totalTurns / pooledIterations : 0, 2),
                avgDamagePerTurnDealt: totalTurns > 0 ? round(merged.totalDamage / totalTurns, 2) : 0,
                avgDamagePerTurnTaken: totalTurns > 0 ? round(oppMerged.totalDamage / totalTurns, 2) : 0,
                avgStatusApplicationsPerGame: games > 0 ? round(totalEvents / games, 2) : 0,
                avgStatusStacksPerGame: games > 0 ? round(totalStacks / games, 2) : 0,
                mostUsedCard: mostUsed?.cardId ?? null,
                leastUsedCard: leastUsed?.cardId ?? null,
                highestDamageCard: topDamage && topDamage.directDamageDealt > 0 ? topDamage.cardId : null,
                deadCardIds: subjectCards.filter(c => c.timesSeen > 0 && c.deadRate >= DECK_REPORT_THRESHOLDS.deadRate).map(c => c.cardId),
                deadCardRatio: round(deadDenominator > 0 ? deadNumerator / deadDenominator : 0, 4),
                mostUsedStatus: subjectStatuses[0]?.statusId ?? null,
                ftkCount: ftk,
                ftkRate: round(pooledIterations > 0 ? ftk / pooledIterations : 0, 4),
                truncatedCount: truncated,
                firstMoverEdge,
                sideBias,
                sampleSize: pooledIterations,
                confidence: pooledIterations >= DECK_REPORT_THRESHOLDS.matchupIterations ? 'ok' : 'low-sample',
            },
        });

        for (const card of subjectCards) {
            const band = budgetBandFor(card.cost);
            if (card.staticScore > band.over) {
                redlines.push({
                    section: '1.3', kind: 'CARD_OVER_BUDGET', subject: card.cardId,
                    metric: 'staticScore', value: card.staticScore, threshold: band.over,
                    comparison: 'above',
                    detail: `${card.name} costs ${card.cost} energy and scores ${card.staticScore}, ${round(card.staticScore - band.over, 1)} over the ${band.over} budget for that cost.`,
                });
            }
            if (card.timesSeen >= DECK_REPORT_THRESHOLDS.cardPlays && card.deadRate > DECK_REPORT_THRESHOLDS.deadRate) {
                redlines.push({
                    section: 'deck-report', kind: 'DEAD_CARD_HIGH', subject: card.cardId,
                    metric: 'deadRate', value: card.deadRate, threshold: DECK_REPORT_THRESHOLDS.deadRate,
                    comparison: 'above',
                    detail: `${card.name} reached hand ${card.timesSeen} times in ${subject.id} and was never played ${Math.round(card.deadRate * 100)}% of the time. The deck-level ratio cannot name a trap card; this does.`,
                });
            }
            if (card.timesPlayed >= DECK_REPORT_THRESHOLDS.cardPlays && card.staticScore !== 0) {
                const divergence = Math.abs(card.scoreDelta) / Math.abs(card.staticScore);
                if (divergence > DECK_REPORT_THRESHOLDS.powerDivergence) {
                    redlines.push({
                        section: 'deck-report', kind: 'POWER_DIVERGENCE', subject: card.cardId,
                        metric: 'scoreDelta', value: round(divergence, 2),
                        threshold: DECK_REPORT_THRESHOLDS.powerDivergence, comparison: 'above',
                        detail: `${card.name} prices at ${card.staticScore} statically and measures ${card.measuredScore} over ${card.timesPlayed} plays in ${subject.id} (${card.scoreDelta > 0 ? '+' : ''}${card.scoreDelta}). Either an underpriced sleeper or an overpriced dud - a per-stack scaler reading high is expected, not a defect.`,
                    });
                }
            }
        }
    }

    const report: DeckReport = {
        schemaVersion: DECK_REPORT_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        command: params.command,
        registryHash: computeRegistryHash(),
        config: params.config,
        control: params.control,
        subjects,
        cards,
        statuses,
        matchups,
        redlines,
        notes: { instrumentationPending: [] },
    };
    return { report, warnings };
}

export function writeDeckReport(report: DeckReport, path = DECK_REPORT_JSON_PATH): string {
    if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return path;
}

/**
 * Write the self-contained viewer with this run's data embedded.
 *
 * Embedded rather than fetched on purpose: a browser opened on a `file://` page cannot fetch
 * a sibling JSON, so a viewer that loaded its data over the network would be broken in
 * exactly the way this tool is meant to be used - double-click the file, look at the deck.
 * The file-input loader still points the same page at any other generated report.
 */
export function writeDeckReportViewer(report: DeckReport, path = DECK_REPORT_HTML_PATH): string {
    const template = readFileSync(VIEWER_TEMPLATE_PATH, 'utf8');
    if (!template.includes('__DECK_REPORT_JSON__')) {
        throw new Error('[deckReport] Viewer template is missing its __DECK_REPORT_JSON__ placeholder.');
    }
    // `</script>` inside the payload would close the host tag early; the JSON spec allows the
    // escape, and `JSON.parse` reads it back identically.
    const payload = JSON.stringify(report, null, 2).replace(/<\/script/gi, '<\\/script');
    if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, template.replace('__DECK_REPORT_JSON__', payload), 'utf8');
    return path;
}

/** Convenience for callers that only have a `BatchResult`. */
export function totalDamageOf(batch: BatchResult, side: Side): number {
    return mergeTelemetry(batch.runs, side).totalDamage;
}
