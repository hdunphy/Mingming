/**
 * TICKET 149 (3d) — fold the cast-probe OS proc tallies into the firmware power-rate table.
 *
 * One row per OS hook that fired: procs/game, delivered per proc and per game (damage raw before
 * shields / applied after, HP healed, HP paid, stacks granted, energy, max energy, cards), and the
 * implied rate for HP-denominated payoffs:
 *
 *     rate = (delivered %maxHp per proc / printed power) x 0.75   -> "HP per printed power on a 75-HP frame"
 *
 * which is the unit ticket 61 reported (0.19 damage / 0.20 heal, against the 0.30 folklore). The
 * frame is the OWNER's maxHp (ticket 61's convention); enemy frames differ by up to ~15%.
 * Reference points on that scale: the spec's damage rate 3 power per 1% = 0.25 HP/power, the heal
 * rate 4 power per 1% = 0.1875 HP/power.
 *
 * Grants (stacks / energy / draw / max energy) are converted to power with the scorer's own tables
 * (Strengthened / Dazed 5 per stack, Sharp / Weakened 3.5, Regen 12, BarkShield 4 per %, Energized 35,
 * energy 40 per point, draw 15 first card, max energy 40 per point per remaining turn is NOT assumed -
 * a max-energy point is priced flat at 40) and then to HP at the damage rate, so a grant's
 * "delivered HP-eq" is exactly the scorer's own price - the rate column is therefore n/a for grants
 * and only HP payoffs are flagged.
 *
 * Run: npx vite-node scratch/t149_oscensus_report.ts -- --dir results/t149_oscensus --extra results/t149_consume
 */
import fs from 'node:fs';
import path from 'node:path';
import { arg } from './_env';

const DIRS = [arg('dir', 'results/t149_oscensus'), ...arg('extra', '').split(',').filter(Boolean)];

interface Tally { fires: number; offers: number; dmgHp: number; ledgerRaw: number; healHp: number; selfDmgHp: number; stacks: Record<string, number>; energy: number; maxEnergy: number; hand: number; modDelta: number; modIn: number; modPos: number; modNeg: number }
interface Game { owner: string; turns: number; ownerMaxHp: number; ownerTurnsAlive: number; procs: Record<string, Tally>; casts: Array<{ card: string; post: Record<string, number>; pre: Record<string, number> }> }

const STACK_POWER: Record<string, number> = { Strengthened: 5, Dazed: 5, Sharp: 3.5, Weakened: 3.5, Regen: 12, BarkShield: 4, Energized: 35, Burn: 9, Poison: 3 };

/** printed payoff per hook, for the table. `power` is what the rate divides by. */
const PRINTED: Record<string, { os: string; text: string; power?: number; kind: 'dmg' | 'heal' | 'cost' | 'grant' | 'mod' | 'flat' }> = {
    valk_v2_rebirth: { os: 'valkyrie_v2 REBIRTH_CYCLE_OS', text: 'on reshuffle: 15 power Light to random enemy + heal self 15 power', power: 15, kind: 'dmg' },
    ratatoskr_v1_hook: { os: 'ratatoskr_v1 GOSSIP_NODE', text: 'ally plays 0-cost: heal that ally 10 power', power: 10, kind: 'heal' },
    fenrir_v1_ally_hook: { os: 'fenrir_v1 UNBOUND_KERNEL', text: 'ally attack: +1 Strengthened (in 1v1 SELF counts as ally: fires on own attacks)', kind: 'grant' },
    hraes_v1_gale: { os: 'hraesvelgr_v1 GALE_FORCE_OS', text: 'voluntary discard: 8 power Air to random enemy', power: 8, kind: 'dmg' },
    hoofbeat_daemon_hook: { os: 'sleipnir_v1 hoofbeat_daemon (card)', text: 'play 0-cost: 8 power Air to random enemy', power: 8, kind: 'dmg' },
    hel_v2_underworld_toll: { os: 'hel_v2 UNDERWORLD_GATEWAY', text: 'Dark spell costs 5% maxHp per printed Energy (cap 25%/turn)', kind: 'cost' },
    hel_v2_underworld_cost: { os: 'hel_v2 UNDERWORLD_GATEWAY', text: 'onCostCalculated: Dark spell ENERGY cost -> 0 (the mod delta here is energy, not HP)', kind: 'mod' },
    // hel_v2_lifeblood: DELETED by ticket 150a. It was an onHealCalculated multiplier of 1.0 and
    // this census is what proved it inert (0 procs). The row is kept out rather than kept as a
    // zero, because a zero here reads as a measurement of something that exists.
    hraesvelgr_v2_updraft: { os: 'hraesvelgr_v2 UPDRAFT_KERNEL', text: 'after 2 deck cycles: +1 max Energy (once)', kind: 'grant' },
    aud_v1_genesis: { os: 'audhumbla_v1 GENESIS_FIRMWARE', text: 'overheal: +1 max Energy (once/turn)', kind: 'grant' },
    jorm_v2_toxin_fang: { os: 'jormungandr_v2 TOXIN_FANG_OS', text: 'attacks +10 HP (flat, post-divisor) per Poison stack on target', kind: 'mod' },
    gullin_v2_ram: { os: 'gullinbursti_v2 KINETIC_RAM_OS', text: 'Earth attacks +2.5 HP (flat, post-divisor) per Sharp stack, per hit', kind: 'mod' },
    gullin_v2_blunt: { os: 'gullinbursti_v2 KINETIC_RAM_OS', text: 'turn start: 1 Dazed on self', kind: 'grant' },
    kraken_v2_hook: { os: 'kraken_v2 TIDAL_CRUSH_OS', text: 'Water cards costing 2+ deal x1.3', kind: 'mod' },
    jorm_v1_trigger: { os: 'jormungandr_v1 OUROBOROS_LOOP', text: '5th Water card a turn: draw 1', kind: 'grant' },
    skoll_v1_hook: { os: 'skoll_v1 TREACHERY_KERNEL', text: 'ally hit by enemy attack: +1 Strengthened', kind: 'grant' },
    skoll_v2_solar_overdrive: { os: 'skoll_v2 SOLAR_OVERDRIVE_OS', text: 'attacks +10% per Strengthened stack', kind: 'mod' },
    skoll_v2_solar_charge: { os: 'skoll_v2 SOLAR_OVERDRIVE_OS', text: 'ally plays Fire attack: +1 Strengthened', kind: 'grant' },
    fenrir_v1_hook: { os: 'fenrir_v1 UNBOUND_KERNEL', text: 'attack: +1 Strengthened and -2% maxHp recoil', kind: 'cost' },
    fenrir_v1_berserk: { os: 'fenrir_v1 UNBOUND_KERNEL', text: 'Fire attacks up to +50% scaled by missing HP', kind: 'mod' },
    fenrir_v2_hook: { os: 'fenrir_v2 CINDER_WALL_OS', text: 'ally applies Burn: +1 Sharp', kind: 'grant' },
    ymir_v1_hook: { os: 'ymir_v1 GLACIER_HEART_SYS', text: 'turn start: +4 BarkShield (%maxHp)', kind: 'grant' },
    ymir_v2_glacial: { os: 'ymir_v2 GLACIAL_PACE_OS', text: 'Ice cards x1.25', kind: 'mod' },
    huldra_v2_bark_end: { os: 'huldra_v2 BARK_SHIELD_OS', text: 'end of first turn: 50% BarkShield (allies smaller)', kind: 'grant' },
    huldra_v1_hook: { os: 'huldra_v1 ALLURE_PROXY', text: 'ally buffs ally: 1 Weakened on random enemy', kind: 'grant' },
    draugr_v2_chill: { os: 'draugr_v2 GRAVE_CHILL_OS', text: 'enemies with 2+ debuffs deal x0.8 to Draugr', kind: 'mod' },
    draugr_v1_wake: { os: 'draugr_v1 PERMAFROST_WAKE', text: 'wake from Asleep: +1 Energized, draw 1', kind: 'grant' },
    fafnir_v1_hoard: { os: 'fafnir_v1 HOARD_PROTOCOL', text: 'turn end: unspent Energy -> Energized', kind: 'grant' },
    fafnir_v1_recoil: { os: 'fafnir_v1 HOARD_PROTOCOL', text: 'turn start: 1% maxHp per hoarded point (min 1)', kind: 'cost' },
    fafnir_v2_corrupted: { os: 'fafnir_v2 CORRUPTED_GOLD_OS', text: 'turn start: +2 Strengthened per debuff type, each debuff -1', kind: 'grant' },
    aud_v2_milk: { os: 'audhumbla_v2 PRIMORDIAL_MILK', text: 'heal card: +3 Regen', kind: 'grant' },
    nidhoggr_v1_root: { os: 'nidhoggr_v1 ROOT_CORRUPTION', text: 'enemy turn end: +1 Poison (cancels the decay)', kind: 'grant' },
    nidhoggr_v2_bloodscent: { os: 'nidhoggr_v2 BLOOD_SCENT_OS', text: 'any unit crosses half HP: +1 Energy, draw 1', kind: 'grant' },
    kraken_v1_hook: { os: 'kraken_v1 ABYSSAL_INK_SYS', text: 'ally effect-draw: 2 Dazed on random enemy', kind: 'grant' },
    ratatoskr_v2_hook: { os: 'ratatoskr_v2 INSTIGATOR_OS', text: 'ally plays 0-cost at enemy: 1 Dazed on target', kind: 'grant' },
    hel_v1_cadence_dark: { os: 'hel_v1 TWILIGHT_CADENCE', text: 'Dark cast: DarkStance (+45% dmg dealt)', kind: 'grant' },
    hel_v1_cadence_light: { os: 'hel_v1 TWILIGHT_CADENCE', text: 'Light cast: LightStance (-45% dmg taken)', kind: 'grant' },
    valkyrie_v1_uplink: { os: 'valkyrie_v1 VALHALLA_UPLINK', text: 'turn end: replay a random discard for free', kind: 'flat' },
    sleipnir_v1_hook: { os: 'sleipnir_v1 MOMENTUM_DRIVE', text: 'play 0-cost: +1 Strengthened', kind: 'grant' },
    sleipnir_v2_hook: { os: 'sleipnir_v2 WAR_STEED_OS', text: 'Air attack: generate hoof_strike token', kind: 'flat' },
    gullin_v1_prepare: { os: 'gullinbursti_v1 UNSTOPPABLE_MASS', text: 'non-attack status card primes next attack +3 power per Sharp', kind: 'flat' },
    echo_chamber_daemon_hook: { os: 'ratatoskr echo_chamber (card)', text: '0-cost play: feedback token', kind: 'flat' },
};

const f1 = (x: number): string => Number.isFinite(x) ? x.toFixed(1) : '-';
const f2 = (x: number): string => Number.isFinite(x) ? x.toFixed(2) : '-';
const f3 = (x: number): string => Number.isFinite(x) ? x.toFixed(3) : '-';

interface Row { owner: string; hook: string; games: number; fires: number; offers: number; t: Tally; maxHp: number; turns: number }
const rows: Row[] = [];
const ENEMY_BUFF = new Set(['Sharp', 'BarkShield', 'Strengthened', 'Regen', 'Energized']);
for (const dir of DIRS) for (const f of [...fs.readdirSync(dir)].sort((a, b) => Number(b.includes('_s.')) - Number(a.includes('_s.')))) {
    if (!f.startsWith('w1_') || !f.endsWith('.jsonl') || f.includes('firepunch')) continue;
    const games: Game[] = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    if (!games.length) continue;
    const owner = games[0].owner;
    if (rows.some(r => r.owner === owner)) continue; // the _s rerun and the original: keep the first seen
    const acc = new Map<string, Tally>();
    let maxHp = 0, turns = 0;
    for (const g of games) {
        maxHp += g.ownerMaxHp; turns += g.turns;
        for (const [h, t] of Object.entries(g.procs)) {
            let a = acc.get(h); if (!a) { a = { fires: 0, offers: 0, dmgHp: 0, ledgerRaw: 0, healHp: 0, selfDmgHp: 0, stacks: {}, energy: 0, maxEnergy: 0, hand: 0, modDelta: 0, modIn: 0, modPos: 0, modNeg: 0 }; acc.set(h, a); }
            a.fires += t.fires; a.offers += t.offers; a.dmgHp += t.dmgHp; a.ledgerRaw += t.ledgerRaw; a.healHp += t.healHp; a.selfDmgHp += t.selfDmgHp;
            a.energy += t.energy; a.maxEnergy += t.maxEnergy; a.hand += t.hand; a.modDelta += t.modDelta; a.modIn += t.modIn; a.modPos += t.modPos; a.modNeg += t.modNeg;
            for (const [s, n] of Object.entries(t.stacks)) a.stacks[s] = (a.stacks[s] ?? 0) + n;
        }
    }
    for (const [h, t] of acc) rows.push({ owner, hook: h, games: games.length, fires: t.fires, offers: t.offers, t, maxHp: maxHp / games.length, turns: turns / games.length });
}

console.log('| OS / hook | payoff text | printed | procs/game (offers/game) | delivered / proc | delivered / game | implied rate (HP per printed power, 75-frame) | flag |');
console.log('|---|---|---|---|---|---|---|---|');
const flagged: Array<{ key: string; rate: number; div: number }> = [];
for (const r of rows.sort((a, b) => a.owner.localeCompare(b.owner) || a.hook.localeCompare(b.hook))) {
    const p = PRINTED[r.hook] ?? { os: `${r.owner} ${r.hook}`, text: '(not in PRINTED table)', kind: 'flat' as const };
    const t = r.t; const n = Math.max(1, r.fires);
    const pctSelf = (hp: number): number => 100 * hp / r.maxHp;
    const parts: string[] = []; const game: string[] = [];
    if (p.kind !== 'cost' && (t.ledgerRaw > 0 || t.dmgHp > 0)) { parts.push(`dmg raw ${f1(t.ledgerRaw / n)} HP (applied ${f1(t.dmgHp / n)}) = ${f2(pctSelf(t.ledgerRaw / n))}% frame`); game.push(`dmg raw ${f1(t.ledgerRaw / r.games)} HP`); }
    if (t.healHp > 0) { parts.push(`heal ${f1(t.healHp / n)} HP = ${f2(pctSelf(t.healHp / n))}% maxHp`); game.push(`heal ${f1(t.healHp / r.games)} HP`); }
    if (t.selfDmgHp > 0) { parts.push(`self -${f1(t.selfDmgHp / n)} HP = ${f2(pctSelf(t.selfDmgHp / n))}% maxHp`); game.push(`self -${f1(t.selfDmgHp / r.games)} HP`); }
    let grantPower = 0;
    for (const [s, v] of Object.entries(t.stacks)) if (v !== 0) { parts.push(`${s} ${v > 0 ? '+' : ''}${f2(v / n)}`); game.push(`${s} ${v > 0 ? '+' : ''}${f2(v / r.games)}`); const base = s.replace('enemy:', ''); const sign = s.startsWith('enemy:') ? (ENEMY_BUFF.has(base) ? -1 : 1) : 1; grantPower += sign * (STACK_POWER[base] ?? 20) * v; }
    if (t.energy) { parts.push(`energy ${f2(t.energy / n)}`); game.push(`energy ${f2(t.energy / r.games)}`); grantPower += 40 * t.energy; }
    if (t.maxEnergy) { parts.push(`maxEnergy ${f2(t.maxEnergy / n)}`); game.push(`maxEnergy ${f2(t.maxEnergy / r.games)}`); grantPower += 40 * t.maxEnergy; }
    if (t.hand) { parts.push(`cards ${f2(t.hand / n)}`); game.push(`cards ${f2(t.hand / r.games)}`); grantPower += 15 * t.hand; }
    if (t.modDelta !== 0) { parts.push(`mod ${t.modDelta > 0 ? '+' : ''}${f1(t.modDelta / n)} HP on ${f1(t.modIn / n)} (${f2(pctSelf(t.modDelta / n))}% frame; x${f2(1 + t.modDelta / Math.max(1, t.modIn))})`); game.push(`mod ${t.modDelta > 0 ? '+' : ''}${f1(t.modDelta / r.games)} HP`); }
    if (grantPower) game.push(`= ${f1(grantPower / r.games)} power-eq = ${f1(grantPower / r.games / 3)}% maxHp-eq`);
    let rate = '-', flag = '';
    if (p.power && (p.kind === 'dmg' || p.kind === 'heal')) {
        const hp = p.kind === 'dmg' ? t.ledgerRaw / n : t.healHp / n;
        const rt = pctSelf(hp) / p.power * 0.75;
        rate = f3(rt);
        const div = rt < 0.19 ? 0.19 / rt : rt > 0.30 ? rt / 0.30 : 1;
        if (div > 2) flag = `>2x off band (${f1(div)}x)`;
        flagged.push({ key: `${r.owner}:${r.hook}`, rate: rt, div });
        if (r.hook === 'valk_v2_rebirth') {
            const rh = pctSelf(t.healHp / n) / 15 * 0.75;
            rate += ` dmg / ${f3(rh)} heal`;
        }
    }
    if (p.kind === 'cost' && t.selfDmgHp > 0) rate = `${f2(pctSelf(t.selfDmgHp / n))}% maxHp per proc`;
    console.log(`| ${p.os} \`${r.hook}\` | ${p.text} | ${p.power ?? '-'} | ${f2(r.fires / r.games)} (${f2(r.offers / r.games)}) | ${parts.join('; ') || '(no measurable delta)'} | ${game.join('; ') || '-'} | ${rate} | ${flag} |`);
}
console.log('');
console.log(`n: games per deck are in the rows' owner files (40 per opponent x 30 opponents = 1200 at --iter 20; 600 at --iter 10). Frame = owner maxHp.`);
