import { SeedStream } from '../core/SeedStream';
import { BATTLE_MACRO_IDS } from '../data/macroRegistry';

/** How many macros a macro reward offers. The player takes one or none. */
export const MACRO_REWARD_CHOICES = 3;

/** Three different battle macros, deterministic in the fight's seed. Its own fork, so it cannot shift any other reward roll. */
export function rollMacroChoices(seed: string): string[] {
    const stream = new SeedStream(new SeedStream(seed).fork('reward-macros'));
    return stream.shuffle(BATTLE_MACRO_IDS).slice(0, MACRO_REWARD_CHOICES);
}
