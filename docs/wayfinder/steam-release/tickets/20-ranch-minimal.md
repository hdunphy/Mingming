# Ranch-minimal: roster, blueprint-only assembly and reflash, species clause, no XP (ticket 20)

- Type: wayfinder:task
- Status: closed
- Assignee: agent
- Blocked by: [06](06-run-data-model.md), [21](21-leveling-freeze.md), [23](23-save-v4.md)
- Phase: Vertical Slice

## Deliverable

Bring the existing ranch screens in line with the rulings: `SynthesisLab` assembly costs ONE blueprint (delete the flat `compileCost = 100` scrap), shows the blueprint COUNT per species and explains re-assembly as the re-roll; `FirmwareTerminal` reflash costs one blueprint (delete `OS_SWAP_SCRAP_COST`); `RosterTerminal` drops the XP bar and shows the individual's stat roll; party selection enforces **no duplicate species** (the 3v3 species clause — missing in code today, only documented in `teamComps.ts`); the deck builder (`DeckTerminal`) is removed from the ranch — cards are run-scoped, the team is the deck (keep it reachable as a debug/codex viewer if useful). Tab shell: Ranch replaces Hub/Terminal/Deck/Lab/Relics.

## Done when

The ranch has no scrap, no XP, no deck builder, and no duplicate species in a party; tests updated.

## Resolution

**Closed 2026-08-21.** The ranch is one screen, costs one currency, and enforces the species
clause. Suite **916 → 939**, `tsc -b` clean, build green.

### The economy change underneath it

`IPlayerSave.blueprints` went from `ReadonlyArray<IBlueprint>` **deduplicated on
`architectureId`** to `BlueprintCounts = Record<string, number>`. That was the real work; the
screens fell out of it. v3's dedup made sense for a *permission* ("you may build this") and is
incoherent for currency — a second kraken blueprint has to be a second kraken. `IBlueprint` is
deleted outright: its `name` was `${definition.name} Blueprint` (derivable) and its `compileCost`
was a flat 100 scrap that this ticket removes.

Consequences, all landed: `addBlueprint` takes a species id and **stacks**; reward bundles carry
`ReadonlyArray<string>`; the ranch half of `ranchProjection` became the identity (it was the
lossier of that file's two edges — now there is one).

### Assembly and reflash are both one blueprint, no scrap

New atomic reducer **`assembleMingming(member)`** spends one blueprint of the species and pushes to
the roster in a single step. The old flow was `dispatch(spendScrap(cost))` then
`dispatch(addToRoster(mm))` with the affordability check living only in the component — anything
between them produced a free unit. `swapOS` is re-priced the same way and `OS_SWAP_SCRAP_COST` is
gone.

The ranch now has **no scrap economy at all**, which is the point: scrap is run-scoped, so a ranch
that charges it is charging a currency the player cannot bring home. A blueprint *plus* scrap is
the **workshop** price, mid-run — ticket 14 owns that number.

### The species clause is real for the first time

It was previously enforced nowhere: `debug/balance/teamComps.ts` recorded it as an open question,
the gap audit (§5) confirmed no game code checked it, and ticket 23's `reconcileLoadedState` could
only discard a *run* after the fact. It is now one module, `src/engine/party.ts`, called from all
three places that need it — the reducer (`setActiveParty`), the load path (`applyRanchState`, which
was the gap: a pre-ticket-20 save could otherwise hydrate a party the reducer now refuses to
produce), and the screen, which **says why** a card is unavailable rather than swallowing the click.

The roster may still hold as many krakens as you like. Re-assembly is the re-roll; only fielding
them together is illegal, and there is a test asserting exactly that distinction.

### The tab shell — one deliberate deviation from the ticket's letter

The ticket says "Ranch replaces Hub/Terminal/Deck/Lab/Relics". Roster, Lab and Relics are absorbed
(`SynthesisLab.tsx`, `RosterTerminal.tsx`, `RelicTerminal.tsx` retired to `_to_delete/`). **Hub,
Sectors and Deck are not deleted — they are demoted to DEV-ONLY tabs labelled "(legacy)".**

Deleting them here would have removed the only way to start a fight before tickets 09 and 10 build
the replacement, and taken the debug scenario launcher's saved-deck mode with it. They are gone from
the player's build already (`import.meta.env.DEV` folds the array), and **tickets 09 and 10 delete
them outright** — 10's ticket already says `SectorTerminal` is removed or demoted, and 09 replaces
QUICK DEPLOY.

One knock-on to be aware of: the "restart run (wipe data)" button lived on the Hub, so a player-
facing wipe is currently unreachable. **Ticket 36** (settings screen) owns save management and
should carry it.

### Also worth knowing

- `SynthesisLab`'s OS picker built its option list as `[`${species}_v1`, `${species}_v2`]`, which is
  true of every species shipped and is not a rule. The new picker reads `availableOS`, the same fix
  `FirmwareTerminal` already had.
- The deconstruct-cards-for-scrap panel is gone with the rest of the scrap economy — there are no
  cards at the ranch to melt.
- `addToRoster` keeps granting a species' base deck into `cardInventory`. That is legacy and wrong
  under the run-scoped model, but it is the debug scenario launcher's only card source until ticket
  09 grants the start kit from ticket 08's `startKit` tags. **Ticket 09 removes it.**
- There is still no XP anywhere — ticket 21 deleted levelling, so the stat roll is the whole of an
  individual's identity. `index.css` still carries dead `.roster-card-level` / `.roster-card-xp`
  rules; ticket 34 (UI art pass) can sweep them.
