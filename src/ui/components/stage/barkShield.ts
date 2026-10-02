/**
 * BARK SHIELD, IN HP POINTS — ticket 183b. Henry (2026-10-02, Rootfall playtest): the shield is a
 * brown band over the health bar, not a status icon. A Bark Shield's stacks are a percent of the
 * body's max HP (`StatusBehaviors.ts`), so the band's size in HP is `floor(stacks x maxHp / 100)`.
 */
import type { IBattleEntity } from '../../../engine/types';

export function barkShieldPoints(entity: Pick<IBattleEntity, 'statusEffects' | 'maxHp'>): number {
    const stacks = entity.statusEffects
        .filter((status) => status.type === 'BarkShield')
        .reduce((sum, status) => sum + status.stacks, 0);
    return stacks > 0 ? Math.floor((stacks * entity.maxHp) / 100) : 0;
}
