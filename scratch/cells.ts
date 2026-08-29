/**
 * Ticket 79: the four decks at the top of the field, on one instrument.
 *
 * Henry's framing, and it is the right one: **damage share does not diagnose anything** - several
 * of these decks are built around a single payoff on purpose. The two questions that matter are
 *
 *   1. HOW EASY is the payoff to reach?   (setup turns, casts a game, how often the gate is open)
 *   2. HOW HARD does it hit when it lands? (damage as a share of the target's whole health bar)
 *
 * plus a third that separates a strong DECK from a strong OS:
 *
 *   3. HOW MUCH of the win rate is the OS?  (measured by turning the OS off)
 *
 * One process per arm: the firmware registry builds its hooks once, lazily, from the imported
 * hooks.json, so an arm that edits an OS has to do it before the first battle.
 *
 * env:
 *   DECK  - hel_v2 | ymir_v2 | nidhoggr_v1 | nidhoggr_v2
 *   ARM   - a `key=value,key=value` knob string; `osoff` disables the OS entirely
 *   ITER  - iterations per opponent per turn order (default 30)
 */
import HOOKS_DATA from '../src/engine/data/lib/hooks.json';
import { ENV } from './_env';

const DECK = ENV.DECK ?? 'hel_v2';
const ARM = ENV.ARM ?? 'live';
const knob: Record<string, string> = {};
for (const kv of ARM.split(',')) { const [k, v] = kv.split('='); if (k) knob[k] = v ?? '1'; }
const H = HOOKS_DATA as unknown as Record<string, {
    maxCardsPerTurn?: number;
    hooks: Array<{ id: string; when?: Record<string, unknown>; do?: Array<{ type: string; amount?: number }>; multiplier?: number }>;
}>;

// ---- OS edits that must land before the firmware registry initialises ----
// `osoff` has to clear BOTH sources. `initFirmwareHooks` concatenates hooks.json's `hooks` with
// `CustomFirmware[key]`, and hel_v2's blood cost and ymir_v2's Ice bonus live entirely in the
// latter - clearing only the JSON side measured hel's healing bonus alone and measured nothing
// at all for ymir.
const CF = (await import('../src/engine/core/CustomFirmware')).CustomFirmware as Record<string, unknown[]>;
if (knob.osoff) {
    H[DECK].hooks = [];
    delete CF[DECK];
    if (DECK === 'ymir_v2') H[DECK].maxCardsPerTurn = undefined;
}
if (DECK === 'hel_v2' && knob.heal) {
    const lb = H.hel_v2.hooks.find(h => h.id === 'hel_v2_lifeblood');
    if (lb) lb.multiplier = Number(knob.heal);
}
if (DECK === 'ymir_v2' && knob.maxcards) H.ymir_v2.maxCardsPerTurn = Number(knob.maxcards);
if (DECK === 'nidhoggr_v1' && knob.rootmin) {
    // ROOT_CORRUPTION only maintains a pile that is already at least this big - the "extra
    // condition so it triggers less" shape.
    const r = H.nidhoggr_v1.hooks.find(h => h.id === 'nidhoggr_v1_root');
    if (r) (r.when as { sourceStatus?: { status: string; minStacks: number } }).sourceStatus = { status: 'Poison', minStacks: Number(knob.rootmin) };
}
if (DECK === 'fenrir_v1') {
    // UNBOUND_KERNEL charges 2% max HP RECOIL on every attack she plays, on a 66 HP frame -
    // a per-attack tax on the deck with the most 0% cells in the game.
    const f = H.fenrir_v1.hooks.find(h => h.id === 'fenrir_v1_hook');
    if (f && knob.recoil !== undefined) {
        if (knob.recoil === '0') f.do = (f.do ?? []).filter(x => x.type !== 'HP');
        else {
            const hpAct = f.do?.find(x => x.type === 'HP') as { percentMaxHP?: number } | undefined;
            // Ticket 82 REMOVED the HP action, so a recoil arm has to put one back.
            if (hpAct) hpAct.percentMaxHP = -Number(knob.recoil);
            else (f.do ?? []).unshift({ type: 'HP', target: 'SELF', percentMaxHP: -Number(knob.recoil) } as unknown as { type: string });
        }
    }
    // Ticket 83, Henry's suggestion: give the recoil a PRODUCT - "Fire attacks deal X% more".
    if (knob.firepct) {
        H.fenrir_v1.hooks.push({
            id: 'fenrir_v1_fire_bonus', trigger: 'onDamageCalculated', priority: 40,
            when: { source: 'SELF', programElement: 'Fire' },
            multiplier: 1 + Number(knob.firepct) / 100,
        } as unknown as { id: string });
    }
    if (f && knob.recoilcost) {
        // Shape-preserving buff: the recoil STAYS, it just stops taxing her cheap attacks.
        (f.when as { baseCost?: { operator: string; value: number } }).baseCost = { operator: 'GTE', value: Number(knob.recoilcost) };
    }
    if (f && knob.str) {
        const stAct = f.do?.find(x => x.type === 'STATUS') as { stacks?: number } | undefined;
        if (stAct) stAct.stacks = Number(knob.str);
    }
}
if (DECK === 'sleipnir_v1') {
    // MOMENTUM_DRIVE grants 2 Strengthened per 0-cost card. `momentum` sets that rate; the
    // waste test is whether HALVING it costs her anything, because she applies ~20 stacks a
    // game into a payoff that reads at most STRENGTH_STACK_CAP (8) and a damage bonus that
    // caps at +25% (12.5 stacks).
    const w = H.sleipnir_v1.hooks.find(h => h.id === 'sleipnir_v1_hook');
    if (w && knob.momentum) {
        const st = w.do?.find(x => x.type === 'STATUS') as { stacks?: number } | undefined;
        if (st) st.stacks = Number(knob.momentum);
    }
}
// Ticket 94 - the three engines behind 16 of the 20 remaining absolutes.
// `nourish` - NOURISH_ROUTINE converts this fraction of a heal's printed power into damage. At
// 0.5 audhumbla_v2's whole offence is a fraction of her sustain, which is why her games run 10.5
// turns and why every result is decided by one inequality instead of by play.
if (DECK === 'audhumbla_v2' && knob.nourish) {
    const n = H.audhumbla_v2.hooks.find(h => h.id === 'aud_v2_nourish');
    const atk = n?.do?.find(x => x.type === 'ATTACK') as { power?: number } | undefined;
    if (atk) atk.power = Number(knob.nourish);
}
// `shield=a:b:c` - gullinbursti's Bark Shield grants, in deck order: shield_shards,
// spiked_carapace, stone_bark. Sharp is CAPPED at -25% and is his identity, so it is untouched;
// Bark Shield absorbs point for point with no cap, which is what makes the wall unbreakable
// rather than merely strong.
if (DECK.startsWith('gullinbursti') && knob.shieldnums) {
    const [shards, carapace, bark] = knob.shieldnums.split(':').map(Number);
    const PR = (await import('../src/engine/data/programRegistry')).ProgramRegistry as unknown as
        Record<string, { actions: Array<{ type: string; status?: string; stacks?: number }> }>;
    const setShield = (card: string, value: number) => {
        if (!Number.isFinite(value)) return;
        for (const act of PR[card]?.actions ?? [])
            if (act.type === 'STATUS' && act.status === 'BarkShield') act.stacks = value;
    };
    setShield('shield_shards', shards);
    setShield('spiked_carapace', carapace);
    setShield('stone_bark', bark);
}
if (DECK === 'sleipnir_v2') {
    // WAR_STEED_OS generates one 0-cost Hoof Strike per Air ATTACK played.
    const w = H.sleipnir_v2.hooks.find(h => h.id === 'sleipnir_v2_hook');
    // `anyair` - the OS pays on any Air card, not only attacks (it currently ignores tailwind/tempest).
    if (w && knob.anyair) delete (w.when as Record<string, unknown>).actionType;
    // `token2` - two tokens a trigger instead of one.
    if (w && knob.token2) {
        const gen = w.do?.find(x => x.type === 'GENERATE_CARD');
        if (gen) w.do?.unshift(JSON.parse(JSON.stringify(gen)));
    }
}
if (DECK === 'kraken_v2') {
    // TIDAL_CRUSH only pays on Water cards costing 3+ Energy, on a 2-Energy frame.
    const t = H.kraken_v2.hooks.find(h => h.id === 'kraken_v2_hook') as unknown as
        { when?: { baseCost?: { operator: string; value: number } }; multiplier?: number };
    if (t && knob.tidalcost) t.when!.baseCost = { operator: 'GTE', value: Number(knob.tidalcost) };
    if (t && knob.tidalpct) t.multiplier = 1 + Number(knob.tidalpct);
}
if (DECK === 'fafnir_v2' && knob.strper) {
    const f = H.fafnir_v2.hooks.find(h => h.id === 'fafnir_v2_corrupted');
    for (const x of f?.do ?? [])
        if (x.type === 'STATUS' && (x as { status?: string }).status === 'Strengthened')
            (x as { stacks?: number }).stacks = Number(knob.strper);
}
if (DECK === 'ymir_v1' && knob.shield) {
    // GLACIER_HEART hands her 5 Bark Shield at the start of every turn, unconditionally - and
    // `avalanche` is 9 power per stack, uncapped. The OS IS the engine.
    const g = H.ymir_v1.hooks.find(h => h.id === 'ymir_v1_hook');
    const stx = g?.do?.find(x => x.type === 'STATUS') as { stacks?: number } | undefined;
    if (stx) stx.stacks = Number(knob.shield);
}
if (DECK === 'valkyrie_v2') {
    const r = H.valkyrie_v2.hooks.find(h => h.id === 'valk_v2_rebirth');
    if (r && knob.rebirth) for (const x of r.do ?? [])
        if (x.type === 'ATTACK' || x.type === 'HEAL') (x as { power?: number }).power = Number(knob.rebirth);
    if (r && knob.noheal) r.do = (r.do ?? []).filter(x => x.type !== 'HEAL');
}
if (DECK === 'nidhoggr_v2') {
    const b = H.nidhoggr_v2.hooks.find(h => h.id === 'nidhoggr_v2_bloodscent');
    // The live hook has NO `when` at all, so it fires when SHE crosses too - and her deck
    // self-poisons and self-heals across the line on purpose.
    if (b && knob.oppsonly) b.when = { source: 'OPPONENT' };
    if (b && knob.drop) b.do = (b.do ?? []).filter(a => a.type !== knob.drop.toUpperCase());
}

const { battleReducer } = await import('../src/engine/battleReducer');
const { getBestAction } = await import('../src/engine/ai/TacticalAI');
const { runPairedBatch, applyStatJitter, deriveSeeds } = await import('../src/debug/balance/runBatch');
const { buildScenarioState } = await import('../src/debug/scenarios/buildScenarioState');
const { matchupScenario, BALANCE_SPECIES } = await import('../src/debug/balance/balanceScenarios');
const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');
const { OS_KNOBS } = await import('../src/engine/core/CustomFirmware');
type IBattleState = import('../src/engine/types').IBattleState;
type IBattleEntity = import('../src/engine/types').IBattleEntity;
type BattleAction = import('../src/engine/battleReducer').BattleAction;

if (knob.pct) OS_KNOBS.hel.pctPerEnergy = Number(knob.pct);
if (knob.cap) OS_KNOBS.hel.capPct = Number(knob.cap);
if (knob.ice) OS_KNOBS.ymir.iceBonus = Number(knob.ice);
if (knob.shuffles) OS_KNOBS.hraes.shufflesNeeded = Number(knob.shuffles);
if (knob.hoardpct) OS_KNOBS.fafnir.hoardRecoilPct = Number(knob.hoardpct);

// `berserk=N` - Fire attacks deal up to N% more damage, scaled by how much max HP is MISSING.
// At N=50 that is +25% at half health and +50% at death's door. This is the shape the recoil was
// always supposed to be buying: the price and the product are the same quantity.
if (DECK === 'fenrir_v1' && knob.berserk) {
    const rate = Number(knob.berserk) / 100;
    (CF as Record<string, unknown[]>).fenrir_v1 = [
        ...((CF as Record<string, unknown[]>).fenrir_v1 ?? []),
        {
            id: 'fenrir_v1_berserk',
            priority: 40,
            onDamageCalculated: (currentDamage: number, context: { source?: { id: string }; program?: { element?: string } }, owner: { id: string; currentHp: number; maxHp: number }): number => {
                if (context.source?.id === owner.id && context.program?.element === 'Fire') {
                    const missing = 1 - owner.currentHp / Math.max(1, owner.maxHp);
                    return currentDamage + Math.floor(currentDamage * rate * missing);
                }
                return currentDamage;
            },
        },
    ];
}

const SPECIES = DECK.replace(/_v[12]$/, '');
const REG = MingmingRegistry as unknown as Record<string, {
    baseStats: { hp: number; attack: number; defense: number; energy: number };
    availableOS: string[]; decks: Record<string, string[]>;
}>;
for (const st of ['hp', 'attack', 'defense', 'energy'] as const) if (knob[st]) REG[SPECIES].baseStats[st] = Number(knob[st]);
// Ticket 88: the two constants that are secretly the whole archetype axis. `energy` is 2 on 14 of
// 15 species and `cardDraw` is 3 on 12 of 15 - ratatoskr's 3/4 is the only variation in the game.
if (knob.draw) (REG[SPECIES] as unknown as { cardDraw: number }).cardDraw = Number(knob.draw);
// Ticket 92, Henry's question: Burn was PERMANENT before rev 3 and now decays 1 stack a turn.
// `burnperm` restores the old shape - the pile holds between turns - so we can measure whether
// permanence makes any deck OP before changing anything. Patched through the exported config so
// the tier table, the cap and the detonation are all untouched.
if (knob.burnperm) {
    const SB = await import('../src/engine/StatusBehaviors');
    (SB as unknown as { BURN_CONFIG: { decayPerTurn?: number } }).BURN_CONFIG.decayPerTurn = 0;
}
if (knob.cut) REG[SPECIES].decks[DECK] = REG[SPECIES].decks[DECK].filter((c, i, a) => !(c === knob.cut && a.indexOf(c) === i));
if (knob.swap) { const [from, to] = knob.swap.split(':'); REG[SPECIES].decks[DECK] = REG[SPECIES].decks[DECK].map(c => (c === from ? to : c)); }
// `swap2` / `swap3`: a second and third substitution, for arms that replace more than one card -
// audhumbla_v2 needs two or three heals turned into damage before the cliff becomes a slope.
for (const k of ['swap2', 'swap3'] as const) {
    if (!knob[k]) continue;
    const [from, to] = knob[k].split(':');
    REG[SPECIES].decks[DECK] = REG[SPECIES].decks[DECK].map(c => (c === from ? to : c));
}

const ITER = Number(ENV.ITER ?? 30);
const hp = (p: ReadonlyArray<IBattleEntity>) => p.reduce((t, e) => t + e.currentHp, 0);

/** The payoff card each deck is built around, and the gate it has to open. */
const PAYOFF: Record<string, string[]> = {
    hel_v2: ['soul_tithe', 'last_rites'],
    ymir_v2: ['glacial_maul'],
    nidhoggr_v1: ['wither_feast', 'blight_bloom'],
    nidhoggr_v2: ['rend_marrow', 'leech_strike'],
    ymir_v1: ['avalanche'],
    hraesvelgr_v2: ['thermal_lance', 'firestorm_talon'],
    valkyrie_v2: ['starfall', 'ascension'],
    fenrir_v1: ['ragnarok_edge', 'berserk_rush'],
    kraken_v2: ['maelstrom', 'hydro_blast'],
    fafnir_v1: ['deep_vein', 'hoardbreaker'],
    fafnir_v2: ['veinburst', 'boulder_smash'],
    sleipnir_v2: ['lance', 'cavalry_charge'],
    ratatoskr_v1: ['scavenge_data', 'nut_stash'],
    draugr_v1: ['deathless_slumber', 'nightmare'],
    fenrir_v2: ['molten_core', 'pyre_sacrifice'],
    skoll_v2: ['all_in', 'overdrive'],
    audhumbla_v1: ['supernova_v2', 'dawn_of_creation'],
    audhumbla_v2: ['genesis_surge', 'sacred_spring'],
    gullinbursti_v1: ['stone_fist'],
    huldra_v1: ['hexbloom', 'mind_thrall'],
    sleipnir_v1: ['stampede', 'momentum_crash'],
    jormungandr_v1: ['ink_stream', 'serpents_coil'],
    hraesvelgr_v1: ['tempest', 'carrion_swoop'],
};

/** Card-power knob, so a rate can be swept without editing programs.json. `card=id:power`. */
if (knob.card) {
    const [cid, pw] = knob.card.split(':');
    ((await import('../src/engine/data/programRegistry')).ProgramRegistry as unknown as
        Record<string, { actions: Array<{ power?: number }> }>)[cid].actions[0].power = Number(pw);
}

// `bloodflip` - blood_rite currently LOSES half its damage below 50% and heals you back over the
// threshold, which is the berserk payoff running in reverse on two of nine cards. This flips it:
// the heal is the HEALTHY mode, the extra 15 power is the HURT mode.
// `feralbite` - injects a new 0e card, the accelerator the kit has never had: nothing in the pool
// lets a Mingming spend HP on purpose except hel, and she does it through her OS.
{
    const PR = (await import('../src/engine/data/programRegistry')).ProgramRegistry as unknown as
        Record<string, { actions: Array<{ conditionals?: Array<{ value: string }> }> }>;
    if (knob.bloodflip) {
        for (const act of PR.blood_rite.actions)
            for (const c of act.conditionals ?? [])
                c.value = c.value === 'GT:50' ? 'LT:51' : 'GT:50';
    }
    if (knob.feralbite) {
        (PR as unknown as Record<string, unknown>).feral_bite = {
            id: 'feral_bite', name: 'Feral Bite',
            description: 'Lose 8% of your max HP. Gain 2 Strengthened.',
            element: 'Fire', target: 'Self', category: 'Skill', rarity: 'Common', baseCost: 0,
            constraints: ['not_stunned', 'not_asleep', 'energy_base'],
            actions: [
                { type: 'HP', target: 'SELF', percentMaxHP: -8 },
                { type: 'STATUS', status: 'Strengthened', stacks: 2, target: 'SELF' },
            ],
        };
    }
}


// `shieldcap=N` - clamp Bark Shield to N%% of maxHP. Bark Shield is the only UNCAPPED mitigation
// in the game: stacks are percent-of-maxHP, they absorb point for point, and gullinbursti can hold
// 21 of them. If a rail is breakable by a mechanic rather than by numbers, this is the mechanic.
if (knob.shieldcap) {
    const SB = await import('../src/engine/StatusBehaviors');
    const behavior = (SB.getStatusBehavior('BarkShield')) as unknown as {
        onApply: (e: unknown[], n: number, t: unknown, s?: unknown, p?: unknown) => { updatedEffects: Array<{ type: string; stacks: number }> };
    };
    const original = behavior.onApply.bind(behavior);
    const cap = Number(knob.shieldcap);
    behavior.onApply = (effects, incoming, target, source, power) => {
        const result = original(effects, incoming, target, source, power);
        return {
            ...result,
            updatedEffects: result.updatedEffects.map(e =>
                e.type === 'BarkShield' ? { ...e, stacks: Math.min(e.stacks, cap) } : e),
        };
    };
}

// `pierce` - injects a hypothetical payoff that IGNORES Bark Shield, to test whether the rail is
// breakable by DESIGN when it is not breakable by numbers. Bark Shield absorbs point for point and
// is the only uncapped mitigation in the game; a card that goes round it is the smallest change
// that could reach a 0% cell.
if (knob.pierce) {
    const PR = (await import('../src/engine/data/programRegistry')).ProgramRegistry as unknown as Record<string, unknown>;
    PR.sunder = {
        id: 'sunder', name: 'Sunder', description: '60 power. Ignores Bark Shield.',
        element: 'Earth', target: 'Single', category: 'Attack', rarity: 'Rare', baseCost: 2,
        constraints: ['not_stunned', 'not_asleep', 'energy_base'],
        actions: [{ type: 'ATTACK', power: 60, target: 'TARGET', ignoreShield: true }],
    };
}

// ---- CELLS: the specific matchups this pass exists to fix ----
// Ticket 94. Field win rate is the wrong instrument for an absolute: a 0% cell can stay 0% while
// the field number moves five points, and the <10%/>90% counts in `offenders` include
// type-advantaged cells, which Henry's bucket standard exempts. So measure the CELLS themselves.
// env: CELLS="opponent,opponent,..."  (default: every neutral absolute this deck is in)
const CELLS = (ENV.CELLS ?? '').split(',').filter(Boolean);
const ITER_C = Number(ENV.ITER ?? 30);
console.error(`\nCELLS ${DECK} [${ARM}]`);
let worst = 1, best = 0;
for (const opp of CELLS) {
    const oppSpecies = opp.replace(/_v[12]$/, '');
    const r = runPairedBatch(matchupScenario({
        player: SPECIES, enemy: oppSpecies, playerOS: DECK, enemyOS: opp,
        seed: `grid:${DECK}:${opp}`,
    }), { iterations: ITER_C });
    const w = r.pooled.decisiveWinRate;
    worst = Math.min(worst, w); best = Math.max(best, w);
    const flag = w === 0 ? '  <-- STILL 0%' : w === 1 ? '  <-- STILL 100%' : '';
    console.error(`  vs ${opp.padEnd(18)}${(w * 100).toFixed(1).padStart(6)}%${flag}`);
}
console.error(`  worst ${(worst * 100).toFixed(1)}%   best ${(best * 100).toFixed(1)}%`);
