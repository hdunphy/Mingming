/**
 * The party rules — ticket 20 (steam-release map).
 *
 * # WHY THIS IS ITS OWN MODULE
 *
 * "No duplicate species per team" is a **standing law** (map § Notes). Until ticket 20 it was
 * enforced in exactly zero places: `debug/balance/teamComps.ts` recorded it as a construction
 * assumption and called it "a design question for Henry", the gap audit (§5) confirmed no game code
 * checked it, and `reconcileLoadedState` (ticket 23) could only discard a loaded *run* after the
 * fact. Nothing stopped a player fielding two krakens.
 *
 * Making it real means enforcing it in three places at once — the reducer that sets the party, the
 * load path that rehydrates one, and the screen that has to explain a refusal to the player. Three
 * hand-written copies of one rule is how a rule rots, so it lives here once and they all call it.
 *
 * # THE RULE
 *
 * A party is at most `PARTY_SIZE` members, each of which exists in the roster, and no two of which
 * are the same species. Note what it does *not* say: the **roster** may hold as many krakens as you
 * like. Re-assembly is the re-roll (`vision.md`: "two krakens are not the same kraken"), so a
 * collection full of one species is the intended end state — only fielding them together is
 * illegal.
 *
 * Engine code: no React, no Redux, no imports from `src/ui` or `src/debug`.
 */

/** Ruled at three by `vision.md`'s 3v3; the draw formula in `types.ts` assumes it too. */
export const PARTY_SIZE = 3;

/** Why a roster member cannot join the party right now. `null` means it can. */
export type PartyBlock = 'party-full' | 'duplicate-species';

/** The minimum a caller has to know about a member for these rules to apply. */
export interface PartyMember {
    readonly id: string;
    readonly definitionId: string;
}

/**
 * Can this member join? Returns the reason it cannot, so a screen can say it out loud — a silently
 * dropped click is indistinguishable from a bug to whoever is holding the controller.
 *
 * A member **already in the party** is never blocked: that click removes it.
 */
export function partyBlockFor(
    member: PartyMember,
    party: ReadonlyArray<PartyMember>,
): PartyBlock | null {
    if (party.some((m) => m.id === member.id)) return null;
    if (party.some((m) => m.definitionId === member.definitionId)) return 'duplicate-species';
    if (party.length >= PARTY_SIZE) return 'party-full';
    return null;
}

/**
 * Reduce a list of roster ids to a legal party: members must exist, species must not repeat, and
 * at most `PARTY_SIZE` survive.
 *
 * **Trims rather than rejects.** An illegal list keeps the first member of each species and drops
 * the rest, instead of failing the whole assignment. Rejection would leave a reducer with no way to
 * report what went wrong (it cannot throw, and the store has no error channel), and the screens
 * check `partyBlockFor` before dispatching anyway — so trimming is the honest last line of defence
 * rather than the primary UI.
 */
export function legalParty(
    ids: ReadonlyArray<string>,
    roster: ReadonlyArray<PartyMember>,
): string[] {
    const byId = new Map(roster.map((m) => [m.id, m]));
    const seenSpecies = new Set<string>();
    const accepted: string[] = [];
    for (const id of ids) {
        const member = byId.get(id);
        if (!member) continue;
        if (seenSpecies.has(member.definitionId)) continue;
        seenSpecies.add(member.definitionId);
        accepted.push(id);
        if (accepted.length === PARTY_SIZE) break;
    }
    return accepted;
}
