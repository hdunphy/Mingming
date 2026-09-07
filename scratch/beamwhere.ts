/** Ticket 144 §2 amended — prove, from inside a lane, which searches are beamed. */
import { ENEMY_LADDER, OPENING_FIGHT_LOADOUT } from '../src/engine/run/encounter';
import { resolveBeam, GAME_BEAM_WIDTH } from '../src/engine/ai/TacticalAI';
const env = (globalThis as unknown as { process?: { env?: Record<string, string> } }).process?.env ?? {};
console.log('HARNESS (this lane) default beam :', resolveBeam(true, env.AI_BEAM), '  <- 0 = beamless');
console.log('game wild / elite               :', ENEMY_LADDER.wild.beam, '/', ENEMY_LADDER.elite.beam);
console.log('game GYM (gauntlet)             :', ENEMY_LADDER.gauntlet.beam, '  <- 0 = beamless');
console.log('game opening fight              :', OPENING_FIGHT_LOADOUT.beam);
console.log('GAME_BEAM_WIDTH                 :', GAME_BEAM_WIDTH);
