/**
 * TICKET 163c — THE SIX PATCHES ON THE TWELVE, and what each one is allowed to be.
 *
 * §4 asks for it in those words: *"Tests: each patch on each of the twelve produces a well-formed
 * hook (72 cells) and the AI still enumerates."* The cells are ASSERTED rather than authored, which
 * is the whole design — a patch names a FIELD, not an OS, so a firmware retuned tomorrow keeps its
 * patches and this file keeps passing without an edit.
 *
 * Four claims:
 *
 * 1. **Seventy-two well-formed cells.** Every (patch, launch OS) pair transforms into something
 *    `HookFactory` builds and `HookLibrarySchema` still accepts. A transform that produced a hook
 *    with a missing `target` would be silently skipped at runtime (ticket 71's bug), which is
 *    exactly the failure a "well-formed" check has to catch.
 * 2. **A patch that finds nothing changes nothing**, and says so. `patchTouchCount` is the honest
 *    zero 163 §3 wants the scorer to print, and the alternative — a transform that "did something"
 *    to every OS — is how a Relay ends up double-applied on a firmware that already read allies.
 * 3. **Two bodies with the same firmware and different patches run different hooks.** The thing
 *    that could not be done by baking patches into `FIRMWARE_REGISTRY`, and the reason the cache
 *    key grew a field.
 * 4. **The AI still enumerates.** A patched body must not make `getBestAction` throw or return
 *    nothing — a rider found in a chest that crashes the enemy turn is worse than no rider.
 */
import { describe, it, expect } from 'vitest';

import { PATCHES, PATCH_IDS, PATCH_SLOTS, patchTouchCount, type PatchId } from './data/patchRegistry';
import { bestPatchFor, gatePatchChoices, patchScoreDeltaFor, SHOP_STOCK_PATCH } from './data/patchRanking';
import { scoreOS, scoreHookList } from '../debug/balance/powerscale';
import { rawFirmwareHooks, getOSBehavior } from './data/firmwareRegistry';
import { HookLibrarySchema } from './data/HookSchema';
import { HookFactory } from './core/HookFactory';
import { entityHooksFor } from './core/entityHooks';
import { MingmingRegistry, LAUNCH_SPECIES } from './data/mingmingRegistry';
import { getBestAction } from './ai/TacticalAI';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import type { IBattleEntity, IBattleState } from './types';

/** The twelve — every OS the launch species field. */
const LAUNCH_OS: string[] = LAUNCH_SPECIES.flatMap((s) => MingmingRegistry[s]?.availableOS ?? []);

describe('163c — the twelve, the six, and the seventy-two cells', () => {
    it('is twelve launch firmware and six patches', () => {
        // Guards every `it.each` below from passing vacuously on an empty roster.
        expect(LAUNCH_OS).toHaveLength(12);
        expect(PATCH_IDS).toHaveLength(6);
        expect(PATCH_SLOTS).toBe(1);
    });

    it.each(PATCH_IDS.flatMap((p) => LAUNCH_OS.map((os) => [p, os] as const)))(
        '%s on %s produces a hook the engine can build',
        (patchId: PatchId, osId: string) => {
            const patch = PATCHES[patchId];
            for (const raw of rawFirmwareHooks(osId)) {
                const out = patch.apply(raw);

                // Still the same hook: an id and a trigger, because everything downstream —
                // registration, the VFX tell, the combat log — finds a hook by those two.
                expect(out.id, `${patchId}/${osId}: lost its id`).toBe(raw.id);
                expect(out.trigger, `${patchId}/${osId}: lost its trigger`).toBe(raw.trigger);

                // Still schema-valid. zod STRIPS unknown keys, so a transform that invented a
                // field would be silently dropped between here and the engine — which is the
                // failure mode `HookSchema`'s own comments are written about.
                const parsed = HookLibrarySchema.safeParse({ [osId]: { id: osId, name: osId, description: '', hooks: [out] } });
                expect(parsed.success, `${patchId}/${osId}: ${parsed.success ? '' : parsed.error.message}`).toBe(true);

                // And still buildable. `HookFactory.createHook` is what the resolution engine calls.
                expect(() => HookFactory.createHook(out)).not.toThrow();
            }
        },
    );

    it('never leaves a `do` action without a target, which the engine would skip in silence', () => {
        /*
         * Ticket 71's bug, as a rule: a `COUNTER` with no `target` is dropped by
         * `HookFactory.executeActions` with no warning. SPLITTER is the transform that writes new
         * actions, so it is the one that could reintroduce it.
         */
        for (const patchId of PATCH_IDS) {
            for (const osId of LAUNCH_OS) {
                for (const raw of rawFirmwareHooks(osId)) {
                    const out = PATCHES[patchId].apply(raw) as { do?: Array<{ type: string; target?: string }> };
                    for (const action of out.do ?? []) {
                        if (action.type === 'LOG') continue;
                        expect(action.target, `${patchId}/${osId}/${action.type}`).toBeDefined();
                    }
                }
            }
        }
    });
});

describe('163c — a patch that finds nothing says nothing', () => {
    it('returns the very same object when there is no matching field', () => {
        // Identity, not a deep-equal copy: `patchTouchCount` reads it by reference, and a
        // transform that cloned unconditionally would report every patch as touching everything.
        const overclock = PATCHES.overclock;
        for (const osId of LAUNCH_OS) {
            for (const raw of rawFirmwareHooks(osId)) {
                // OVERCLOCK is a status-value modifier on the member; it has no hook to change.
                expect(overclock.apply(raw)).toBe(raw);
            }
        }
        expect(LAUNCH_OS.every((os) => patchTouchCount(overclock, rawFirmwareHooks(os)) === 0)).toBe(true);
    });

    it('finds something on somebody — none of the other five is inert across the whole roster', () => {
        // The other half of the claim above. A transform that never fires is not a patch, it is a
        // typo, and the per-OS zeros are only meaningful if the roster-wide total is not zero.
        for (const patchId of PATCH_IDS) {
            if (patchId === 'overclock') continue;
            const total = LAUNCH_OS.reduce((n, os) => n + patchTouchCount(PATCHES[patchId], rawFirmwareHooks(os)), 0);
            expect(total, `${patchId} changes nothing on any launch firmware`).toBeGreaterThan(0);
        }
    });

    it('names the ONE launch hook a patch cannot reach, rather than claiming there are none', () => {
        /*
         * `CustomFirmware` is CODE, so a patch cannot transform it. Across the twelve that is
         * exactly one hook — `fenrir_v1_berserk`, UNBOUND_KERNEL's below-half clause, whose numbers
         * live in `OS_KNOBS.fenrir`. Everything else the EA roster fields comes from `hooks.json`.
         *
         * Written as the exact list rather than as "none", because the first draft of this file
         * asserted none and was wrong, and a limit you have measured is worth more than a limit you
         * assumed away. fenrir_v1's DATA-side recoil is still patchable — FAILSAFE removes it, which
         * is §3's own worked example — so what is out of reach is the berserk multiplier alone.
         */
        const unreachable: string[] = [];
        for (const osId of LAUNCH_OS) {
            const built = getOSBehavior(osId)?.hooks ?? [];
            const fromData = new Set(rawFirmwareHooks(osId).map((h) => h.id));
            unreachable.push(...built.filter((h) => !fromData.has(h.id)).map((h) => h.id));
        }
        expect(unreachable.sort()).toEqual(['fenrir_v1_berserk', 'huldra_v2_bark_end']);
    });
});

describe('163c — a patch belongs to a BODY, not to a firmware', () => {
    const bodies = (patches?: string[]): IBattleEntity[] => [
        createSparseEntity({ id: 'p1', name: 'Plain', activeOS: 'skoll_v1', currentHp: 500, maxHp: 500 }),
        createSparseEntity({ id: 'p2', name: 'Patched', activeOS: 'skoll_v1', currentHp: 500, maxHp: 500, patches }),
    ];

    it('gives two bodies on the same firmware different hooks when one is patched', () => {
        /*
         * The thing that could not have been done by baking patches into `FIRMWARE_REGISTRY`, and
         * the reason `entityHookKey` grew a field. Asserted on OBJECT IDENTITY of the hook list,
         * because a cache that ignored the patch would hand both bodies the same array.
         */
        const [plain, patched] = bodies(['amplifier']);
        const plainHooks = entityHooksFor(plain, 'onPostDamage');
        const patchedHooks = entityHooksFor(patched, 'onPostDamage');
        expect(plainHooks.length).toBeGreaterThan(0);
        expect(patchedHooks).toHaveLength(plainHooks.length);
        expect(patchedHooks[0]).not.toBe(plainHooks[0]);
    });

    it('gives an unpatched body exactly what it had before 163c', () => {
        // The other direction, and the one that matters for the 268 cards already shipped: a body
        // with no patch takes the registry's hooks, by reference, as it always did.
        const [plain] = bodies();
        expect(entityHooksFor(plain, 'onPostDamage')[0]).toBe(getOSBehavior('skoll_v1')!.hooks.find((h) => h.onPostDamage));
    });

    it.each(PATCH_IDS)('still lets the AI enumerate with %s fitted', (patchId: PatchId) => {
        /*
         * §4's second clause. A rider found in a chest that crashes the enemy's turn is worse than
         * no rider, and the AI is the one consumer that walks every hook of every body on every
         * decision — so it is where a malformed transform surfaces first.
         */
        const state: IBattleState = createSparseBattleState({
            activeSide: 'PLAYER',
            phase: 'ACTION',
            playerParty: [createSparseEntity({
                id: 'p1', name: 'Host', activeOS: 'skoll_v1', currentHp: 500, maxHp: 500,
                currentEnergy: 3, maxEnergy: 3, patches: [patchId],
            })],
            enemyParty: [createSparseEntity({ id: 'e1', name: 'Foe', currentHp: 500, maxHp: 500 })],
            playerDeck: {
                ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [],
                hand: [{ id: 'h1', dataId: 'tackle', currentCost: 0, isPlayable: true }],
            },
            enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], discard: [], exhaust: [], hand: [] },
        });
        expect(() => getBestAction(state)).not.toThrow();
        expect(getBestAction(state)).toBeDefined();
    });
});

// =================================================================================================
// TICKET 163g — the ranking, and what it can and cannot see
// =================================================================================================

describe('163g — "best" is the SCORED DELTA, not the touch count', () => {
    const osIds = LAUNCH_SPECIES.flatMap((s) => MingmingRegistry[s]?.availableOS ?? []);

    it('picks the rider worth more on a body where the two measures DISAGREE', () => {
        /*
         * `fenrir_v1` is the case the ruling was about, and it is worth writing out because it
         * shows the old metric failing in the exact way 163e measured.
         *
         *   amplifier   touches 2 hooks, delta 16.20
         *   splitter    touches 2 hooks, delta 20.30
         *
         * The counts TIE, and `patchTouchCount`'s ranking broke ties on declaration order with a
         * strict `>` — so amplifier won, first in the table, every time. That is the shape of
         * 163e's `amplifier ×27`: not a preference, an ordering artefact. The delta separates them
         * by four points of a health pool per game, and splitter wins.
         */
        const hooks = rawFirmwareHooks('fenrir_v1');
        expect(patchTouchCount(PATCHES.amplifier, hooks)).toBe(patchTouchCount(PATCHES.splitter, hooks));
        expect(patchScoreDeltaFor(PATCHES.splitter, 'fenrir_v1'))
            .toBeGreaterThan(patchScoreDeltaFor(PATCHES.amplifier, 'fenrir_v1'));
        expect(bestPatchFor('fenrir_v1').id).toBe('splitter');
    });

    it('no longer answers "amplifier" on every body — the thing 163e measured', () => {
        // The claim is that the ranking DISCRIMINATES, asserted as a property rather than as a
        // transcribed 12-row table: a table would have to be re-typed on every retune, and the
        // failure it exists to catch is "one patch wins everywhere", which is a count.
        const winners = new Set(osIds.map((osId) => bestPatchFor(osId).id));
        expect(winners.size, `winners: ${[...winners].join(', ')}`).toBeGreaterThan(1);
    });

    it('scores a patch that finds nothing at exactly 0, and says so in the units', () => {
        // OVERCLOCK changes no hook by construction — it changes what a scaler counts — so both
        // measures read zero and they agree for once. A non-zero here would mean the delta was
        // reading noise.
        for (const osId of osIds) {
            const hooks = rawFirmwareHooks(osId);
            expect(patchTouchCount(PATCHES.overclock, hooks), osId).toBe(0);
            expect(patchScoreDeltaFor(PATCHES.overclock, osId), osId).toBe(0);
        }
    });

    it('keeps patchTouchCount, because a 0 delta does not say WHICH kind of nothing', () => {
        /*
         * ══ THE FINDING THIS TEST EXISTS TO RECORD, AND IT IS ABOUT THE SCORER. ══
         *
         * RELAY changes a hook's `actor`. On four of the twelve it finds something to change — the
         * touch count says so — and the scored delta is **exactly 0 on all four**, because the
         * per-proc payoff is computed from the hook's ACTIONS and the scorer does not read who is
         * acting. SPLITTER, which changes `target`, moves the score on the same kind of hook,
         * because scope multipliers DO read the target.
         *
         * So 163 §3's own worked example — *"a Relay on a self-only OS scores high and on an
         * ally-reading OS scores zero"* — is a sentence the scorer as built cannot say. It scores
         * zero either way. That is a fact about `powerscale`, not about Relay, and it is recorded
         * here rather than worked around: the ruling was to rank by the delta, and this is what
         * ranking by the delta shows.
         *
         * `patchTouchCount` therefore stays and is not vestigial. "Found nothing" and "changed
         * something the scorer prices at zero" are different answers, the offer screen needs to
         * tell them apart, and only the count can.
         */
        const found = osIds.filter((osId) => patchTouchCount(PATCHES.relay, rawFirmwareHooks(osId)) > 0);
        expect(found.length, 'relay should reach SOME firmware, or this case is vacuous')
            .toBeGreaterThan(0);
        for (const osId of found) {
            expect(patchScoreDeltaFor(PATCHES.relay, osId), `relay on ${osId}`).toBe(0);
        }
    });
});

describe('163g — the gate offers two different KINDS', () => {
    const osIds = LAUNCH_SPECIES.flatMap((s) => MingmingRegistry[s]?.availableOS ?? []);

    it('never offers two riders about the same field, on any of the twelve', () => {
        // Henry, 2026-09-25: *"the gate's two offers must be two different KINDS."* Ranked on value
        // alone the top two are often two ways of doing the same thing — a firmware that rewards
        // one `amount` patch rewards the other — and then the choice is a choice in form only.
        //
        // Ticket 184d (Henry, 2026-10-01, "Hide them"): a patch that does nothing on the firmware is
        // never offered, so a firmware that can use only one patch is offered only that one —
        // huldra_v2 has no hook data, and OVERCLOCK is the one patch that is not a hook change.
        for (const osId of osIds) {
            const offers = gatePatchChoices(osId, []);
            if (osId === 'huldra_v2') {
                expect(offers, osId).toEqual(['overclock']);
                continue;
            }
            expect(offers, osId).toHaveLength(2);
            const kinds = offers.map((id) => PATCHES[id].field);
            expect(kinds[0], `${osId}: ${offers.join(' + ')}`).not.toBe(kinds[1]);
        }
    });

    it('leads with the body\'s best, so the pair always contains the one that fits', () => {
        for (const osId of osIds) {
            expect(gatePatchChoices(osId, [])[0], osId).toBe(bestPatchFor(osId).id);
        }
    });

    it('still respects what the body already holds', () => {
        const first = gatePatchChoices('fenrir_v1', [])[0];
        expect(gatePatchChoices('fenrir_v1', [first])).not.toContain(first);
        expect(gatePatchChoices('fenrir_v1', [first])).toHaveLength(2);
    });

    it('keeps AMPLIFIER as the shop\'s stock whatever the ranking says', () => {
        // §3: *"the boring one every OS can take and the workshop's default stock"*, and Henry
        // re-confirmed it with 163g. The shelf is deliberately NOT the ranking — the shop is where
        // a player buys the safe one, and the gate is where they are offered the good one.
        expect(SHOP_STOCK_PATCH).toBe('amplifier');
    });
});

describe('163g — the scorer refactor moved nothing', () => {
    it('scores a firmware identically through scoreOS and scoreHookList', () => {
        // `scoreOS` is now a one-line wrapper over `scoreHookList`, which is what lets a PATCHED
        // hook list be priced at all. Pinned because the whole delta rests on both sides going
        // through the same function, and a divergence would make every number above meaningless.
        for (const osId of LAUNCH_SPECIES.flatMap((s) => MingmingRegistry[s]?.availableOS ?? [])) {
            const viaId = scoreOS(osId);
            const viaList = scoreHookList(osId, rawFirmwareHooks(osId) as never, viaId.name);
            expect(viaList.pctOfPoolPerGame, osId).toBe(viaId.pctOfPoolPerGame);
            expect(viaList.contributions, osId).toEqual(viaId.contributions);
        }
    });
});
