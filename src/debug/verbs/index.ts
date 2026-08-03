/**
 * The god-tool verb surface. Import from here rather than reaching into the modules,
 * so the panel (and any future batch-sim caller) has one entry point.
 */

export {
    DEBUG_LOG_PREFIX,
    DEBUG_NO_OP_SUFFIX,
    GOD_VERBS,
    GOD_VERBS_BY_ID,
    addCardToHand,
    applyStatus,
    clearStatus,
    executeIntent,
    killEntity,
    setEnergy,
    setHp,
    setIntent,
    setTempHp,
    skipTurn,
    unitLabel,
} from './godVerbs';

export type {
    AddCardToHandArgs,
    ApplyStatusArgs,
    ClearStatusArgs,
    ExecuteIntentArgs,
    GodVerbId,
    GodVerbMeta,
    KillEntityArgs,
    SetEnergyArgs,
    SetHpArgs,
    SetIntentArgs,
    SetTempHpArgs,
    SourceRequirement,
} from './godVerbs';

export { defaultSourceId, sideOf, sourceCandidates } from './sourceDefaults';
export type { BattleSide } from './sourceDefaults';
