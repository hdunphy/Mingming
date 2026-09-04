# Workshop node: assemble a blueprint mid-run, reflash an OS (ticket 14)

- Type: wayfinder:task
- Status: closed
- Assignee: agent
- Blocked by: [06](06-run-data-model.md), [12](12-rewards-refit.md), [20](20-ranch-minimal.md)
- Phase: Vertical Slice

## Deliverable

A mid-run node where the player spends a BLUEPRINT **plus scrap** (**RULED by Henry 2026-08-21** in [ticket 06](06-run-data-model.md): a blueprint alone at the ranch, a blueprint **and** scrap at a mid-run workshop — which makes both `vision.md`'s "spend SCRAP to assemble" and `economy-session.md`'s "blueprints only" literally true of the place each was describing. The consequence to design around: **mid-run recruiting now competes with the marketplace for the same run currency**, so growing the team vs sharpening the deck is a real route decision, while between runs a blueprint is always spendable. **This ticket owns the scrap number** — ticket 06 deliberately did not set it) to assemble a species into the party (stats roll at assembly; joins with its start kit per ticket 08; species clause enforced), or spends a blueprint to reflash a party member's OS. Party grows 1 → 2 → 3 here and only here ("recruiting IS drafting"). Reuse `SynthesisLab`'s assembly flow and `FirmwareTerminal`'s reflash flow.

## Done when

A run can go from 1 to 3 members via workshops, the new member's cards merge into the shared deck, and the assembled individual persists to the ranch.

## Resolution

**Closed 2026-08-22.** A run grows 1 → 2 → 3 here and only here. Suite **1163 → 1235**, `tsc -b`
clean, build green.

### The number this ticket owns: `WORKSHOP_ASSEMBLY_SCRAP = 75`

Derived, not picked, and the arithmetic is in the test so retuning fails the test rather than
falsifying the comment:

1. Run income **450** (ticket 12's low anchor; ticket 13's conservative convention).
2. Ticket 07 guarantees one marketplace **and** one workshop per biome, so both see the player three
   times. A market visit's scrap = 450 / 3 = **150**.
3. `RECRUITS_PER_RUN` = `PARTY_SIZE - 1` = **2** (the ruled 1 → 2 → 3).
4. Growing the team costs one market visit: 150 / 2 = **75 per recruit**.

That is deliberately the same sentence ticket 13 wrote about removal, so the run's three sinks are
quotable against each other: **of the three market visits a run earns, one buys the team, one strips
the filler, one buys cards.** The median rewardable card prices at 48 (computed from the registry and
asserted), so **one recruit ≈ 1.6 cards' worth of market, and the two together are three cards not
bought.** Bounds argued in the file: not ≤ 30 (a rounding error, no competition), not ≥ 150 each
(300 of 450 eats the shop, and it is unpayable by the solo party that reaches the biome-1 workshop
earning ~11 a wild). Checked against both 450 and 500 at ticket 13's ±15% tolerance.

### `WORKSHOP_REFLASH_SCRAP = 40` — flagged as a READING

Ticket 06's ruling names **assembly**. It is silent on reflash, so this is an interpretation:

- *Narrow* (reflash is free at a workshop, blueprint only) leaves the game's one mid-run upgrade with
  no opportunity cost.
- *Wide* takes the ruling's **mechanism** — a mid-run transaction spends run currency so it competes
  with the market — and applies it. A reflash re-aims both `rewardCardPool` and `rollMarketStock` for
  the rest of the run, which is a shop-sized effect and should be paid out of the shop's money.

40 is roughly half a recruit (37.5, rounded onto the market's 8-scrap grid), pinned above
`REMOVAL_PRICE` so the sink stays the cheap button and below the median card. **If you read it
narrowly, set the constant to 0** — the price is a payload, never a literal in the screen or reducer.

### `WORKSHOP_REMOVAL_PRICE = REMOVAL_PRICE` (your lean, taken)

Re-exported rather than re-declared, so a retune moves both. Cheaper here would falsify ticket 13's
derivation without retuning it — players would simply do all five removals at workshops — and would
make the market's button a decoy. Its real job is to give the node a floor: a blueprint drops from
~20% of wilds, so most workshops are walked into empty-handed, and removal is what stops this being
the placeholder the ticket exists to delete.

### Dispatch ordering: ranch first, always — and the argument is a test

Assembly writes both slices and no reducer can do that, so it is two dispatches. The order was
chosen by asking which crash window hurts less, and both are executed against the real store and
handed to `reconcileLoadedState` to adjudicate:

- **Ranch first** (chosen): blueprint spent, individual on the roster, scrap not taken, party
  unchanged. That is *the ranch transaction, exactly* — the player keeps the individual permanently
  and fields it next run. `reconcileLoadedState` **resumes** the run.
- **Run first**: scrap spent, cards owned by nobody, `partyIds` naming a member the roster does not
  have. `reconcileLoadedState` is **obliged** to discard the run
  (`party-references-missing-member`) — forty minutes lost instead of 75 scrap.

The residual window (blueprint spent, run not charged, because the run turned out not to afford the
scrap) is checked *before* the irreversible half and is benign for the same reason: it is the ranch
transaction.

### Also worth knowing

- **The recruit's stat roll comes from `nodeSeed(run, node, 'workshop')`, not a fresh roll** — unlike
  the ranch bay. The workshop is a node's contents, so ticket 07's re-roll rule and ticket 23's
  resume both apply: a resumed run stands in the same workshop with the same individual on offer, and
  walking away and back re-rolls it at the price of re-fighting the wilds between. The roll is never
  previewed, so it is a detour rather than a scum button.
- **The species clause cannot live in the run reducer** — species are a ranch fact. It is enforced by
  `planRecruit` returning `null` (so nothing dispatches at all) and again at load by
  `reconcileLoadedState`. The reducer enforces everything the *run* can see: affordability, integral
  prices, `PARTY_SIZE`, duplicate party id, duplicate card instance id. A dangling party id still
  counts toward the ceiling, so a torn run cannot field four.
- The reflash's read-back keys on **the blueprint count falling**, not on the OS reading as the
  target — after a double click the OS already reads as the target and "did it change?" answers yes.
- `engine/party.ts`'s note predicted ticket 14 would be `legalParty`'s first caller. It was not — the
  workshop uses `partyBlockFor` — so the note now records the correction rather than keeping a false
  claim. **`legalParty` still has no production caller.**


## Amendments from tickets 07/08 (Henry, 2026-08-21)

Henry leans toward ALSO allowing card removal at workshops — decide the price here (same as market, or blueprint-cheap). A recruit joins with 4 cards: 3 `startKit` + 1 generic (ticket 08).
