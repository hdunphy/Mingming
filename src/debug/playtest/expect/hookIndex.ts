/**
 * Every data hook in `hooks.json`, by id and by owner, with what it writes to the combat log and what
 * kinds of effect it has (TICKET 193c).
 *
 * Read from the data, not from the compiled hooks, because the playtester needs two things the
 * compiled form hides: the line a hook logs, and which of the prediction keys it can change.
 */
import HOOKS from '../../../engine/data/lib/hooks.json';

export interface DataHookAction {
    readonly type: string;
    readonly text?: string;
}

export interface IndexedHook {
    readonly id: string;
    /** The firmware / Aura / Driver this hook belongs to, as the game names it (`ABYSSAL_INK_SYS`). */
    readonly ownerName: string;
    readonly actions: ReadonlyArray<DataHookAction>;
}

interface RawEntry { readonly name?: string; readonly hooks?: ReadonlyArray<{ readonly id: string; readonly do?: ReadonlyArray<DataHookAction> }> }

const byId = new Map<string, IndexedHook>();
const byOwner = new Map<string, IndexedHook[]>();
for (const [key, entry] of Object.entries(HOOKS as unknown as Record<string, RawEntry>)) {
    const owned: IndexedHook[] = [];
    for (const hook of entry.hooks ?? []) {
        const indexed: IndexedHook = { id: hook.id, ownerName: entry.name ?? key, actions: hook.do ?? [] };
        byId.set(hook.id, indexed);
        owned.push(indexed);
    }
    byOwner.set(key, owned);
}

export const hookById = (id: string): IndexedHook | undefined => byId.get(id);

/** The hooks of one `hooks.json` entry: a firmware (`kraken_v1`), an Aura or a Driver. */
export const hooksOfOwner = (owner: string): ReadonlyArray<IndexedHook> => byOwner.get(owner) ?? [];
