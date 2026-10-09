/**
 * TICKET 162a — the species POOLS of collection v2, and the run pool they add up to.
 *
 * # WHAT A POOL IS
 *
 * 161 §2 splits a species' cards in two. The **kit** is what it opens with: eight or nine cards,
 * five of them the start kit, and no consume — *"the consume and the second lane are found in the
 * run"*. The **pool** is that second half: the six cards a run can put in front of you for this
 * OS, through a shop, a reward screen or a gym.
 *
 * So a pool is not flavour text. It is the answer to the complaint that started ticket 162 —
 * Henry, 2026-09-22: *"My latest playtest showed they were not exciting and it is still hard to
 * build decks."* A deck is hard to build when the shop offers you a hundred and eighty cards from
 * twenty species you cannot field. Here, an OS's six pool cards are the ones that finish the deck
 * it opened with.
 *
 * # WHY IT IS A FILE AND NOT A FIELD ON `MingmingRegistry`
 *
 * `mingmingRegistry.ts` is 63 KB of species literals, and only the twelve Early-Access OS have
 * pools — the other twenty species are post-EA (Henry, 09-21). A `pools` field would have to be
 * optional on every species and absent on most of them, which reads as "not filled in yet" rather
 * than "out of scope". A separate table says the scope out loud.
 *
 * Regenerated from `collection-v2/collection.json` by `scratch/t162a_build.py`; the collection is
 * the design source of truth and this is its shipped half.
 */

/** The six pool cards for each Early-Access OS — the cards a run can offer for that deck. */
export const SPECIES_CARD_POOLS: Readonly<Record<string, ReadonlyArray<string>>> = Object.freeze({
    // TICKET 207 (Henry, 2026-10-08: "These leader cards can appear and are all rare cards"): each of
    // the nine gym-leader Instincts adds its leader card (Rare) as a seventh pool card.
    fenrir_v1: ['sun_devourer', 'fury_strike', 'blood_rite', 'flare_burst', 'core_overclock', 'howl', 'gleipnir_breaks'],
    fenrir_v2: ['inferno', 'molten_core', 'ember_ward', 'cinder_armor', 'ash_communion', 'heat_wave', 'flame_wave'],
    skoll_v1: ['pack_tactics', 'snarl', 'battle_rhythm', 'reactive_plating', 'core_overclock', 'crimson_draw'],
    skoll_v2: ['wildfire', 'inferno', 'thermal_overload', 'scald', 'ash_communion', 'cinder_armor', 'chase_the_sun'],
    ratatoskr_v1: ['echo_chamber', 'hoofbeat', 'rejuvenation', 'mend', 'verdant_ward', 'deep_scan', 'rumor'],
    ratatoskr_v2: ['pile_on', 'hexbloom', 'thorn_tithe', 'echo_chamber', 'crippling_vine', 'snarl'],
    jormungandr_v1: ['corrosive_leak', 'scavenge_data', 'feedback_loop', 'hydro_blast', 'tide_pool', 'tidal_battery'],
    jormungandr_v2: ['venom_glut', 'contagion', 'spreading_rot', 'blightbloom', 'nettle_sting', 'riptide', 'coil_and_strike'],
    kraken_v1: ['ink_cloud', 'scavenge_data', 'short_circuit', 'feedback_loop', 'deep_scan', 'static_ward', 'deep_current'],
    kraken_v2: ['maelstrom', 'tidal_wave', 'overclock_core', 'tidal_battery', 'ink_cloud', 'heat_wave', 'pressure_front'],
    huldra_v1: ['verdant_ward', 'iron_bark', 'crippling_vine', 'mend', 'static_ward', 'pollen_cloud', 'bewitch'],
    huldra_v2: ['blightbloom', 'nettle_sting', 'reactive_plating', 'verdant_ward', 'mend', 'iron_bark', 'smoldering_bark'],
});

/**
 * The cards that belong to no kit — 162 §1's "run-only" list, the neutral half of the run pool.
 *
 * These are the answers a party cannot bring with it: the two ramp daemons, the hate daemons, and
 * `tidal_battery`. They are in the pool precisely BECAUSE no species owns them; a pool rule that
 * only ever offered a species its own cards would make a counter unbuyable for the party that
 * needs one, which is the failure ticket 69 closed for the marketplace's off-pool slot and is not
 * worth reopening here.
 *
 * **`slander` (ticket 167d, Henry's answer to the gap it opened, 2026-09-28).** It became a Nature
 * card and left Kraken v1's deck, which was its only way into the run pool; no species pool names
 * it. It is a run-only card so a Nature party (Ratatoskr, Huldra) can still be offered it and a
 * Water party cannot, because the element rule still filters the pool.
 *
 * Four of the original six are also named in a species pool (`static_ward` by kraken_v1 and huldra_v1,
 * `riptide` by jormungandr_v2, `tidal_battery` by two Water OS). That overlap is deliberate and
 * harmless: the run pool is a UNION, and a card being wanted by a deck AND available to everyone
 * is exactly the shape of a counter that one archetype leans on.
 */
export const RUN_ONLY_CARDS: ReadonlyArray<string> = Object.freeze(['tidal_battery', 'overclock_core', 'short_fuse', 'riptide', 'short_circuit', 'static_ward', 'slander']);

/**
 * The marketplace's guaranteed neutral slot — ticket 69's list, and why it is in the run pool.
 *
 * These are the answers a party cannot bring with it under the SPECIES rule: `hamstring` against an
 * escalating Strengthened aura, `deep_scan` for a deck with no draw, the two Tidewrack flow taxes.
 * Ticket 69 made them a reserved slot so a 33-card draw could not crowd them out, and the
 * marketplace has a long note on the reasoning; this is the same list, moved here so the v2 pool
 * gate can see it.
 *
 * **It is in the pool ON PURPOSE.** Five of the eleven are v1 cards collection v2 does not name
 * (`hamstring`, `adrenaline`, `harden_daemon`, `scrubber`, `drip_feed`, and the two Skills
 * `discharge`/`vent`). Narrowing them away was tried first and it broke ticket 69's own guarantee —
 * *"a solo of any launch species can be offered hamstring"* — leaving the guaranteed slot with card
 * flow and two flow taxes and no buff answer at all. Shipping an Early-Access playtest with no
 * counter to a Strengthened aura is a worse outcome than eleven v1 cards remaining buyable in one
 * reserved slot per shop.
 *
 * FOR 162b: collection v2 has no replacement for `hamstring`. Give the neutral slot a v2 buff
 * answer and these ids can leave.
 */
export const NEUTRAL_UTILITY_IDS: ReadonlyArray<string> = Object.freeze([
    'hamstring', 'adrenaline', 'deep_scan', 'harden_daemon',
    'riptide', 'short_circuit',
    'reactive_plating', 'discharge', 'scrubber', 'vent', 'drip_feed',
    // TICKET 207 (Henry, 2026-10-08): Emberfall's Burn answers, printed for the gym's new team.
    'quench', 'sindris_forge',
]);

/**
 * Collection v2's whole run pool: every kit card, every species pool card, every run-only card.
 *
 * Built from the registry rather than written out, so it cannot drift from the decks it describes.
 * `NEUTRAL_UTILITY_IDS` is folded in because the marketplace's reserved slot offers it whatever the
 * pool says, and a card that is offerable has to be IN the pool or the two disagree.
 * It is deliberately a LIST-BACKED set and not "everything in `ProgramRegistry`": the registry
 * still holds the 170 v1 entries the twenty post-EA species field (see `archive/README.md`), and
 * the whole point of the pool is that an Early-Access run never meets them.
 */
export function v2RunPool(deckIdsForOS: (osId: string) => ReadonlyArray<string>): ReadonlySet<string> {
    const ids = new Set<string>([...RUN_ONLY_CARDS, ...NEUTRAL_UTILITY_IDS]);
    for (const [osId, pool] of Object.entries(SPECIES_CARD_POOLS)) {
        for (const id of pool) ids.add(id);
        for (const id of deckIdsForOS(osId)) ids.add(id);
    }
    return ids;
}
