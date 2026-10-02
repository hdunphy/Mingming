/**
 * The 61 sampled cues Henry picked, and what each one falls back to — ticket 147a.
 *
 * # TWO NAMESPACES, ONE UNION
 *
 * `sfxRecipes.ts` holds 21 SYNTHESIZED cues: pure functions that draw with oscillators and noise,
 * and which need no assets at all. `public/sfx/` holds 61 SAMPLED cues, picked by Henry over four
 * sampler rounds (147 §8) and, until this row, referenced by nothing in `src/` whatsoever.
 *
 * `SfxName` is the union of the two. A caller says what happened; whether the answer is an
 * `AudioBuffer` or an oscillator is the engine's business.
 *
 * # WHY A FALLBACK MAP AND NOT JUST SILENCE
 *
 * 147a: *"missing file \u2192 recipe fallback, never silence."* The samples load over the network
 * after the first battle starts, so the first fight of a session can easily resolve a cue before
 * its buffer exists — and on a slow connection, or a build where `public/sfx` did not ship, they
 * never do. Every sampled cue therefore names the synthesized cue that stands in for it, and the
 * game is fully audible with `public/sfx/` deleted.
 *
 * The exception is the sixteen species cries. There is no oscillator recipe for a wolf, and the
 * honest answer to "what does Fenrir sound like without the asset" is nothing at all — a `death`
 * fizzle standing in for a cry would be a worse lie than the silence. They map to `null`, which
 * this file states rather than leaves to be discovered.
 */

import type { RecipeName } from './sfxRecipes';

/**
 * Every cue in `public/sfx/manifest.json`, as a type.
 *
 * Hand-written on purpose rather than inferred from the JSON: a typed union is what makes
 * `playSfx('impactSupre')` a compile error. `sfxManifest.test.ts` asserts this list and the
 * manifest's keys are exactly equal, so the two cannot drift.
 */
export const SAMPLE_CUES = [
    'cardHover',
    'cardSelect',
    'cardFly',
    'cardDraw',
    'cardDiscard',
    'shuffle',
    'castFire',
    'castWater',
    'castNone',
    'impactFire',
    'impactWater',
    'impactNature',
    'buffUp',
    'debuffDown',
    'statusOff',
    'burnTick',
    'recoil',
    'daemonProc',
    'turnStart',
    'turnEnd',
    'energyGain',
    'gymIntro',
    'cry_fenrir',
    'cry_skoll',
    'cry_ratatoskr',
    'cry_kraken',
    'cry_huldra',
    'cry_sleipnir',
    'cry_gullinbursti',
    'cry_audhumbla',
    'cry_fafnir',
    'cry_nidhoggr',
    'cry_ymir',
    'impactSuper',
    'sharpRaise',
    'barkRaise',
    'cry_hel',
    'castNature',
    'impactNormal',
    'hitBig',
    'kill',
    'poisonTick',
    'absorbedNoDamage',
    'blockedByBark',
    'barkBreak',
    'os_fenrir_CINDER_WALL',
    'os_skoll_TREACHERY_KERNEL',
    'os_ratatoskr_INSTIGATOR',
    'os_kraken_ABYSSAL_INK',
    'os_kraken_TIDAL_CRUSH',
    'os_jormungandr_OUROBOROS',
    'os_jormungandr_TOXIN_FANG',
    'os_huldra_ALLURE_PROXY',
    'os_huldra_BARK_SHIELD',
    'cry_jormungandr',
    'cry_hraesvelgr',
    'cry_draugr',
    'cry_valkyrie',
    'os_fenrir_UNBOUND_KERNEL',
    'os_skoll_SOLAR_OVERDRIVE',
    'os_ratatoskr_GOSSIP_NODE',
] as const;

export type SampleCue = (typeof SAMPLE_CUES)[number];

const SAMPLE_CUE_SET: ReadonlySet<string> = new Set(SAMPLE_CUES);

/** Is this name one of the sampled cues? Narrows, so callers can branch on it. */
export function isSampleCue(name: string): name is SampleCue {
    return SAMPLE_CUE_SET.has(name);
}

/**
 * What plays when a sampled cue's buffer is not (yet) there.
 *
 * `null` means nothing plays — see the header. Everything else names a recipe from
 * `sfxRecipes.ts`, chosen by FAMILY rather than by fidelity: an impact falls back to `hit`, a
 * super-effective impact to `hitCrit`, every OS tell to `breach`, every status moment to
 * `statusApply`. The point is that the EVENT still reads, not that it sounds the same.
 */
export const SAMPLE_FALLBACK: Readonly<Record<SampleCue, RecipeName | null>> = {
    cardHover: 'uiClick',
    cardSelect: 'uiClick',
    cardFly: 'cardPlay',
    cardDraw: 'cardDraw',
    cardDiscard: 'cardPlay',
    shuffle: 'cardDraw',
    castFire: 'cardPlay',
    castWater: 'cardPlay',
    castNone: 'cardPlay',
    impactFire: 'hit',
    impactWater: 'hit',
    impactNature: 'hit',
    buffUp: 'statusApply',
    debuffDown: 'statusApply',
    statusOff: 'statusApply',
    burnTick: 'statusApply',
    recoil: 'hit',
    daemonProc: 'breach',
    turnStart: 'turnPlayer',
    turnEnd: 'turnEnemy',
    energyGain: 'rewardClaim',
    gymIntro: 'breach',
    cry_fenrir: null,
    cry_skoll: null,
    cry_ratatoskr: null,
    cry_kraken: null,
    cry_huldra: null,
    cry_sleipnir: null,
    cry_gullinbursti: null,
    cry_audhumbla: null,
    cry_fafnir: null,
    cry_nidhoggr: null,
    cry_ymir: null,
    impactSuper: 'hitCrit',
    sharpRaise: 'statusApply',
    barkRaise: 'statusApply',
    cry_hel: null,
    castNature: 'cardPlay',
    impactNormal: 'hit',
    hitBig: 'hitCrit',
    kill: 'death',
    poisonTick: 'statusApply',
    absorbedNoDamage: 'absorbed',
    blockedByBark: 'absorbed',
    barkBreak: 'hit',
    os_fenrir_CINDER_WALL: 'breach',
    os_skoll_TREACHERY_KERNEL: 'breach',
    os_ratatoskr_INSTIGATOR: 'breach',
    os_kraken_ABYSSAL_INK: 'breach',
    os_kraken_TIDAL_CRUSH: 'breach',
    os_jormungandr_OUROBOROS: 'breach',
    os_jormungandr_TOXIN_FANG: 'breach',
    os_huldra_ALLURE_PROXY: 'breach',
    os_huldra_BARK_SHIELD: 'breach',
    cry_jormungandr: null,
    cry_hraesvelgr: null,
    cry_draugr: null,
    cry_valkyrie: null,
    os_fenrir_UNBOUND_KERNEL: 'breach',
    os_skoll_SOLAR_OVERDRIVE: 'breach',
    os_ratatoskr_GOSSIP_NODE: 'breach',
};
