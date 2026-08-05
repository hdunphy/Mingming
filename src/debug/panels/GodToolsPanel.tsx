/**
 * God Tools — stage a board mid-battle.
 *
 * The UI half of docs/wayfinder/debug-toolkit/tickets/15-battle-debug-overlay.md. All ten
 * v1 verbs live in `../verbs` as pure `(state, args) => IBattleState` functions; this panel
 * only collects arguments and dispatches `setBattleState(verb(current, args))`. There is no
 * new `battleSlice` action and no `debugSlice`: Redux is read with `useSelector` and written
 * with `useDispatch`, exactly like every other panel.
 *
 * Two things this panel is deliberately opinionated about:
 *
 *   1. EVERY CONTROL IS BADGED WITH ITS ENGINE ACTION, and with whether that action is
 *      pre-existing (`APPLY_STATUS`, `END_TURN`, `EXECUTE_INTENT`) or new. It changes what
 *      a repro proves — see `GodVerbMeta.isNewAction`.
 *   2. THE SOURCE PICKER IS NEVER THE TARGET. It is pre-filled from live battle state (the
 *      opposing party's active unit) and freely overridable, because retaliation and thorns
 *      hooks read source-vs-target to decide whether to fire.
 *
 * Occlusion: the floating layer sits over the battle board, so this panel stays a single
 * narrow column there, mirrors the target's live vitals inline (so the board rarely needs
 * to be read through the overlay at all), and offers "close & inspect" plus an
 * auto-close-after-apply toggle. The Ctrl+Shift+D hotkey belongs to `DebugRoot`; nothing
 * here binds a key.
 */

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useDebugUI } from '../debugUI';
import type { DebugPanelProps } from './types';
import {
    DEBUG_LOG_PREFIX,
    GOD_VERBS_BY_ID,
    addCardToHand,
    applyStatus,
    clearStatus,
    defaultSourceId,
    executeIntent,
    killEntity,
    setEnergy,
    setHp,
    setIntent,
    setTempHp,
    skipTurn,
    sourceCandidates,
    type GodVerbId,
} from '../verbs';
import type { RootState } from '../../ui/store/store';
import { setBattleState } from '../../ui/store/battleSlice';
import { Statuses, type IBattleEntity, type IBattleState, type IMove, type StatusType } from '../../engine/types';
import { getInflatedProgramRegistry } from '../../engine/data/programRegistry';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';

// --- Styles (inline, like DebugRoot: the debug layer ships no stylesheet of its own) ---

const sectionStyle: CSSProperties = {
    border: '1px solid rgba(122, 92, 255, 0.3)',
    borderRadius: '6px',
    padding: '8px',
    marginBottom: '8px',
};

const rowStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '6px',
};

const labelStyle: CSSProperties = { minWidth: '72px', opacity: 0.75 };

const inputStyle: CSSProperties = {
    width: '64px',
    padding: '2px 4px',
    background: 'rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(122, 92, 255, 0.4)',
    borderRadius: '3px',
    color: '#e6e0ff',
    font: '11px/1.4 monospace',
};

const selectStyle: CSSProperties = { ...inputStyle, width: 'auto', maxWidth: '220px' };

function buttonStyle(disabled: boolean): CSSProperties {
    return {
        padding: '3px 8px',
        borderRadius: '4px',
        border: '1px solid rgba(122, 92, 255, 0.55)',
        background: disabled ? 'transparent' : 'rgba(122, 92, 255, 0.2)',
        color: disabled ? '#6f679099' : '#e6e0ff',
        font: '600 11px/1.4 monospace',
        cursor: disabled ? 'not-allowed' : 'pointer',
    };
}

function badgeStyle(isNewAction: boolean): CSSProperties {
    return {
        padding: '1px 5px',
        borderRadius: '3px',
        border: `1px solid ${isNewAction ? 'rgba(255, 176, 92, 0.6)' : 'rgba(92, 255, 176, 0.5)'}`,
        color: isNewAction ? '#ffb05c' : '#5cffb0',
        font: '600 9px/1.5 monospace',
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
    };
}

const NEW_ACTION_HINT =
    'New engine action, added alongside this overlay. A bug reproduced through it might be a bug '
    + 'in the action itself — confirm against a naturally reached board before filing.';
const EXISTING_ACTION_HINT =
    'Pre-existing engine action: ordinary play runs this path every turn, so a repro staged '
    + 'through it exercises production code.';

/** Names the engine action behind a control, and whether it predates the toolkit. */
function VerbBadge({ verb }: { verb: GodVerbId }): ReactNode {
    const meta = GOD_VERBS_BY_ID[verb];
    return (
        <span
            style={badgeStyle(meta.isNewAction)}
            title={`${meta.action} — ${meta.isNewAction ? NEW_ACTION_HINT : EXISTING_ACTION_HINT}`}
        >
            {meta.action} {meta.isNewAction ? 'NEW' : 'ENGINE'}
        </span>
    );
}

// --- Helpers ---

const allUnits = (battle: IBattleState): ReadonlyArray<IBattleEntity> =>
    [...battle.playerParty, ...battle.enemyParty];

const unitOption = (entity: IBattleEntity, battle: IBattleState): string => {
    const side = battle.playerParty.some((e) => e.id === entity.id) ? 'P' : 'E';
    const dead = entity.currentHp <= 0 ? ' †' : '';
    return `[${side}] ${entity.name} ${entity.currentHp}/${entity.maxHp}${dead}`;
};

/** Integer or `null`; the verbs take numbers, so an unparseable field disables its button. */
function parseIntOrNull(raw: string): number | null {
    if (raw.trim() === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.floor(value) : null;
}

/** Vitals drafts are tagged with the unit they were typed for, so switching target re-reads live values. */
interface VitalsDraft {
    entityId: string;
    hp?: string;
    energy?: string;
    tempHp?: string;
}

// --- Panel ---

export default function GodToolsPanel({ presentation }: DebugPanelProps): ReactNode {
    const dispatch = useDispatch();
    const { setOpen } = useDebugUI();

    const battle = useSelector((state: RootState) => state.battle.battle);
    const selectedSourceId = useSelector((state: RootState) => state.battle.selectedSourceId);
    const selectedTargetId = useSelector((state: RootState) => state.battle.selectedTargetId);

    const [targetOverride, setTargetOverride] = useState<string | null>(null);
    const [sourceOverride, setSourceOverride] = useState<string | null>(null);
    const [draft, setDraft] = useState<VitalsDraft>({ entityId: '' });
    const [status, setStatus] = useState<StatusType>('Burn');
    const [stacks, setStacks] = useState('2');
    const [cardId, setCardId] = useState('');
    const [cardSide, setCardSide] = useState<'PLAYER' | 'ENEMY'>('PLAYER');
    const [moveId, setMoveId] = useState('');
    const [lastLine, setLastLine] = useState<string | null>(null);
    const [closeAfterApply, setCloseAfterApply] = useState(false);

    const cards = useMemo(
        () => Object.values(getInflatedProgramRegistry()).sort((a, b) => a.name.localeCompare(b.name)),
        [],
    );

    const isFloating = presentation === 'floating';

    if (!battle) {
        return (
            <p style={{ margin: 0, opacity: 0.7 }}>
                No battle in progress. God tools stage a live board — start a battle first.
            </p>
        );
    }

    const units = allUnits(battle);
    const exists = (id: string | null | undefined) => !!id && units.some((e) => e.id === id);

    // Target: explicit pick wins, then whatever the board has selected, then the first live
    // enemy. Derived rather than stored, so it can never point at a unit that left the board.
    const targetId =
        (exists(targetOverride) && targetOverride)
        || (exists(selectedTargetId) && selectedTargetId)
        || battle.enemyParty.find((e) => e.currentHp > 0)?.id
        || units[0]?.id
        || '';
    const target = units.find((e) => e.id === targetId);

    // Source: the pre-fill is `defaultSourceId` — the opposing party's active unit, biased
    // toward the unit the operator already selected on the board. Overridable, never the target.
    const autoSourceId = defaultSourceId(battle, targetId, selectedSourceId);
    const sourceId = (exists(sourceOverride) && sourceOverride !== targetId ? sourceOverride : null) ?? autoSourceId;
    const candidates = sourceCandidates(battle, targetId);
    const sourceName = sourceId ? units.find((e) => e.id === sourceId)?.name ?? sourceId : null;

    const liveDraft: VitalsDraft = draft.entityId === targetId ? draft : { entityId: targetId };
    const setDraftField = (field: 'hp' | 'energy' | 'tempHp', value: string) =>
        setDraft({ ...liveDraft, entityId: targetId, [field]: value });

    const hpField = liveDraft.hp ?? String(target?.currentHp ?? 0);
    const energyField = liveDraft.energy ?? String(target?.currentEnergy ?? 0);
    const tempHpField = liveDraft.tempHp ?? String(target?.tempHp ?? 0);

    const moves: ReadonlyArray<IMove> = target
        ? target.moves ?? GetMingmingData(target.definitionId).moves ?? []
        : [];
    const chosenMove = moves.find((m) => m.id === moveId) ?? moves[0] ?? null;

    const targetIsEnemy = battle.enemyParty.some((e) => e.id === targetId);

    /** The one mutation path: verb -> setBattleState. Also surfaces the line the verb logged. */
    const run = (verb: (state: IBattleState) => IBattleState) => {
        const next = verb(battle);
        const logged = [...next.logs].reverse().find((line) => line.startsWith(DEBUG_LOG_PREFIX));
        setLastLine(logged ?? null);
        dispatch(setBattleState(next));
        if (closeAfterApply && isFloating) setOpen(false);
    };

    const hpValue = parseIntOrNull(hpField);
    const energyValue = parseIntOrNull(energyField);
    const tempHpValue = parseIntOrNull(tempHpField);
    const stacksValue = parseIntOrNull(stacks);
    const selectedCardId = cardId || cards[0]?.id || '';

    return (
        <div>
            {!isFloating && (
                <p style={{ margin: '0 0 8px', opacity: 0.7 }}>
                    Every control names the engine action it rides.{' '}
                    <span style={badgeStyle(false)}>ENGINE</span> = pre-existing, exercised by ordinary
                    play. <span style={badgeStyle(true)}>NEW</span> = shipped with this overlay; confirm a
                    repro against a naturally reached board before filing it.
                </p>
            )}

            {/* --- Target + source --- */}
            <div style={sectionStyle}>
                <div style={rowStyle}>
                    <span style={labelStyle}>Target</span>
                    <select
                        style={selectStyle}
                        value={targetId}
                        onChange={(e) => { setTargetOverride(e.target.value); setSourceOverride(null); }}
                    >
                        {units.map((unit) => (
                            <option key={unit.id} value={unit.id}>{unitOption(unit, battle)}</option>
                        ))}
                    </select>
                </div>
                <div style={rowStyle}>
                    <span style={labelStyle}>Source</span>
                    <select
                        style={selectStyle}
                        value={sourceOverride && sourceOverride !== targetId ? sourceOverride : ''}
                        onChange={(e) => setSourceOverride(e.target.value === '' ? null : e.target.value)}
                    >
                        <option value="">
                            {autoSourceId
                                ? `auto — ${units.find((e) => e.id === autoSourceId)?.name ?? autoSourceId}`
                                : 'auto — no valid source'}
                        </option>
                        {candidates.map((unit) => (
                            <option key={unit.id} value={unit.id}>{unitOption(unit, battle)}</option>
                        ))}
                    </select>
                    {!sourceId && (
                        <span style={{ color: '#ffb05c' }}>no non-self source available</span>
                    )}
                </div>
                {!isFloating && (
                    <div style={{ opacity: 0.6 }}>
                        Pre-filled with the opposing party's active unit relative to the target — never the
                        target itself, because retaliation and thorns hooks compare source to target.
                    </div>
                )}
                {target && (
                    <div style={{ marginTop: '4px', opacity: 0.8 }}>
                        {target.name}: HP {target.currentHp}/{target.maxHp} · EN {target.currentEnergy} · shield{' '}
                        {target.tempHp} · {target.statusEffects.length === 0
                            ? 'no statuses'
                            : target.statusEffects.map((s) => `${s.type} x${s.stacks}`).join(', ')}
                        {target.currentIntent ? ` · intent: ${target.currentIntent.name}` : ''}
                    </div>
                )}
            </div>

            {/* --- Vitals --- */}
            <div style={sectionStyle}>
                <div style={rowStyle}>
                    <span style={labelStyle}>HP</span>
                    <input
                        style={inputStyle}
                        value={hpField}
                        onChange={(e) => setDraftField('hp', e.target.value)}
                        aria-label="Target HP"
                    />
                    <button
                        type="button"
                        style={buttonStyle(hpValue === null || !sourceId)}
                        disabled={hpValue === null || !sourceId}
                        title={sourceId ? `attributed to ${sourceName}` : 'needs a source'}
                        onClick={() => hpValue !== null && sourceId
                            && run((state) => setHp(state, { entityId: targetId, hp: hpValue, sourceId }))}
                    >
                        Set HP
                    </button>
                    <VerbBadge verb="setHp" />
                    {!isFloating && (
                        <span style={{ opacity: 0.6 }}>
                            a decrease runs damage hooks and death processing; an increase heals
                        </span>
                    )}
                </div>
                <div style={rowStyle}>
                    <span style={labelStyle}>Energy</span>
                    <input
                        style={inputStyle}
                        value={energyField}
                        onChange={(e) => setDraftField('energy', e.target.value)}
                        aria-label="Target energy"
                    />
                    <button
                        type="button"
                        style={buttonStyle(energyValue === null || !sourceId)}
                        disabled={energyValue === null || !sourceId}
                        onClick={() => energyValue !== null && sourceId
                            && run((state) => setEnergy(state, { entityId: targetId, energy: energyValue, sourceId }))}
                    >
                        Set energy
                    </button>
                    <VerbBadge verb="setEnergy" />
                </div>
                <div style={rowStyle}>
                    <span style={labelStyle}>Shield</span>
                    <input
                        style={inputStyle}
                        value={tempHpField}
                        onChange={(e) => setDraftField('tempHp', e.target.value)}
                        aria-label="Target shield"
                    />
                    <button
                        type="button"
                        style={buttonStyle(tempHpValue === null || !sourceId)}
                        disabled={tempHpValue === null || !sourceId}
                        onClick={() => tempHpValue !== null && sourceId
                            && run((state) => setTempHp(state, { entityId: targetId, tempHp: tempHpValue, sourceId }))}
                    >
                        Set shield
                    </button>
                    <VerbBadge verb="setTempHp" />
                    {!isFloating && (
                        <span style={{ opacity: 0.6 }}>energy and shield fire no hooks</span>
                    )}
                </div>
            </div>

            {/* --- Statuses --- */}
            <div style={sectionStyle}>
                <div style={rowStyle}>
                    <span style={labelStyle}>Status</span>
                    <select
                        style={selectStyle}
                        value={status}
                        onChange={(e) => setStatus(e.target.value as StatusType)}
                        aria-label="Status effect"
                    >
                        {Statuses.map((name) => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                    <input
                        style={inputStyle}
                        value={stacks}
                        onChange={(e) => setStacks(e.target.value)}
                        aria-label="Status stacks"
                    />
                    <button
                        type="button"
                        style={buttonStyle(stacksValue === null)}
                        disabled={stacksValue === null}
                        title={sourceId ? `attributed to ${sourceName}` : 'unattributed'}
                        onClick={() => stacksValue !== null && run((state) => applyStatus(state, {
                            targetId, status, stacks: stacksValue, sourceId: sourceId ?? undefined,
                        }))}
                    >
                        Apply
                    </button>
                    <VerbBadge verb="applyStatus" />
                </div>
                <div style={rowStyle}>
                    <span style={labelStyle} />
                    <button
                        type="button"
                        style={buttonStyle(false)}
                        onClick={() => run((state) => clearStatus(state, { entityId: targetId, status }))}
                    >
                        Clear {status}
                    </button>
                    <button
                        type="button"
                        style={buttonStyle(false)}
                        onClick={() => run((state) => clearStatus(state, { entityId: targetId }))}
                    >
                        Clear all
                    </button>
                    <VerbBadge verb="clearStatus" />
                </div>
            </div>

            {/* --- Hand --- */}
            <div style={sectionStyle}>
                <div style={rowStyle}>
                    <span style={labelStyle}>Card</span>
                    <select
                        style={selectStyle}
                        value={selectedCardId}
                        onChange={(e) => setCardId(e.target.value)}
                        aria-label="Card to add"
                    >
                        {cards.map((card) => (
                            <option key={card.id} value={card.id}>{card.name}</option>
                        ))}
                    </select>
                    <select
                        style={selectStyle}
                        value={cardSide}
                        onChange={(e) => setCardSide(e.target.value as 'PLAYER' | 'ENEMY')}
                        aria-label="Hand to add to"
                    >
                        <option value="PLAYER">player hand</option>
                        <option value="ENEMY">enemy hand</option>
                    </select>
                    <button
                        type="button"
                        style={buttonStyle(!selectedCardId)}
                        disabled={!selectedCardId}
                        onClick={() => run((state) => addCardToHand(state, { side: cardSide, dataId: selectedCardId }))}
                    >
                        Add to hand
                    </button>
                    <VerbBadge verb="addCardToHand" />
                </div>
            </div>

            {/* --- Intent + turn --- */}
            <div style={sectionStyle}>
                <div style={rowStyle}>
                    <span style={labelStyle}>Intent</span>
                    <select
                        style={selectStyle}
                        value={chosenMove?.id ?? ''}
                        onChange={(e) => setMoveId(e.target.value)}
                        disabled={moves.length === 0}
                        aria-label="Next intent"
                    >
                        {moves.length === 0 && <option value="">no moveset</option>}
                        {moves.map((move) => (
                            <option key={move.id} value={move.id}>{move.name} ({move.intentType})</option>
                        ))}
                    </select>
                    <button
                        type="button"
                        style={buttonStyle(!chosenMove)}
                        disabled={!chosenMove}
                        onClick={() => chosenMove
                            && run((state) => setIntent(state, { entityId: targetId, move: chosenMove }))}
                    >
                        Set intent
                    </button>
                    <button
                        type="button"
                        style={buttonStyle(false)}
                        onClick={() => run((state) => setIntent(state, { entityId: targetId, move: null }))}
                    >
                        Clear
                    </button>
                    <VerbBadge verb="setIntent" />
                </div>
                <div style={rowStyle}>
                    <span style={labelStyle}>Act now</span>
                    <button
                        type="button"
                        style={buttonStyle(!targetIsEnemy || !target?.currentIntent)}
                        disabled={!targetIsEnemy || !target?.currentIntent}
                        title={targetIsEnemy
                            ? 'resolves the telegraphed intent immediately'
                            : 'EXECUTE_INTENT only resolves for enemy-party units'}
                        onClick={() => run((state) => executeIntent(state, { entityId: targetId }))}
                    >
                        Execute intent
                    </button>
                    <VerbBadge verb="executeIntent" />
                </div>
                <div style={rowStyle}>
                    <span style={labelStyle}>Turn</span>
                    <button type="button" style={buttonStyle(false)} onClick={() => run(skipTurn)}>
                        Skip {battle.activeSide} turn
                    </button>
                    <VerbBadge verb="skipTurn" />
                </div>
                <div style={rowStyle}>
                    <span style={labelStyle}>Kill</span>
                    <button
                        type="button"
                        style={buttonStyle(!sourceId)}
                        disabled={!sourceId}
                        title={sourceId
                            ? `credited to ${sourceName} — XP is awarded to the source's party`
                            : 'KILL_ENTITY requires a source: calculateDeathXp needs a real receiver'}
                        onClick={() => sourceId
                            && run((state) => killEntity(state, { entityId: targetId, sourceId }))}
                    >
                        Insta-kill target
                    </button>
                    <VerbBadge verb="killEntity" />
                </div>
            </div>

            {/* --- Feedback + un-occluding the board --- */}
            <div style={{ ...rowStyle, marginBottom: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.75 }}>
                    <input
                        type="checkbox"
                        checked={closeAfterApply}
                        onChange={(e) => setCloseAfterApply(e.target.checked)}
                    />
                    close after apply
                </label>
                {isFloating && (
                    <button type="button" style={buttonStyle(false)} onClick={() => setOpen(false)}>
                        Close &amp; inspect board
                    </button>
                )}
            </div>
            {lastLine && (
                <div style={{ marginTop: '6px', opacity: 0.8, wordBreak: 'break-word' }}>{lastLine}</div>
            )}
        </div>
    );
}
