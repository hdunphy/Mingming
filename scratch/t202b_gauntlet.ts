/**
 * TICKET 202b — what does a revive between gauntlet fights do to the walker's gauntlet win rate?
 *
 * For each seed i the walker walks to the gym (a lost fight on the way is carried on as a win, so every
 * seed reaches the gate: ticket 170a's ghost walk) with a starter whose element beats the gym, then
 * plays the three gauntlet fights from that gate with HP carried between them, exactly as the game
 * does. The walk to the gate costs minutes and does not touch the gauntlet rule, so it runs ONCE and
 * leaves the gate on disk; the gauntlet is then played from the same gate on the parent commit and on
 * 202b. That makes the two arms paired seed for seed by construction. One JSON line per seed.
 *
 *   1. walk (either tree):  npx vite-node scratch/t202b_gauntlet.ts -- --mode walk --gym gym_rootfall --from 0 --to 60 --dir gates
 *   2. play (each tree):    npx vite-node scratch/t202b_gauntlet.ts -- --mode play --gym gym_rootfall --from 0 --to 60 --dir gates --out rootfall-arm.jsonl
 *
 * Starters, by 195k's rule (the gym the starter's element beats): Rootfall is played by the Fire
 * starters and Emberfall by the Water starters, four instincts each, taken in turn by seed.
 */
import fs from 'node:fs';
import path from 'node:path';

import { playGauntlet, walkToGym, type GymSnapshot } from '../src/debug/balance/ghostWalk';
import { gymFor } from '../src/debug/playtest/night/gymFor';
import { offerGyms } from '../src/engine/run/gyms';
import { gymOfferSeed } from '../src/debug/playtest/gymOfferSeed';

const STARTERS: Record<string, ReadonlyArray<string>> = {
    gym_rootfall: ['fenrir_v1', 'fenrir_v2', 'skoll_v1', 'skoll_v2'],
    gym_emberfall: ['kraken_v1', 'kraken_v2', 'jormungandr_v1', 'jormungandr_v2'],
};

const args = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
    const at = args.indexOf(name);
    return at >= 0 && args[at + 1] !== undefined ? args[at + 1] : fallback;
};
const mode = flag('--mode', 'play');
const gymId = flag('--gym', 'gym_rootfall');
const from = Number(flag('--from', '0'));
const to = Number(flag('--to', '60'));
const dir = flag('--dir', 'gates');
const out = flag('--out', '');
const starters = STARTERS[gymId];
if (!starters) throw new Error(`unknown gym ${gymId}`);
fs.mkdirSync(dir, { recursive: true });

for (let i = from; i < to; i += 1) {
    const starter = starters[i % starters.length];
    const seed = `t202b:${gymId}:${i}`;
    const gymIndex = gymFor(seed, starter);
    const offered = offerGyms(gymOfferSeed(seed))[gymIndex].gym.id;
    if (offered !== gymId) throw new Error(`${seed}: ${starter} would play ${offered}, not ${gymId}`);
    const file = path.join(dir, `${gymId}-${i}.json`);
    const started = Date.now();

    if (mode === 'walk') {
        if (fs.existsSync(file)) continue;
        const snapshot = walkToGym({ seed, starter, gymIndex });
        fs.writeFileSync(file, JSON.stringify(snapshot));
        console.error(`${seed} ${starter} ${snapshot ? 'gate' : 'no gate'} ${((Date.now() - started) / 1000).toFixed(0)}s`);
        continue;
    }

    const snapshot = JSON.parse(fs.readFileSync(file, 'utf8')) as GymSnapshot | null;
    const row = snapshot
        ? (() => {
            const result = playGauntlet(snapshot, 0);
            return {
                gymId, starter, seed, reached: true, cleared: result.cleared, fightsWon: result.fightsWon,
                fights: result.fights.map((f) => ({ won: f.won, turns: f.turns, hp: f.hp.map((h) => Number(h.hpFraction.toFixed(3))) })),
            };
        })()
        : { gymId, starter, seed, reached: false, cleared: false, fightsWon: 0, fights: [] };
    if (out) fs.appendFileSync(out, `${JSON.stringify(row)}\n`);
    console.error(`${seed} ${starter} ${row.reached ? `${row.fightsWon}/3` : 'no gate'} ${((Date.now() - started) / 1000).toFixed(0)}s`);
}
