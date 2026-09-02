# Track A: the 18-card deck is the strongest deck in the game, and everything else is dilution

**Date:** 2026-09-02 · **Ticket:** [77](../tickets/77-player-progression-arms.md) Track A · 8 arms, 1,440 battles
**Conditions:** n=60 per cell, all three gauntlet cells, `--matchup favourable`, **bare arm grades**
(75 ruling 2), Rally live, paired seeds, one tree. Bare rows re-taken on the day as the ticket asks.

**Report only. Nothing has moved.** `--deck` is a harness flag; no card, deck list or registry entry
was edited.

---

## 1. The headline

Ticket 77 opened on the observation that every lever measured across 67–76 was boss-side, because the
graded arm fields a **run-start** player against a **fully-built** boss. Track A puts the player side
in the arm for the first time. The answer is not the one the ticket expected.

| arm | deck | Rootfall | vs bare | Emberfall | vs bare |
|---|---|---|---|---|---|
| **bare — the grading arm** | 18 | **27.7%** | — | **62.4%** | — |
| A1 — full tuned decks | 25–28 | 19.0% | −8.7 · p = 0.15 | 40.3% | −22.1 · **p = 0.0046** |
| A2 — engine +3 | 27 | 13.0% | −14.7 · **p = 0.015** | 33.9% | −28.5 · **p = 0.00006** |
| A3 — bare + 3 **blanks** | 21 | 18.5% | −9.2 · p = 0.096 | 31.1% | −31.3 · **p = 0.00003** |
| *(75) — bare + 3 counters* | 21 | 11.1% | −16.6 · **p = 0.0002** | 44.0% | −18.4 · **p = 0.023** |

**Every arm that adds cards loses, at both gyms, without exception.** Completing the engine loses.
Adding the next three engine cards loses. Adding three blank generics loses. Adding three
counter-cards loses. **At every deck size tried, the 18-card run-start deck is the best deck
measured**, and at Emberfall every one of those losses is statistically significant.

**A2 is the arm that matters most for design, and it is the worst of the four.** "The next three
cards of your own engine" — precisely what a pick track weighted toward your missing tuned cards
would deal — costs **14.7 points at Rootfall and 28.5 at Emberfall**. The targeted version of
progression is worse than the wholesale version (A1) at both gyms.

---

## 2. A1 — kit completion is a downgrade, and the instruments say why

Per fight, bare → full tuned:

| | Rootfall | Emberfall |
|---|---|---|
| payoff casts / fight | 1.65–2.03 → **2.60–2.80** | 2.13–2.52 → **2.98–3.70** |
| dead cards | 3.9–5.4% → **10.9–11.7%** | 5.1–8.0% → **13.0–18.1%** |
| player damage / turn | 42.0–44.4 → **37.0–40.8** | 41.7–56.6 → **36.2–49.5** |
| enemy damage / turn | 33.0–35.9 → 32.5–36.1 | 26.9–34.7 → 28.4–36.3 |

**The engine fires more often and the deck deals less damage.** Payoff casts rise by ~40%, exactly as
"complete your engine" promises — and output falls anyway, because the tuned list adds three to four
times as many cards as it adds engine pieces. The enemy's rate barely moves, so this is a pure loss
of player tempo rather than a longer fight.

The start kit **is** the engine: five tagged cards, no filler (`startKitIdsFor`, ticket 60 — *"there
is no front and back any more: four tags, all of them"*). The tuned per-OS list is that engine plus
the filler that smooths it out for an enemy that plays a nine-card deck from turn one. Handing the
player the whole list does not complete an engine; it buries one.

---

## 3. A3 — the dilution control, and the question ticket 76 could not close

Ticket 76 §2.3 ended on two gyms with opposite toolbox curves and no mechanism that fitted both. A3
replaces the three counter-cards with three copies of `water_slap` — same deck size, zero situational
text — and it resolves that, though not the way the ticket predicted.

| | bare | +3 blanks | +3 counters |
|---|---|---|---|
| Rootfall | 27.7% | **18.5%** | 11.1% |
| Emberfall | 62.4% | **31.1%** | 44.0% |

**At Rootfall the counters cost 7 points more than blanks; at Emberfall they cost 13 points LESS.**
So the counters are not uniformly bad cards and never were — at Emberfall they are meaningfully
*better* than a vanilla attack in the same slot; they simply do not pay for the slot at all.

**Deck size is the lever. Card quality is a second-order correction on top of it.** Three cards
added to an 18-card deck cost between 9 and 31 points of clear rate depending on the gym, and which
three cards they are moves that by about a third either way.

**And the mechanism is not dead draws.** The blanks arm has *fewer* dead cards than bare (Rootfall
3.0% vs 4.1%; Emberfall 4.4% vs 5.6%) — `water_slap` is always playable. Its damage per turn simply
falls, 44.4 → 40.9 and 46.3 → 42.1. The added cards **displace better cards in the draw**, whether or
not they are situational. That is a simpler story than the one tickets 75 and 76 were reaching for,
and it fits both gyms without an epicycle.

---

## 4. What this means for the ticket's premise

Ticket 77's framing was that the player side has never been in the graded arm, and that the fights
look hard because the player is measured at run start. That framing is right. **The conclusion it
anticipated is wrong**: the run-start deck is not an impoverished version of a finished one, it is
the most concentrated deck the game currently offers, and every progression path measured so far
makes it worse.

Which relocates the design question rather than answering it:

- **"More cards" is not progression.** Any reward track that hands the player cards — picks, buys,
  the toolbox — is currently a tax unless the cards it hands beat the *average* card already in the
  deck by more than the dilution costs. At an 18-card deck that bar is high.
- **Removal may be worth more than addition.** Nothing here measures it, and nothing should assume
  it, but the shape of every arm above points at deck *thinning* as the untested direction.
- **Ticket 60's ruled player edges are still untested.** Macros (Track B1) and player Drivers
  (Track B2) add power **without adding cards**, which is now the interesting property rather than an
  incidental one. A1's result raises their value rather than lowering it — they are the only measured
  route to player power that does not dilute.

**No mechanism beyond dilution is asserted**, and Track A cannot separate "the added card is worse
than the average card" from "a smaller deck cycles its engine faster". Both predict everything above.
Distinguishing them needs a deck-size arm that holds card quality fixed — bare plus three *duplicates
of the deck's own cards* — which is one more arm and is not run.

---

## 5. For Henry's session

1. **The 18-card deck outperforms every larger deck measured**, including the completed tuned lists.
   Before any pick-track design, this needs a ruling: is the start deck accidentally the strongest
   configuration, and if so is that a bug in the tuned lists, in `minimumActiveDeck`, or in what
   "progression" should mean in this game?
2. **The toolbox question is answered as far as measurement can take it** (§3): dilution dominates,
   the printings are a second-order correction, and at Emberfall the counters beat blanks. There is
   nothing here that a reprice fixes.
3. **Track B is now the more interesting half of this ticket, not the fallback.** Macros and Drivers
   are the only player-side power that does not cost a card slot.

## 6. Reproducing

```
npx vite-node src/debug/balance/runRunGate.ts --bands gauntlet --gym <gym> \
  --matchup favourable --iterations 60 [--deck full|engine-plus-3|bare-plus-generics]
```

Raw reports in `77-runs/`. Every cell line carries the ticket's new diagnostics —
`payoff` (casts of a `scaling` card per fight, the engine assembling), `dead` (share of cards that
reached hand unplayed), `deck` (size), and both damage rates.

**A determinism note worth keeping.** The re-taken Rootfall bare row came back **byte-identical** to
research/76's — all 180 battles, same wins, same losses — which is the seed contract holding and
confirms that adding telemetry collection perturbed nothing. Re-taking a bare row is still correct
whenever the tree moved; this is the evidence that it is a no-op when it has not.
