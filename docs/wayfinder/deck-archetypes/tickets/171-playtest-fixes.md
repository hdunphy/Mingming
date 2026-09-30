# Ticket 171: Fixes from the 2026-09-29 playtest (Emberfall, kraken_v2 starter)

**Type:** bug fixes and small features. **Status:** RULED by Henry 2026-09-30, in progress.

**Source.** `playtest-results/2026-29-09/firefall-kraken_v2/notes.md`, the run save, the run log and the 11 fight logs. The review is in the project doc `playtest-2026-09-29-firefall-kraken-v2-review.md`.

**Henry's rulings (2026-09-30), in his words:**

1. Unbench fix: *"The fix is good."*
2. Shop: *"It should be frozen with your first visit."*
3. kraken_v2 kit: *"Swap it with another card from its deck, preferably a 2e or 3e card."*
4. EMBER_FUSE: *"Its own animation that shows the status being added after the card maybe?"*
5. Rewards and the end-turn nudge: *"Remove tackle from card rewards and yes build it as described."*

One commit per row, test first ("fails on parent: yes" in the message), authored by Henry, no push.

| Row | What |
|---|---|
| 171a | A benched member can go back into an EMPTY party slot, and CONFIRM warns instead of silently dropping a pick |
| 171b | A shop's shelf is frozen at your first visit: the team you had then decides its cards, not the team you have now |
| 171c | The hover preview names the real source of flat bonus power (Flashover said "+30 SHARP" for 2 Burn) |
| 171d | Stale party text: only the first member brings the 3 generics, and the rule is one per species AND firmware |
| 171e | kraken_v2's start kit swaps its Tackle for a 2e or 3e card from its own deck |
| 171f | EMBER_FUSE gets its own tell, played after the card: the Burn it adds is shown on its own |
| 171g | Tackle leaves the card reward pool |
| 171h | END TURN with a play still available flashes the button and lights the playable cards; a second press ends the turn |

---

## 171a: Unbench into an empty slot

**Bug.** The party was 2 of 3 with Skoll benched. `swapBenchMember` needs someone to trade out, `benchPartyMember` only benches and `recruitIntoParty` only takes a new body, so nothing could put her back. In the loadout editor, clicking her said "pick a slot" but no empty slot was drawn, and CONFIRM closed the editor and dropped the pick without a word.

**Fix.**
- New reducer `unbenchMember(memberId)`: refuses a full party or a member not on the bench. Moves the member to the party and every card they own from the collection to the deck. Cards of theirs already in the deck stay (the editor lets you move them in by hand), so nothing is dealt twice.
- The editor draws each open party slot when someone is benched. It is a button while a benched member is picked up ("bring in"), and plain text otherwise.
- CONFIRM with a pick pending shows a one-line note and stays open. A second press closes and leaves them benched.

## 171b: The shelf is frozen at the first visit

**Bug.** Ticket 142 made the stock static per run (seeded on node and paid refreshes), but the card pool reads the LIVE party. Recruiting, benching or swapping changed the shelf, even with the editor open inside the shop.

**Fix.** The first visit stores the party's species and firmware for that shop (`run.marketParties[nodeId]`), and the card and macro stock are rolled from that snapshot ever after. A paid refresh re-takes the snapshot from the current team, because a refresh is already a new shelf. Optional save field, so old saves load. The balance walker does not write the field and keeps rolling from the live party, so its walks are unchanged.

## 171c: The preview names the bonus

**Bug.** `damagePreview.sharpBonus` is `effectivePower - basePower`, which includes every flat power scaling, and the chip hard-codes "SHARP". Flashover (+15 power per Burn on the target) showed "+30 SHARP". The damage number was right.

**Fix.** The chip names what the bonus reads: `+30 · 2 BURN` for a target-status scaler, `+N SHARP` only when it really is Sharp.

## 171d: Stale party text

RunStart said "one per species. Each brings 8 cards: 5 from its kit and 3 generics". Only the first member brings the 3 generics (recruits bring 5), and duplicate species are legal on a different firmware (`partyBlockFor` blocks only the same species AND firmware). The same wording is in RanchScreen and the Workshop hint. Text only.

## 171e: kraken_v2's start kit

The opener was 4 Tackles in 8 cards: the kit's fifth card is `tackle` and the first member adds 3 generic Tackles. The kit's Tackle becomes a 2e or 3e card from kraken_v2's own deck. The pick is reported to Henry for review. The biome-0 enemy ladder mirrors the start kit shape, so fight one is re-read after the change.

## 171f: EMBER_FUSE's own tell

EMBER_FUSE works (it fired 4, 4 and 2 times in the three fights Skoll played), but its Burn merged into the card's own status animation. It gets its own beat, played after the card: the target shows "+1 Burn" with the fuse's colour and name.

## 171g: Tackle leaves the rewards

`tackle` (the generic hit) is no longer offered as a card reward. The shop is unchanged.

## 171h: The END TURN nudge

Henry's note: *"It would be great to highlight or alert the user if they can still make a play. Something noticeable but not intrusive like a popup or anything. Just like a flash on the button and then the card that is playable lights up."*

Pressing END TURN while any card in hand can still be played by someone (enough energy, not blocked) flashes the button and lights the playable cards, and does not end the turn. A second press ends it. No popup.
