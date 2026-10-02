/**
 * TICKET 162c — 160 §5's numbers on collection v2, the ones that are counts rather than battles.
 *
 * §5 lists five measurements as the gate for "did the pool drift enough". Three of them are
 * properties of the DATA and need no simulation at all, so they are here rather than in a batch:
 *
 *  - **Duplicate count** — cards appearing in more than one EA kit. §5's own before-list is
 *    "Ink Stream ×2 decks, Tackle ×8, Echo Chamber ×2, Nettle Sting ×2, Battle Rhythm ×2", and
 *    the gate is that it goes DOWN.
 *  - **Live-pair rate's precondition** — every kit holding a cross-body enabler→payoff pair needs
 *    each kit to have both halves. The rate itself needs the 78 tags (not shipped); what IS
 *    checkable now is the shape 158 §2 rules: 2 enablers + 1 consume + 1 scalar + 1 glue.
 *  - **Currency spread** — how many OS own each currency, which is 162 §3's census re-derived
 *    from the registry rather than from the design doc, so the two cannot drift.
 *
 * Run: npx vite-node scratch/t162c_shape.ts
 */
import fs from 'node:fs';
import { MingmingRegistry, LAUNCH_SPECIES, getDeckForOS } from '../src/engine/data/mingmingRegistry';
import { SPECIES_CARD_POOLS } from '../src/engine/data/speciesPools';
import { GetProgramData } from '../src/engine/data/programRegistry';
import type { ProgramData } from '../src/engine/types';

const OS_IDS: string[] = [];
for (const species of LAUNCH_SPECIES) {
    for (const os of MingmingRegistry[species]?.availableOS ?? []) OS_IDS.push(os);
}
const speciesOf = (os: string) => LAUNCH_SPECIES.find((s) => (MingmingRegistry[s]?.availableOS ?? []).includes(os))!;
const kitOf = (os: string) => getDeckForOS(speciesOf(os), os);

// ── duplicates ────────────────────────────────────────────────────────────────────────────────
const inKits = new Map<string, string[]>();
for (const os of OS_IDS) {
    for (const id of new Set(kitOf(os))) inKits.set(id, [...(inKits.get(id) ?? []), os]);
}
const dupes = [...inKits.entries()].filter(([, os]) => os.length > 1).sort((a, b) => b[1].length - a[1].length);
console.log(`## Duplicate count — cards in more than one EA kit\n`);
for (const [id, os] of dupes) console.log(`  ${id.padEnd(17)} ×${os.length}   ${os.join(' ')}`);
const slots = dupes.reduce((n, [, o]) => n + o.length, 0);

/*
 * BEFORE, read from the archive rather than from §5's prose. §5 lists the v1 duplicates from
 * memory and gets them slightly wrong (`tackle ×8`; the blob says `water_slap ×7`), which is the
 * whole reason this reads the committed file instead of the sentence.
 */
const v1 = JSON.parse(fs.readFileSync('src/engine/data/archive/ea-kits-v1.json', 'utf8')) as
    Record<string, { decks: Record<string, string[]> }>;
const beforeMap = new Map<string, string[]>();
for (const entry of Object.values(v1)) {
    for (const [os, deck] of Object.entries(entry.decks)) {
        for (const id of new Set(deck)) beforeMap.set(id, [...(beforeMap.get(id) ?? []), os]);
    }
}
const beforeDupes = [...beforeMap.entries()].filter(([, os]) => os.length > 1);
const beforeSlots = beforeDupes.reduce((n, [, o]) => n + o.length, 0);

const isGlueId = (id: string) => ['forage', 'tackle', 'water_slap', 'soothe'].includes(id);
const split = (rows: Array<[string, string[]]>) => {
    const glue = rows.filter(([id]) => isGlueId(id));
    const rest = rows.filter(([id]) => !isGlueId(id));
    return [glue.reduce((n, [, o]) => n + o.length, 0), rest.reduce((n, [, o]) => n + o.length, 0)];
};
const [bg, br] = split(beforeDupes);
const [ag, ar] = split(dupes);

console.log(`\n  BEFORE (archive/ea-kits-v1.json): ${beforeDupes.length} cards, ${beforeSlots} kit slots  (glue ${bg}, other ${br})`);
console.log(`  AFTER  (collection v2):           ${dupes.length} cards, ${slots} kit slots  (glue ${ag}, other ${ar})`);
console.log(`  160 §5's gate is "duplicate count DOWN". It is ${slots < beforeSlots ? 'MET' : 'NOT MET'}.\n`);

// ── kit shape (158 §2) ────────────────────────────────────────────────────────────────────────
const isConsume = (d: ProgramData) => (d.actions ?? []).some((a) => a.type === 'STATUS' && a.consume === true);
const isScalar = (d: ProgramData) => (d.actions ?? []).some((a) => typeof a.scaling === 'string');
const isGlue = (d: ProgramData) => d.element === 'None' || (d.actions ?? []).some((a) => a.type === 'DRAW');

console.log(`## Kit shape — 158 §2: two enablers, a consume, a scalar, a glue\n`);
let missingConsume = 0;
let missingScalar = 0;
let missingGlue = 0;
for (const os of OS_IDS) {
    const kit = [...new Set(kitOf(os))].map(GetProgramData);
    const pool = (SPECIES_CARD_POOLS[os] ?? []).map(GetProgramData);
    const both = [...kit, ...pool];
    const c = kit.some(isConsume);
    const sc = kit.some(isScalar);
    const g = kit.some(isGlue);
    if (!c) missingConsume++;
    if (!sc) missingScalar++;
    if (!g) missingGlue++;
    const cp = both.some(isConsume);
    console.log(`  ${os.padEnd(16)} consume ${c ? 'kit' : cp ? 'POOL' : '—  '}   scalar ${sc ? 'yes' : 'NO '}   glue ${g ? 'yes' : 'NO '}`);
}
console.log(`\n  kits with no consume of their own: ${missingConsume}/12  (161 §2 puts it in the run, so POOL is the design)`);
console.log(`  kits with no scalar: ${missingScalar}/12    kits with no glue: ${missingGlue}/12\n`);

// ── currency census (162 §3) ──────────────────────────────────────────────────────────────────
const CURRENCIES = ['Strengthened', 'Burn', 'Sharp', 'BarkShield', 'Dazed', 'Weakened', 'Poison', 'Energized'];
console.log(`## Currency census — how many OS make or read each, from the registry\n`);
for (const cur of CURRENCIES) {
    const owners = OS_IDS.filter((os) => {
        const cards = [...new Set(kitOf(os))].map(GetProgramData);
        return cards.some((d) => (d.actions ?? []).some((a) =>
            (a.type === 'STATUS' && a.status === cur)
            || (typeof a.scaling === 'string' && a.scaling.includes(cur.toUpperCase().replace('STRENGTHENED', 'STRENGTH').replace('BARKSHIELD', 'BARKSHIELD')))
            || a.scalingStatus === cur));
    });
    console.log(`  ${cur.padEnd(14)} ${String(owners.length).padStart(2)} OS   ${owners.join(' ')}`);
}
