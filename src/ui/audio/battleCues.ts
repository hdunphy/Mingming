/**
 * Which sound a battle event makes — ticket 147d.
 *
 * # WHY THIS IS A PURE MODULE AND NOT A PILE OF `playSfx` CALLS
 *
 * 147d is thirty-odd rules ("a fully absorbed hit is `absorbedNoDamage`, one that got through the
 * bark is `barkBreak`, a status tick is never an impact"), and every one of them is a judgement
 * that can be wrong in a way no screenshot shows. Kept as functions of their inputs, they can be
 * read at a glance and checked without an AudioContext — the same argument `limiters.ts` makes for
 * the mixing numbers.
 *
 * The hook stays a switch that asks this what to play.
 *
 * # WHERE THE WIRING LIVES, AND WHERE IT DELIBERATELY DOES NOT
 *
 * All of it hangs off `useBattleVfx`, which subscribes to `globalBattleEventBus` once for the
 * life of the app. Not `useCastSequence`, even though that hook already computes element and
 * effectiveness for the visual trail: its effect returns early unless `gates.vfx === 'full'`, so
 * a cue hung there would be silenced by the EFFECTS switch — and 147b is explicit that the 146
 * `vfx` switch does not mute. Sound has its own switch, and it must be the only one that governs
 * it.
 */

import { ElementalMatrix } from '../../engine/combatUtils';
import type { DamageCause, StatusSource } from '../../engine/events';
import type { Element, IBattleEntity, ProgramData, StatusType } from '../../engine/types';
import { isSampleCue } from './sfxSamples';
import type { SfxName } from './sfxRecipes';

/**
 * Above this elemental multiplier a hit is super-effective.
 *
 * The same 1.2 `useCastSequence` uses for the visual read, so the flash and the sound agree about
 * the same hit. Henry's 147 §8 ruling: **normal / super-effective only** — the game has no "not
 * very effective" sound, because it has no resisted read to pair one with.
 */
export const SUPER_EFFECTIVE_AT = 1.2;

/** At or past this share of the target's max HP, the hit gets the sub-thump layered under it. */
export const HIT_BIG_FRACTION = 0.35;

/** The three elements with an impact sample of their own. */
const ELEMENT_IMPACT: Partial<Record<Element, SfxName>> = {
    Fire: 'impactFire',
    Water: 'impactWater',
    Nature: 'impactNature',
};

/** The cast cue per element — everything outside the three is the plain whoosh. */
export function castCue(element: Element | undefined): SfxName {
    switch (element) {
        case 'Fire': return 'castFire';
        case 'Water': return 'castWater';
        case 'Nature': return 'castNature';
        default: return 'castNone';
    }
}

/**
 * The cast cue of one card (194l). A Heal or a Skill is not an attack, so it does not play its
 * element's attack whoosh (War Pact is a Fire Skill, and Henry heard `castFire` over a heal); it plays
 * the support cast. Everything else is `castCue` of its element.
 */
export function castCueFor(card: Pick<ProgramData, 'category' | 'element'> | undefined): SfxName {
    if (card && (card.category === 'Heal' || card.category === 'Skill')) return 'castSupport';
    return castCue(card?.element);
}

/**
 * The elemental multiplier of this hit against this target.
 *
 * Only the matrix, deliberately: STAB is the ATTACKER's business and 147 §8 rules that it is not a
 * sound at all — it shows up as damage size, through `hitBig` and pitch-by-magnitude. So this
 * needs the target and the element and not the caster, which is exactly what a `DAMAGE_TAKEN`
 * event carries.
 */
export function effectivenessAgainst(element: Element | undefined, target: IBattleEntity | undefined): number {
    if (!element || element === 'None' || !target) return 1;
    const primary = ElementalMatrix[element]?.[target.primaryElement] ?? 1;
    const secondary = target.secondaryElement && target.secondaryElement !== 'None'
        ? ElementalMatrix[element]?.[target.secondaryElement] ?? 1
        : 1;
    return primary * secondary;
}

/**
 * The impact ladder — 147 §8.
 *
 * Super-effective always wins: `impactSuper` regardless of element, because the *result* is what
 * the player needs off that hit and it must sound the same whoever threw it (the Pokémon model in
 * 147 §1). An ordinary hit takes its element's impact where one exists, and `impactNormal`
 * otherwise. Henry's note on the ruling: *"Henry can flip that rule after hearing it"* — flipping
 * it means deleting the `ELEMENT_IMPACT` lookup below and nothing else.
 */
export function impactCue(element: Element | undefined, effectiveness: number): SfxName {
    if (effectiveness >= SUPER_EFFECTIVE_AT) return 'impactSuper';
    return (element && ELEMENT_IMPACT[element]) ?? 'impactNormal';
}

/** What a shield did to this hit — three distinct moments, 147 §8. */
export function shieldCue(absorbed: number, throughToHp: number): SfxName | null {
    if (absorbed <= 0) return throughToHp <= 0 ? 'absorbedNoDamage' : null;
    // Something was absorbed AND something still landed: the bark did not hold.
    return throughToHp > 0 ? 'barkBreak' : 'blockedByBark';
}

/**
 * A status tick — and never an impact, which is the whole point of the rule.
 *
 * 147 §4: *"wet drip / soft crackle — **never the impact sound**"*. A player has to be able to
 * tell "I am being hurt by the board" from "I am being hit", with their eyes elsewhere.
 */
export function tickCue(status: StatusType | undefined): SfxName {
    return status === 'Burn' ? 'burnTick' : 'poisonTick';
}

/** Damage that is nobody's attack: a toll paid, a recoil taken. */
export function causeCue(cause: DamageCause | undefined): SfxName | null {
    return cause === 'recoil' || cause === 'toll' ? 'recoil' : null;
}

/**
 * Applying a status — the STS `BUFF_1..3` model: a family, not thirty sounds.
 *
 * Two of them earn their own cue because they are not information about a unit, they are a new
 * WALL in front of it, and the player is about to make targeting decisions on that basis.
 */
const GOOD_STATUSES: ReadonlySet<string> = new Set([
    'Strengthened', 'Sharp', 'Regen', 'Energized', 'StableOS', 'BarkShield', 'DarkStance', 'LightStance',
]);

export function statusCue(status: StatusType): SfxName {
    if (status === 'Sharp') return 'sharpRaise';
    if (status === 'BarkShield') return 'barkRaise';
    return GOOD_STATUSES.has(status) ? 'buffUp' : 'debuffDown';
}

/**
 * A species' cry, if we have one.
 *
 * Sixteen exist (147 §8: *"yes, all sixteen"*); a definitionId with no file — the control dummy,
 * anything added since the pack was cut — gets nothing rather than somebody else's voice.
 */
export function cryCue(definitionId: string | undefined): SfxName | null {
    if (!definitionId) return null;
    const cue = `cry_${definitionId}`;
    return isSampleCue(cue) ? cue : null;
}

/**
 * The firmware tell — one cue per Early Access OS, the family blip for everything else.
 *
 * 147 §8: *"one per Early Access OS, named `os_<species>_<OS>`; every other OS uses the family
 * default with `daemonProc` as the placeholder blip."* The owner's species is needed because the
 * cue names both, and an OS id alone does not say whose body it is running on.
 */
export function hookCue(owner: IBattleEntity | undefined, osId?: string, daemonId?: string): SfxName {
    if (osId && owner?.definitionId) {
        const cue = `os_${owner.definitionId}_${osId}`;
        if (isSampleCue(cue)) return cue;
    }
    // A daemon, an un-sampled OS, or a hook on a body the pack never covered.
    void daemonId;
    return 'daemonProc';
}

/** Whose side this entity is on, for the cues that differ by it. */
export function isPlayerSide(state: { playerParty: ReadonlyArray<IBattleEntity> } | null, id: string): boolean {
    return !!state?.playerParty.some((entity) => entity.id === id);
}

/** A status applied by the engine itself rather than by a card, for callers that care. */
export function fromCard(source: StatusSource | undefined): boolean {
    return source?.kind === 'card';
}
