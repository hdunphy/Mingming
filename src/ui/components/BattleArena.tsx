import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { type RootState } from '../store/store';
import MingmingUnit from './MingmingUnit';
import CardHand from './CardHand';
import CombatLog from './CombatLog';
import BattleStage from './BattleStage';
import MacroRack from './MacroRack';
import { selectSource, selectTarget, selectCard, endTurn, playProgram, setBattleState, executeIntent, fireMacro } from '../store/battleSlice';
import type { IBattleEntity } from '../../engine/types';
import { calculateDamage } from '../../engine/combatUtils';
import { GetProgramData } from '../../engine/data/programRegistry';
import { getBestAction } from '../../engine/ai/TacticalAI';
import { battleReducer, canFireMacro } from '../../engine/battleReducer';
import { getMacro, revivedHpFor } from '../../engine/data/macroRegistry';
import { rollDropTable } from '../../engine/RewardSystem';
import BattleReport from './BattleReport';
import { addBlueprint, markGymCleared, recordTierCleared } from '../store/gameSlice';
import {
    addDriver,
    addRunCards,
    addRunScrap,
    advanceGauntlet,
    consumeMacro,
    endRun,
    finishGauntlet,
    resolveEncounter,
    reviveGauntletMember,
} from '../store/runSlice';
import type { IRunCard, NodeKind } from '../../engine/runTypes';
import { RelicRegistry } from '../../engine/data/relicRegistry';
import { PRNG } from '../../engine/core/PRNG';
import type { IRewardBundle, IOwnedProgram } from '../../engine/gameTypes';
import { useBattleVfx } from '../hooks/useBattleVfx';
import { prefersReducedMotion } from '../utils/motionPrefs';
import { playSfx } from '../audio/AudioEngine';
import AudioControls from './AudioControls';

/**
 * Hold the level-up overlay after the queue first populates, so the death FX
 * (450ms CRT glitch + TERMINATED stamp beat) finish before it covers the stage.
 */
const LEVEL_UP_OVERLAY_DELAY_MS = 900;

const TurnBanner: React.FC<{ side: 'PLAYER' | 'ENEMY' }> = ({ side }) => (
    <motion.div
        key={side}
        initial={{ scale: 0.5, opacity: 0, x: -200 }}
        animate={{ scale: 1, opacity: 1, x: 0 }}
        exit={{ scale: 1.5, opacity: 0, x: 200 }}
        className="turn-banner"
        style={{
            position: 'absolute',
            top: '40%',
            left: '30%',
            right: '30%',
            padding: '20px',
            background: side === 'PLAYER' ? 'rgba(0, 150, 255, 0.8)' : 'rgba(255, 50, 50, 0.8)',
            color: 'white',
            textAlign: 'center',
            fontSize: '3rem',
            fontWeight: 900,
            borderRadius: '10px',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
            pointerEvents: 'none'
        }}
    >
        {side === 'PLAYER' ? 'YOUR TURN' : 'ENEMY TURN'}
    </motion.div>
);

const WinLossOverlay: React.FC<{ result: 'WIN' | 'LOSS', onShowReport?: () => void, onDefeat?: () => void }> = ({ result, onShowReport, onDefeat }) => {
    // Entrance beat: the headline slams in from oversized + blurred (a digital
    // "lock-on"), then the actions fade up. Reduced motion: simple fade only.
    const reduced = prefersReducedMotion();
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="end-game-overlay"
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.85)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000
            }}
        >
            <motion.h1
                initial={reduced
                    ? { opacity: 0 }
                    : { scale: 2.3, opacity: 0, filter: 'blur(14px)', letterSpacing: '0.5em' }}
                animate={reduced
                    ? { opacity: 1 }
                    : { scale: 1, opacity: 1, filter: 'blur(0px)', letterSpacing: '0.1em' }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                style={{
                    fontSize: '5rem',
                    color: result === 'WIN' ? '#00ffaa' : '#ff4444',
                    textShadow: '0 0 30px currentColor'
                }}
            >
                {result === 'WIN' ? 'VICTORY' : 'DEFEAT'}
            </motion.h1>
            {result === 'LOSS' && (
                <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45, duration: 0.3 }}
                    style={{ color: '#ff8888', marginTop: '-10px', fontSize: '1.2rem', fontWeight: 'bold' }}
                >
                    {/* Ticket 11: this said "RUN TERMINATED. DATA WIPED." and the code underneath
                        it made that true by calling deleteSave(). Both are gone. A defeat costs the
                        run and only the run — the ranch is a separate save key precisely so that a
                        lost fight can never reach a blueprint. */}
                    RUN TERMINATED. YOUR RANCH IS INTACT.
                </motion.p>
            )}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.3 }}
            >
                {result === 'WIN' && onShowReport ? (
                    <button
                        onClick={() => { playSfx('uiClick'); onShowReport(); }}
                        className="action-button"
                        style={{ marginTop: '40px' }}
                    >
                        VIEW REWARDS
                    </button>
                ) : (
                    <button
                        onClick={() => { playSfx('uiClick'); (onDefeat || (() => window.location.reload()))(); }}
                        className="action-button"
                        style={{ marginTop: '40px' }}
                    >
                        {result === 'LOSS' ? 'RETURN TO THE RANCH' : 'RETURN TO BASE'}
                    </button>
                )}
            </motion.div>
        </motion.div>
    );
};

const BattleArena: React.FC = () => {
    const dispatch = useDispatch();
    const battleState = useSelector((state: RootState) => state.battle.battle);
    const selectedSourceId = useSelector((state: RootState) => state.battle.selectedSourceId);
    const selectedTargetId = useSelector((state: RootState) => state.battle.selectedTargetId);
    const selectedCardId = useSelector((state: RootState) => state.battle.selectedCardId);
    // TICKET 11: a battle's context is the RUN, not the ranch. The gauntlet, the drivers and the
    // scrap the fight pays out are all `IRunState` fields now; the only thing the ranch still
    // receives from a won fight is blueprints, which are the one persistent currency.
    const run = useSelector((state: RootState) => state.run.run);
    const gauntlet = run?.gauntlet ?? null;
    const drivers = run?.drivers;

    const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);
    const [showTurnBanner, setShowTurnBanner] = useState(false);
    const [dragPoint, setDragPoint] = useState<{ x: number, y: number } | null>(null);
    const [originPoint, setOriginPoint] = useState<{ x: number, y: number } | null>(null);
    const [isTargeting, setIsTargeting] = useState(false);
    const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);

    // Epic 3.5: Post-battle state
    const [rewardBundle, setRewardBundle] = useState<IRewardBundle | null>(null);
    const [showReport, setShowReport] = useState(false);

    // Combat juice: event-bus driven VFX (floats, flashes, lunges, arena shake)
    const vfx = useBattleVfx(battleState);
    const { triggerLunge } = vfx; // stable callback, safe as an effect dep
    const stageControls = useAnimation();

    // Stage fade-in on mount (was a declarative animate; controls now own it so
    // the big-hit shake below can share the same motion component).
    useEffect(() => {
        stageControls.start({ opacity: 1, transition: { duration: 1 } });
    }, [stageControls]);

    // Big hits (>= 33% max HP) nudge the whole arena a few px.
    useEffect(() => {
        if (!vfx.shakeKey || prefersReducedMotion()) return;
        stageControls.start({ x: [0, -3, 3, -2, 2, 0], transition: { duration: 0.22 } });
    }, [vfx.shakeKey, stageControls]);

    const prevSideRef = useRef(battleState?.activeSide);
    // Separate ref for the enemy-AI effect so it doesn't race the turn-banner effect
    // (sharing prevSideRef meant the "wait for banner" branch never triggered).
    const aiPrevSideRef = useRef(battleState?.activeSide);

    // Clear the selected source if that unit dies
    useEffect(() => {
        if (!selectedSourceId || !battleState) return;
        const selected = battleState.playerParty.find(p => p.id === selectedSourceId);
        if (!selected || selected.currentHp <= 0) {
            dispatch(selectSource(null));
        }
    }, [battleState, selectedSourceId, dispatch]);

    // Hotkeys implementation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!battleState || battleState.activeSide !== 'PLAYER') return;

            // 1-9: Select Card
            if (e.key >= '1' && e.key <= '9') {
                const index = parseInt(e.key) - 1;
                const hand = battleState.playerDeck.hand;
                if (hand[index]) {
                    dispatch(selectCard(hand[index].id));
                }
            }

            // W, E, R: Select Player Units (skip dead units)
            const selectAliveUnit = (index: number) => {
                const unit = battleState.playerParty[index];
                if (unit && unit.currentHp > 0) dispatch(selectSource(unit.id));
            };
            if (e.key.toLowerCase() === 'w') selectAliveUnit(0);
            if (e.key.toLowerCase() === 'e') selectAliveUnit(1);
            if (e.key.toLowerCase() === 'r') selectAliveUnit(2);

            // Space: End Turn
            if (e.key === ' ') {
                e.preventDefault();
                dispatch(endTurn());
            }

            // Esc: Clear selections
            if (e.key === 'Escape') {
                dispatch(selectCard(null));
                dispatch(selectSource(null));
                dispatch(selectTarget(null));
                setDragPoint(null);
                setOriginPoint(null);
                setIsTargeting(false);
            }
        };

        const handleWheel = (e: WheelEvent) => {
            if (!battleState || battleState.activeSide !== 'PLAYER' || !selectedSourceId) return;
            const aliveParty = battleState.playerParty.filter(p => p.currentHp > 0);
            if (aliveParty.length === 0) return;
            const currentIndex = aliveParty.findIndex(p => p.id === selectedSourceId);
            if (currentIndex === -1) return;

            let nextIndex = currentIndex + (e.deltaY > 0 ? 1 : -1);
            if (nextIndex < 0) nextIndex = aliveParty.length - 1;
            if (nextIndex >= aliveParty.length) nextIndex = 0;

            dispatch(selectSource(aliveParty[nextIndex].id));
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('wheel', handleWheel);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('wheel', handleWheel);
        };
    }, [battleState, dispatch, selectedSourceId]);

    useEffect(() => {
        if (battleState?.activeSide !== prevSideRef.current) {
            setShowTurnBanner(true);
            const timer = setTimeout(() => setShowTurnBanner(false), 2000);
            prevSideRef.current = battleState?.activeSide;
            return () => clearTimeout(timer);
        }
    }, [battleState?.activeSide]);

    // Enemy AI Turn Automation
    useEffect(() => {
        if (!battleState || battleState.activeSide !== 'ENEMY') {
            if (aiPrevSideRef.current !== battleState?.activeSide) {
                aiPrevSideRef.current = battleState?.activeSide;
            }
            return;
        }

        // Check if battle is over
        const isOver = battleState.playerParty.every(p => p.currentHp <= 0) ||
            battleState.enemyParty.every(e => e.currentHp <= 0);
        if (isOver) return;

        let cancelled = false;

        const runAI = async () => {
            // Wait for turn banner if this is the start of the enemy turn
            if (aiPrevSideRef.current !== 'ENEMY') {
                await new Promise(r => setTimeout(r, 1200));
            } else {
                // Delay between actions
                await new Promise(r => setTimeout(r, 600));
            }

            if (cancelled) return;
            aiPrevSideRef.current = 'ENEMY';

            const action = getBestAction(battleState);

            if (action.type === 'PLAY_PROGRAM') {
                dispatch(playProgram(action.payload));
            } else if (action.type === 'EXECUTE_INTENT') {
                // EXECUTE_INTENT emits no PROGRAM_PLAYED event, so nudge the
                // attacker's lunge from here (purely visual, no reducer delay).
                triggerLunge(action.payload.sourceId);
                dispatch(executeIntent(action.payload));
            } else if (action.type === 'END_TURN') {
                dispatch(endTurn());
            }
        };

        runAI();

        return () => { cancelled = true; };
    }, [battleState, dispatch, triggerLunge]);

    /**
     * Fire a macro out of the rack — **the two-slice write, in the ruled order.**
     *
     * `battleSlice.fireMacro` resolves it and `runSlice.consumeMacro` spends the slot, because no
     * reducer can write two slices (the same split ticket 11's reward claim and ticket 14's recruit
     * both make). The battle half goes first, and `consumeMacro`'s own comment carries the argument
     * for why: a crash between the two dispatches leaves a macro that fired and a slot still full,
     * which is strictly better than a slot spent on a shot that never happened.
     *
     * `canFireMacro` is checked here as well as inside the reducer. That is not belt-and-braces for
     * its own sake: the reducer's refusal is silent (every refusal in this engine is), so without
     * this check a blocked shot would still reach `consumeMacro` and destroy the consumable. The
     * rack's button is disabled off the same predicate, so this is the third and last gate.
     */
    const handleFireMacroClick = (slot: number, macroId: string) => {
        if (!battleState || !run) return;
        const macro = getMacro(macroId);
        if (!macro) return;
        // Mirrors MacroRack's defaulting: an ally-facing macro with nobody picked lands on the
        // firing unit. Kept in step by both reading `macro.targeting` rather than by agreement.
        const targetId = macro.targeting === 'ALLY'
            ? (selectedTargetId ?? selectedSourceId ?? '')
            : (selectedTargetId ?? '');
        const payload = { macroId, sourceId: selectedSourceId ?? '', targetId };
        if (canFireMacro(battleState, payload) !== null) return;

        dispatch(fireMacro(payload));

        /*
         * TICKET 18: THE REVIVE HOOK — the run has to hear about it too.
         *
         * A gauntlet member who faints is *revivable, never gone-for-gauntlet*
         * (`economy-session.md`), and the record of who is down lives in the RUN
         * (`IGauntletProgress.downedMemberIds`), not in the battle. So a revive that only lands in
         * the battle is a revive the next fight undoes: `buildBattleSetup` would carry the member's
         * 0 straight back in and re-down them. `reviveGauntletMember` is the other half.
         *
         * The HP comes from `revivedHpFor`, the same function `ReviveExecutor` uses, so the run
         * records the number the battle actually gave rather than a second guess at it. The percent
         * is read off the macro's own action rather than the constant, so a future macro that
         * revives at some other fraction needs nothing here.
         *
         * **THIS IS THE HOOK, NOT THE POLICY.** Ticket 18 is explicit that *"the exact revive
         * economy is DEFERRED TO PLAYTESTING (ticket 25)"*, and nothing here prices a revive, caps
         * how many a gauntlet allows, or decides whether the second candidate shape (auto-return
         * between fights at a reduced %) replaces it. Whatever ticket 25 settles, it dispatches this
         * same reducer.
         *
         * Dispatched after `fireMacro` for `consumeMacro`'s reason, spelled out in that reducer: a
         * crash between two synchronous dispatches should leave the *generous* state, and here that
         * is a battle where the member is up.
         */
        if (gauntlet) {
            const revive = macro.actions.find((action) => action.type === 'REVIVE');
            const target = battleState.playerParty.find((p) => p.id === targetId);
            if (revive && target) {
                dispatch(reviveGauntletMember({
                    memberId: target.id,
                    hp: revivedHpFor(target.maxHp, (revive as { percent?: number }).percent),
                }));
            }
        }

        dispatch(consumeMacro(slot));
        dispatch(selectCard(null));
    };

    const handlePlay = (cardId: string, targetId: string) => {
        if (!battleState || !selectedSourceId) return;

        dispatch(playProgram({
            sourceId: selectedSourceId,
            targetId,
            programId: cardId
        }));

        // Persist source selection, clear card/drag state
        dispatch(selectCard(null));
        setDragPoint(null);
        setOriginPoint(null);
        setIsTargeting(false);
    };

    const isVictory = battleState?.enemyParty.every(e => e.currentHp <= 0) ?? false;
    // Victory takes precedence: if both sides fall in the same resolution, count it as a win
    // so the defeat overlay never renders and the save is never wiped.
    const isDefeat = !isVictory && (battleState?.playerParty.every(p => p.currentHp <= 0) ?? false);

    // TICKET 11 DELETED THE SAVE WIPE THAT USED TO LIVE HERE.
    //
    // The old effect called `deleteSave()` the moment the player's last unit fell. That was
    // defensible when a save WAS the run — losing meant starting over, so there was nothing in the
    // file worth keeping. It is catastrophic now: ticket 06 split the save in two and the persistent
    // half is the **ranch** — assembled individuals with unrepeatable stat rolls, blueprint counts,
    // the codex. `deleteSave()` on a lost wild fight would have deleted all of it.
    //
    // What a defeat costs is the run, and only the run. See `handleDefeat` below.

    /**
     * The node this fight is happening on — the key into ticket 12's two reward knobs
     * (`BLUEPRINT_DROP_RATE`, `SCRAP_PER_ENEMY`). A battle with no run behind it is a debug
     * scenario, which has no node at all; `'wild'` is the baseline both tables are quoted against,
     * so a scenario pays what an ordinary fight pays rather than nothing.
     */
    const nodeKind: NodeKind = run?.nodes.find(n => n.id === run.currentNodeId)?.kind ?? 'wild';

    // Audio: battle-end stinger, played once per battle (seed = battle identity;
    // gauntlets chain battles without ever passing through battleState === null).
    const endSoundPlayedRef = useRef(false);
    const battleSeed = battleState?.seed;
    useEffect(() => {
        endSoundPlayedRef.current = false;
    }, [battleSeed]);
    useEffect(() => {
        if (endSoundPlayedRef.current) return;
        if (isVictory) {
            endSoundPlayedRef.current = true;
            playSfx('victory');
        } else if (isDefeat) {
            endSoundPlayedRef.current = true;
            playSfx('defeat');
        }
    }, [isVictory, isDefeat]);

    // Audio: charge-up zap when a next-program discount primes on a player unit
    // (e.g. Gullinbursti's UNSTOPPABLE_MASS). Watches the modifier appearing.
    const primedIdsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        const next = new Set<string>();
        battleState?.playerParty.forEach(p => {
            if (p.nextProgramModifier) next.add(p.id);
        });
        for (const id of next) {
            if (!primedIdsRef.current.has(id)) {
                playSfx('discountPrimed');
                break;
            }
        }
        primedIdsRef.current = next;
    }, [battleState]);

    /**
     * Roll rewards on victory.
     *
     * TICKET 12 CHANGED WHAT THIS ASKS FOR. The old call was
     * `rollDropTable(enemyParty, rosterSize, seed)`; the middle argument scaled the blueprint
     * chance down as the ranch filled up, and `RewardSystem` deletes it (see the long note beside
     * `BLUEPRINT_DROP_RATE`). What the roll needs instead is **the node kind**, which is what both
     * reward tables are keyed by, and **the player's party**, which is what the pick pool is drawn
     * from now (`rewardCardPool`). `battleState.playerParty` is the party as it stands in this
     * fight — including anyone recruited mid-run, which is ticket 08's clause about a recruit's
     * untagged kit cards entering the pool the moment it joins.
     *
     * TICKET 12 ALSO REMOVED THE GYM-CLEAR MINI-DRAFT FROM THIS PATH. On the last fight of a
     * gauntlet it used to blank `cardChoices` and substitute three `rollDraftRounds` rounds.
     * **Ticket 18 owns the gauntlet refit**, and until it lands nothing advances
     * `IRunState.gauntlet` at all (see `handleContinue`), so the branch was reachable only through
     * a state no code produces. `rollDraftRounds` and `IRewardBundle.draftRounds` are still there
     * for 18 to re-wire; what is gone is the invocation.
     *
     * The driver choice on a gauntlet's last fight stays as ticket 11 left it — ticket 16 owns
     * drivers and has not been through here yet.
     */
    useEffect(() => {
        if (isVictory && !rewardBundle && battleState) {
            let bundle = rollDropTable({
                defeated: battleState.enemyParty,
                nodeKind,
                party: battleState.playerParty,
                seed: battleState.seed,
            });

            // Last fight of the gauntlet: the win pays a driver choice on top of the usual bundle.
            if (gauntlet && gauntlet.fightIndex >= gauntlet.totalFights - 1) {
                const held = new Set(drivers ?? []);
                const available = Object.keys(RelicRegistry).filter(r => !held.has(r));

                if (available.length > 0) {
                    const prng = new PRNG(Date.now().toString());
                    const { shuffled } = prng.shuffle(available);
                    bundle = { ...bundle, relicChoices: shuffled.slice(0, 3) };
                }
            }

            setRewardBundle(bundle);
        }
    }, [isVictory, battleState, rewardBundle, nodeKind, gauntlet, drivers]);

    /**
     * **BANK THE BLUEPRINTS THE MOMENT THEY DROP, NOT WHEN THE PLAYER PRESSES CONTINUE.**
     *
     * Ticket 12's Done-when: *"the blueprint persists to the ranch immediately (dead runs still pay
     * forward)"*. Before this ticket `addBlueprint` fired in `handleContinue`, i.e. on the reward
     * *claim*, and the bundle it read from was component state — so a player who won a fight and
     * closed the app on the reward screen lost the blueprint outright. Nothing had written it
     * anywhere: the ranch autosave had nothing to save, and the run save carries no pending bundle.
     *
     * Scrap, cards and the driver still land on claim, and the asymmetry is the point rather than
     * an inconsistency. Those three are **run-scoped** — if the app closes here the run resumes at
     * `phase: 'encounter'` and re-rolls the identical fight from the identical seed (ticket 11's
     * resume contract), so the player is paid for it when they win it again; paying twice would be
     * the actual bug. The blueprint is the one **persistent** reward, the ranch is a separate save
     * key precisely so a lost run cannot reach it, and "dead runs still pay forward" only means
     * anything if the payment does not wait on a button.
     *
     * Idempotent per battle, via a ref rather than the `rewardBundle` state. `StrictMode`
     * double-invokes effects on mount and both invocations see the same pre-render state, so a
     * state guard would credit twice in development. The ref is keyed by the battle seed so a
     * gauntlet's next fight (which reuses this mounted component) banks its own drops.
     *
     * **The known consequence, and why it is acceptable.** Banking early plus the unfinished
     * encounter means a player who closes the app on the reward screen resumes into the *same*
     * fight and, on winning it again, banks the same blueprint again. It is bounded by exactly what
     * Henry has already blessed: re-entering the node pays full rewards too, so the exploit costs
     * one won fight per blueprint — the same price as the sanctioned farm, with more steps. Closing
     * it would mean either persisting a pending bundle (a third save shape, for 30 seconds of
     * state) or resolving the node before the player claims (which loses the fight's rewards if the
     * app dies a moment later). Both are worse trades than a farm that is already legal.
     */
    const bankedBlueprintSeedRef = useRef<string | null>(null);
    useEffect(() => {
        if (!rewardBundle || !battleState) return;
        if (bankedBlueprintSeedRef.current === battleState.seed) return;
        bankedBlueprintSeedRef.current = battleState.seed;

        // One dispatch per entry, not per species: `blueprints` is a list in which duplicates are
        // meaningful and `addBlueprint` stacks the count (ticket 20).
        for (const speciesId of rewardBundle.blueprints) {
            dispatch(addBlueprint(speciesId));
        }
    }, [rewardBundle, battleState, dispatch]);

    /**
     * Defeat: the run is over.
     *
     * **PLACEHOLDER — ticket 19 owns the run-end screen** and replaces the two dispatches below with
     * whatever it needs on the way out. What is here is the honest minimum: mark the run ended with
     * its outcome (`endRun` keeps the corpse rather than clearing it, because ticket 19 has to read
     * it) and drop the battle, which routes back through `App` to `RunScreen`'s ended panel and from
     * there to the ranch.
     *
     * No `deleteSave()`, no `resetSave()`, no `window.location.reload()`. All three were here and
     * all three are wrong now — see the note where the wipe effect used to be. A battle outside a
     * run (a debug scenario) has nothing to end, so it simply closes.
     */
    const handleDefeat = () => {
        if (run) dispatch(endRun('defeat'));
        dispatch(setBattleState(null as any));
    };

    /**
     * Claim the rewards and leave the battle.
     *
     * TICKET 11 SPLIT THIS ACROSS THE TWO SLICES, along the line ticket 06 drew. **Blueprints go to
     * the ranch** — they are the only persistent currency, and one is spent per assembly. **Scrap,
     * cards and drivers go to the run**, because `economy-session.md`'s anti-mudflation rule says a
     * run may not fund the next one. There is no `applyRewardBundle` any more: a single reducer
     * could not write both slices, and splitting it is what makes the destination of each reward
     * legible at the call site.
     *
     * **TICKET 12 MOVED THE RANCH HALF EARLIER.** Blueprints are banked by the effect above the
     * moment the bundle is rolled, not here — the ticket's Done-when is that a blueprint persists
     * *immediately*, so that a dead run, or an app closed on the reward screen, still pays forward.
     * Only the run-scoped rewards are claimed at this button.
     *
     * Cards become `IRunCard`s with `ownerId: null` — `runTypes.ts` reserves that for cards that
     * were bought, drafted or granted rather than brought by a member, which is exactly what a
     * reward card is.
     *
     * **TICKET 11 PART 2 ADDED THE WAY BACK TO THE MAP.** A won fight now resolves the node it was
     * fought on: `resolveEncounter` puts the run's phase back to `'map'` and adds one to
     * `fightsResolved`, and clearing the battle in the same batch drops the player back on
     * `RunScreen` standing where they fought. Phase and battle are cleared together on purpose —
     * `RunScreen`'s trigger effect keys off `phase === 'encounter'`, so leaving the phase behind
     * would re-fire the fight the instant the arena closed.
     *
     * # TICKET 18: A GAUNTLET FIGHT DOES NOT RESOLVE A NODE, IT ADVANCES A CHAIN
     *
     * The three branches below are the same event seen at three points in a run, and the difference
     * between them is which reducer counts the fight:
     *
     * - **An ordinary node**: `resolveEncounter` — back to the map, `fightsResolved` +1.
     * - **Gauntlet fight 1 or 2**: `advanceGauntlet`, carrying the party's HP as the battle left it.
     *   The phase stays `'gauntlet'` (there is no walking out of the exam), `fightIndex` moves, and
     *   the Pit Stop is what the player lands on. **The payload is the whole party, downed members
     *   included**, because the reducer derives both `persistedHp` and `downedMemberIds` from it —
     *   which is also how a member revived mid-fight stops being down, with no special case.
     * - **The last gauntlet fight**: `finishGauntlet`, then the gym clear, then `endRun('victory')`.
     *
     * Winning the gauntlet is the run's victory condition (`exploration-map.md`: the gym is the only
     * way a run is won). Ticket 11 recognised it by the NODE the player was standing on, because
     * `IRunState.gauntlet` was always null then; it is recognised by **gauntlet progress** now, and
     * the node check is gone. Ticket 19 still owns what the player sees next.
     *
     * A defeat does not come through here at all — `handleDefeat` ends the run, and a wipe in fight
     * one of three is exactly as final as a wipe anywhere else on the map.
     */
    const handleContinue = (chosenCards: IOwnedProgram[], chosenRelic?: string) => {
        if (rewardBundle) {
            // Ticket 21: there is no XP. Rewards are cards, scrap and blueprints — and ticket 12
            // moved the **blueprints** out of this handler: they are banked to the ranch as soon as
            // they drop, by the effect above, so that closing the app on the reward screen cannot
            // lose them. What is claimed here is the run-scoped half.
            if (rewardBundle.scraps > 0) {
                dispatch(addRunScrap(rewardBundle.scraps));
            }
            if (chosenCards.length > 0) {
                const runCards: IRunCard[] = chosenCards.map(card => ({
                    instanceId: card.instanceId,
                    dataId: card.dataId,
                    ownerId: null,
                }));
                dispatch(addRunCards(runCards));
            }
            if (chosenRelic) {
                dispatch(addDriver(chosenRelic));
            }
        }

        const lastGauntletFight = gauntlet !== null && gauntlet.fightIndex >= gauntlet.totalFights - 1;

        if (gauntlet && !lastGauntletFight) {
            // The party as this fight left it — HP and all, downed members included. Nothing is
            // healed on the way out, which is the whole of "three fights, NO healing between them".
            dispatch(advanceGauntlet(
                (battleState?.playerParty ?? []).map(member => ({ memberId: member.id, hp: member.currentHp })),
            ));
        } else if (gauntlet) {
            dispatch(finishGauntlet());
        } else {
            // Back to the map, and one more fight on the tally. A no-op outside a run, which is what
            // a debug scenario's victory is.
            dispatch(resolveEncounter());
        }

        if (run && lastGauntletFight) {
            dispatch(markGymCleared(run.gymId));
            dispatch(recordTierCleared(run.tier));
            // Ordered after `finishGauntlet`, which sets the phase back to 'map': the run is over,
            // not back on the map, and `endRun` is what says so.
            dispatch(endRun('victory'));
        }

        dispatch(setBattleState(null as any));
    };

    if (!battleState) return <div className="battle-screen">Loading Battle...</div>;

    // Helper: get the currently selected card's program data
    const getSelectedCardData = () => {
        if (!battleState || !selectedCardId) return null;
        const card = battleState.playerDeck.hand.find(c => c.id === selectedCardId);
        if (!card) return null;
        return GetProgramData(card.dataId);
    };

    // ── Shared targeting logic ──
    // One source of truth for "can this card land on this unit", used by BOTH
    // the sidebar HUD cards and the center-stage spotlights.
    const isValidCardTarget = (cardData: ReturnType<typeof GetProgramData>, isEnemy: boolean) => {
        const targetType = cardData.target;
        return (
            (isEnemy && (targetType === 'Single' || targetType === 'Side' || targetType === 'All')) ||
            (!isEnemy && (targetType === 'Self' || targetType === 'Side' || targetType === 'All')) ||
            (!isEnemy && cardData.actions.some(a => a.type === 'HEAL' || a.type === 'STATUS'))
        );
    };

    /** Drop a dragged/selected card on this unit (sidebar card or stage spotlight). */
    const handleEntityPointerUp = (entity: IBattleEntity, isEnemy: boolean) => {
        if (!selectedCardId || entity.currentHp <= 0) return;
        const cardData = getSelectedCardData();
        if (!cardData) return;

        if (isValidCardTarget(cardData, isEnemy)) {
            // For Self cards, always target the source
            const effectiveTargetId = cardData.target === 'Self' ? (selectedSourceId || entity.id) : entity.id;
            handlePlay(selectedCardId, effectiveTargetId);
            dispatch(selectCard(null));
        }
    };

    /** Click a unit (sidebar card or stage spotlight): target enemies / select allies. */
    const handleEntityClick = (entity: IBattleEntity, isEnemy: boolean) => {
        if (entity.currentHp <= 0) return;
        const isTargeted = selectedTargetId === entity.id;

        // If we have a card selected, check if this is a valid target
        if (selectedCardId) {
            const cardData = getSelectedCardData();
            if (cardData && isValidCardTarget(cardData, isEnemy)) {
                dispatch(selectTarget(isTargeted ? null : entity.id));
                return;
            }
        }

        // Default behavior: enemy = target, friendly = source
        if (isEnemy) {
            dispatch(selectTarget(isTargeted ? null : entity.id));
        } else {
            dispatch(selectSource(selectedSourceId === entity.id ? null : entity.id));
        }
    };

    const renderParty = (party: readonly IBattleEntity[], isEnemy: boolean) => (
        <div className={`party-column ${isEnemy ? 'enemy-side' : 'player-side'}`}>
            {party.map((entity, index) => {
                const isSelected = selectedSourceId === entity.id;
                const isTargeted = selectedTargetId === entity.id;
                const isDead = entity.currentHp <= 0;

                if (!entity.id) {
                    console.warn(`[BattleArena] Entity at index ${index} (isEnemy: ${isEnemy}) has an empty ID!`);
                }
                const entityKey = entity.id || `entity-${isEnemy ? 'enemy' : 'player'}-${index}`;

                const translateX = 0;

                return (
                    <motion.div
                        key={entityKey}
                        initial={{ opacity: 0, x: isEnemy ? 100 : -100 }}
                        animate={{ opacity: isDead ? 0.55 : 1, x: translateX, scale: isDead ? 0.96 : 1 }}
                        transition={{ delay: index * 0.1, type: 'spring' }}
                        // Pointer events must stay 'auto' even for dead units,
                        // so they can correctly receive the 'onPointerUp' to clear targeting state.
                        // Desaturation of dead units lives on .hud-dead (inside the card),
                        // so the TERMINATED stamp keeps its neon red.
                        style={{ pointerEvents: 'auto' }}
                        onMouseEnter={() => {
                            if (isTargeting) setHoveredEntityId(entity.id);
                        }}
                        onMouseLeave={() => {
                            if (hoveredEntityId === entity.id) setHoveredEntityId(null);
                        }}
                        onPointerUp={() => handleEntityPointerUp(entity, isEnemy)}
                    >
                        <MingmingUnit
                            entity={entity}
                            isEnemy={isEnemy}
                            isSelected={isSelected}
                            isTargeted={isTargeted}
                            fx={vfx.unitFx[entity.id]}
                            battleState={battleState}
                            selectedCardId={selectedCardId}
                            selectedSourceId={selectedSourceId}
                            isHoveredTarget={hoveredEntityId === entity.id}
                            onClick={() => handleEntityClick(entity, isEnemy)}
                        />
                    </motion.div>
                );
            })}
        </div>
    );

    return (
        <div className="battle-screen"
            onPointerMove={(e) => {
                if (isTargeting && selectedCardId) {
                    setDragPoint({ x: e.clientX, y: e.clientY });
                }
            }}
            onPointerUp={() => {
                setIsTargeting(false);
                setDragPoint(null);
                setOriginPoint(null);
            }}
        >
            {/* Audio toggle/volume — the nav bar (its usual home) is hidden in battle */}
            <AudioControls floating />

            {/* Breach progress: small truthful indicator of which breach battle this is */}
            {gauntlet && (
                <div
                    style={{
                        position: 'fixed',
                        top: '10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1500,
                        pointerEvents: 'none',
                        padding: '4px 14px',
                        borderRadius: '4px',
                        background: 'rgba(0, 0, 0, 0.55)',
                        border: '1px solid rgba(255, 204, 0, 0.35)',
                        color: '#ffcc00',
                        fontSize: '0.7rem',
                        fontWeight: 900,
                        letterSpacing: '3px'
                    }}
                >
                    {/*
                      * Ticket 18 renamed this from "BREACH — BATTLE n/3". A breach was the pre-run
                      * vocabulary; what the player is standing in is the gym's gauntlet, and the
                      * last fight is the leader's own team — worth saying, because it is the one
                      * fight where holding a Revive rather than spending it is a real decision.
                      */}
                    GAUNTLET — FIGHT {Math.min(gauntlet.fightIndex + 1, gauntlet.totalFights)}/{gauntlet.totalFights}
                    {gauntlet.fightIndex >= gauntlet.totalFights - 1 ? ' · LEADER' : ''}
                </div>
            )}

            {/* Ticket 90, playtest round 1: Henry had no way to see the turn number or how many
                cards he had played - and `stampede`/`momentum_crash` scale on exactly that count,
                so the deck's whole plan was invisible while piloting it. Fixed to the top-left,
                out of the way of the party columns and the card fan. */}
            <div
                style={{
                    position: 'fixed', top: '10px', left: '12px', zIndex: 1500, pointerEvents: 'none',
                    display: 'flex', gap: '8px', alignItems: 'center',
                    fontSize: '0.7rem', fontWeight: 900, letterSpacing: '2px',
                }}
            >
                <span style={{
                    padding: '4px 12px', borderRadius: '4px', background: 'rgba(0,0,0,0.55)',
                    border: '1px solid rgba(255,255,255,0.18)', color: '#e8e4dc',
                }}>
                    TURN {battleState.turn}
                </span>
                <span
                    title="Cards you have played this turn - what stampede, momentum crash and the other per-card scalers multiply by."
                    style={{
                        padding: '4px 12px', borderRadius: '4px', background: 'rgba(0,0,0,0.55)',
                        border: `1px solid ${battleState.cardsPlayedThisTurn > 0 ? 'rgba(0,229,255,0.45)' : 'rgba(255,255,255,0.18)'}`,
                        color: battleState.cardsPlayedThisTurn > 0 ? '#00e5ff' : '#8a837b',
                    }}
                >
                    CARDS PLAYED {battleState.cardsPlayedThisTurn}
                </span>
            </div>

            <AnimatePresence>
                {showTurnBanner && <TurnBanner key="turn-banner" side={battleState.activeSide} />}
                {isVictory && !showReport && (
                    <WinLossOverlay
                        key="win-overlay"
                        result="WIN"
                        onShowReport={() => setShowReport(true)}
                    />
                )}
                {isDefeat && (
                    <WinLossOverlay
                        key="loss-overlay"
                        result="LOSS"
                        onDefeat={handleDefeat}
                    />
                )}
                {isVictory && showReport && rewardBundle && (
                    <BattleReport
                        key="battle-report"
                        bundle={rewardBundle}
                        winners={battleState.playerParty as any}
                        onContinue={handleContinue}
                    />
                )}
            </AnimatePresence>

            {/* Targeting Line SVG */}
            {selectedCardId && dragPoint && originPoint && (
                <svg style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1000, width: '100%', height: '100%' }}>
                    <motion.line
                        x1={originPoint.x}
                        y1={originPoint.y}
                        x2={dragPoint.x}
                        y2={dragPoint.y}
                        stroke="rgba(255, 255, 255, 0.5)"
                        strokeWidth="4"
                        strokeDasharray="10 10"
                        animate={{ strokeDashoffset: [0, -20] }}
                        transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                    />
                    <circle cx={dragPoint.x} cy={dragPoint.y} r="8" fill="white" />
                </svg>
            )}

            {/* Stage: Top 70% (controls: fade-in on mount + big-hit shake) */}
            <motion.div
                className="stage-area"
                initial={{ opacity: 0 }}
                animate={stageControls}
            >
                {/* Center stage: big spotlight sprites for the selected unit + focus enemy */}
                <BattleStage
                    battleState={battleState}
                    selectedSourceId={selectedSourceId}
                    selectedTargetId={selectedTargetId}
                    hoveredEntityId={hoveredEntityId}
                    isTargeting={isTargeting}
                    unitFx={vfx.unitFx}
                    onEntityClick={handleEntityClick}
                    onEntityPointerUp={handleEntityPointerUp}
                    onEnemyHoverChange={setHoveredEntityId}
                />

                {renderParty(battleState.playerParty, false)}

                <CombatLog />

                {renderParty(battleState.enemyParty, true)}
            </motion.div>

            <div
                className="console-area"
                onPointerUp={() => {
                    setDragPoint(null);
                    setOriginPoint(null);
                }}
            >
              <div className="console-row">
                {/*
                  * THE MACRO RACK — ticket 15. Beside the hand, not in it: a macro is not a card
                  * (see `handleFireMacro`'s note on the counters it deliberately does not touch), so
                  * it must not sit in the fan where it would read as one.
                  *
                  * Rendered only inside a run. A debug scenario has no `IRunState` and therefore no
                  * rack, which is correct rather than a gap — macros are a run-scoped consumable.
                  */}
                {run && (
                    <MacroRack
                        macros={run.macros}
                        battleState={battleState}
                        selectedSourceId={selectedSourceId}
                        selectedTargetId={selectedTargetId}
                        onFire={handleFireMacroClick}
                    />
                )}
                <CardHand
                    hoveredEntityId={hoveredEntityId}
                    onTargetingStart={(point) => {
                        setOriginPoint(point);
                        setIsTargeting(true);
                    }}
                    onTargetingEnd={() => {
                        setIsTargeting(false);
                        setDragPoint(null);
                        setOriginPoint(null);
                        setHoveredEntityId(null);
                    }}
                />
              </div>
            </div>
        </div>
    );
};


export default BattleArena;
