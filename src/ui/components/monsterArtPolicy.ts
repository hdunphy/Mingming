/**
 * MONSTER ART POLICY — one switch, one question: may a Mingming's artwork be drawn?
 *
 * Henry does not want the current (AI-generated) monster art shown in the game or in anything
 * captured from it, so this is `false` and every place that would draw a sprite draws a
 * `MonsterArtPlaceholder` instead. The art files and every species' `artReference` are untouched,
 * so the day real art lands the whole change is flipping this one constant.
 */
export const MONSTER_ART_ENABLED = false;
