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
 * **Ticket 11 removed one of those three callers and did not replace it.** `IRanchState` has no
 * `activeParty`, so `gameSlice.setActiveParty` is gone; a party is now assembled at run start
 * (`RunStart`, via `partyBlockFor`) and checked again at load (`reconcileLoadedState`, which spells
 * the two laws out itself because it also has to decide *what to discard* when they fail). That
 * leaves `legalParty` with no production caller today — see its own note for why it stays.
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
export type PartyBlock = 'party-full' | 'duplicate-build';

/** The minimum a caller has to know about a member for these rules to apply. */
export interface PartyMember {
    readonly id: string;
    readonly definitionId: string;
    /**
     * The firmware this individual runs. Part of the duplicate clause since Henry's ruling of
     * 2026-09-05 — see `partyBlockFor`.
     *
     * Optional because two callers legitimately have no OS to give: `reconcileLoadedState`'s
     * synthetic rows for ids it could not resolve, and any test fixture written before the ruling.
     * Undefined compares as its own value, so two OS-less members of one species still collide —
     * the old rule, kept for the states that cannot express the new one.
     */
    readonly activeOS?: string;
}

/**
 * Can this member join? Returns the reason it cannot, so a screen can say it out loud — a silently
 * dropped click is indistinguishable from a bug to whoever is holding the controller.
 *
 * A member **already in the party** is never blocked: that click removes it.
 *
 * # THE DUPLICATE CLAUSE IS SPECIES + FIRMWARE — RULED by Henry, 2026-09-05
 *
 * *"You can't add the same mingming, but with a different OS. I would like to add kraken_v2 to my
 * kraken_v1."*
 *
 * The old clause was species alone, and it was written when a species WAS a build: one stat line,
 * one deck, one behaviour. It is not any more — ticket 61 gave every OS its own five-card engine,
 * so `kraken_v1` (ABYSSAL_INK: draw outside the draw phase applies Dazed) and `kraken_v2`
 * (TIDAL_CRUSH: expensive Water cards hit 30% harder) share a stat block and nothing else that
 * matters at the table. Refusing the pair enforced a rule about ART where the rule was about
 * VARIETY, and it cost the player the one axis of team-building the roster actually offers.
 *
 * What the clause still forbids is the thing it was always aimed at: two of the SAME build, which
 * is a team with one idea and two bodies. That is why this reads both fields rather than dropping
 * the check — and why the reason is now named `duplicate-build`, because "duplicate species" is
 * exactly the thing that is legal.
 *
 * `reconcileLoadedState`'s Law 2 enforces the same clause at load. The two must agree or a party
 * this function allows is a save the loader throws away.
 */
export function partyBlockFor(
    member: PartyMember,
    party: ReadonlyArray<PartyMember>,
): PartyBlock | null {
    if (party.some((m) => m.id === member.id)) return null;
    if (party.some((m) => m.definitionId === member.definitionId && m.activeOS === member.activeOS)) {
        return 'duplicate-build';
    }
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
 *
 * **No production caller since ticket 11**, which deleted `setActiveParty` and the save-time
 * projection that were its two users.
 *
 * Ticket 14 was expected to be the caller that brought it back — the workshop node grows the party
 * 1 → 2 → 3 mid-run — and it turned out to want `partyBlockFor` instead. That is worth recording
 * rather than quietly fixing the prediction: the workshop adds **one candidate at a time and has to
 * explain a refusal on screen**, which is the question `partyBlockFor` answers; `legalParty`'s
 * trim-a-whole-list shape answers a question nobody is asking yet. It stays for the same reason as
 * before — the next thing that builds a party *from a list of ids* needs exactly this — and its
 * behaviour is pinned by `party.test.ts` so it cannot rot quietly while it waits.
 */
export function legalParty(
    ids: ReadonlyArray<string>,
    roster: ReadonlyArray<PartyMember>,
): string[] {
    const byId = new Map(roster.map((m) => [m.id, m]));
    // Species + firmware since 2026-09-05, the same key `partyBlockFor` uses — a trim that dropped
    // a legal `kraken_v2` would be this file disagreeing with itself.
    const seenBuilds = new Set<string>();
    const accepted: string[] = [];
    for (const id of ids) {
        const member = byId.get(id);
        if (!member) continue;
        const build = `${member.definitionId}::${member.activeOS ?? ''}`;
        if (seenBuilds.has(build)) continue;
        seenBuilds.add(build);
        accepted.push(id);
        if (accepted.length === PARTY_SIZE) break;
    }
    return accepted;
}
