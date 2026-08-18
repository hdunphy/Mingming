# 03 — Archetype Space: The Full Menu of Deck Archetypes the Engine Supports Today

Resolved 2026-08-05 by a wayfinder research subagent from the staged snapshot at `/mnt/user-data/uploads/Mingming/`. Builds on `research/01-firmware-truth.md` (cited as **R01**) — the OS hook audit, enabler matrix, and NorseExpansion triage there are taken as ground truth and not re-derived.

Purpose: the menu Henry chooses from when authoring the 32 per-OS 10-card starting decks (16 species × v1/v2, element-locked per `src/engine/data/baseDecks.test.ts`). Scope: what the engine vocabulary supports TODAY, what each archetype costs to realize, and which OS each one feeds.

Game facts assumed throughout: base energy 2 (ratatoskr/audhumbla 3), cardDraw 3 (ymir 2; hraesvelgr/ratatoskr/hel 4) (`src/engine/data/mingmingRegistry.ts`); HAND_SIZE_LIMIT 9 (`src/engine/effectHandlers.ts:13`, `src/engine/deckLogic.ts:7`); 10-card starting decks, duplicates legal (`src/engine/gameTypes.ts:150-154`); rev-3 budgets: damage = 50×E−10, daemon = per-turn value ×4, status price table (`docs/power_curve_spec.md`).

Readiness classes: **POOL-READY** (a coherent 10-card starting deck is assemblable from the 111-card pool today) / **NEW-CARDS** (mechanics exist and are wired; cards must be authored) / **ENGINE-WORK** (named missing mechanic).

---

## 0. ENGINE VOCABULARY INVENTORY (the raw material)

**ActionTypes (19, all with live executors — `src/engine/types.ts:200`, registry `src/engine/actions/ActionExecutors.ts:622-642`):**

| ActionType | Carded in pool? | Notes |
|---|---|---|
| ATTACK | 47 cards | multi-hit via `count` (`battleReducer.ts:327-333`); per-action conditionals |
| STATUS | ~60 cards | negative `stacks` removes; `consume: true` → `lastStatusConsumed` (`ActionExecutors.ts:103-134`) |
| HEAL | 10 cards | `healOverride` or power-based; `STATUS_CONSUMED` scaling (`ActionExecutors.ts:190-192`) |
| DRAW | 9 cards + fertile_ground daemon | non-natural draws trigger onCardDraw hooks |
| ENERGY | 3 cards | negative amounts drain, clamped ≥0 (`resolutionEngine.ts` ENERGY case) — **no card drains today** |
| GENERATE_CARD | 0 cards (echo_chamber daemon hook + sleipnir_v2 OS only) | token engine vehicle |
| CLEANSE | 1 (purify) | all-negatives or single status |
| DISCARD / FORCE_DISCARD | **0 cards** | fully wired incl. `discardEffect` cascade (`ActionExecutors.ts:252-299, 550-559`) and onDiscarded hooks (`resolutionEngine.ts:106-160`) |
| EXHAUST | **0 cards** (only `exhaust: true` self-purge cards exist) | mill-to-exhaust action unused |
| RETURN | **0 cards** | DISCARD/EXHAUST → HAND/DRAW (`ActionExecutors.ts:313-323`) |
| SEARCH | 1 (scavenge_data) | element/category criteria; bypasses onCardDraw (`deckLogic.ts:173`, R01) |
| MULTIPLY_STATUS | 2 (heat_wave Burn, contagion Poison) | ×factor on existing stacks |
| TRIGGER_STATUS | 1 (toxic_surge Poison) | immediate tick, no decrement (`power_curve_spec.md` "known quirk") |
| PLAY_LAST_CARD | 1 (reprogram) | free re-execution, recursion-guarded (`ActionExecutors.ts:431-434`) |
| TAUNT | **0 cards** | whole enemy party forced to target source (`ActionExecutors.ts:448-465`) |
| BUFF_NEXT_PROGRAM | 0 cards (gullinbursti_v1 OS only) | multiplier/flatBonus/costReduction + `appliesTo` |
| REDIRECT_TARGET | **0 cards** | forcedTargetId, random-ally option — ally-dependent |
| SHIFT_STANCE | 2 (nightfall_edge, dawns_respite) | Watcher model; re-entry no-op |

**Attack scaling keys (`ActionExecutors.ts:38-83`):** SHARP_STACKS (+5 power/stack; pool: spike_launch), CARDS_PLAYED (×cardsPlayedThisTurn; pool: seed_bomb_v2), MISSING_HP (+50% of source's missing HP; **pool: 0 cards**), STATUS_COUNT (+25% dmg per target status stack; **pool: 0 cards**), CARDS_DRAWN (×cardsDrawnThisTurn; pool: ink_stream), ELEMENT_PLAYED (×plays of that element this turn, per-turn reset `battleReducer.ts:876-880`; **pool: 0 cards**). ⚠ `supernova_v2` carries `scaling: "HP_PERCENT"` (`programs.json:1596`) which **no executor implements** — it silently falls through as a flat 150-power 2e attack (way over the 90 budget); phantom key, fix or implement.

**Heal scaling:** STATUS_CONSUMED (pool: ash_reclamation, umbral_feast).

**Card constraints (`src/engine/core/ConditionValidator.ts:154-196`):** HAS_STATUS, NOT_STATUS, HEALTH_THRESHOLD ("LT:30"/"GT:50"), BASE (energy check), CARDS_DRAWN. ⚠ String constraints `"self_sharp"`/`"target_burned"`/`"target_poisoned"` on molten_core/ash_reclamation/umbral_feast hit the validator's default-warn branch and **always pass** — those gates are decorative today.

**Hook triggers (OS/daemon/relic-level ONLY — cards cannot carry hooks except Daemon-category cards via `hooks: []`, `Hooks.ts:33-40`):** onActionStart, onPostDamage, onCardDraw, onStatusApplied, onStatusRemoved, onTurnStart, onTurnEnd, onHeal, onUnitFainted, onDiscarded, onDamageCalculated, onStatusDamageCalculated, onCostCalculated (`HookTypes.ts:121-140`). onModifierPhase and onDeckShuffled have **zero listeners** (the latter's dead data was deleted, R01 §5 item 6). Hook scalings: CURRENT_ENERGY, SHARP_STACKS, STRENGTH_STACKS, ALIVE_ALLIES, MISSING_HP, OVERHEAL, BASE_COST, COUNTER (`HookFactory.ts:97-130`). **Design consequence: any archetype whose engine is a trigger ("when X happens, do Y") needs an OS host or a Daemon card; pure card decks can only do action-chains, scalings, and constraints.**

**Statuses (14, `types.ts:17-32`, behaviors `StatusBehaviors.ts`):** Burn (cap 3, decay 1/turn, tiers 2/5/12% maxHp + def shred, overflow = immediate max-tier burst per excess stack), Poison (1% maxHp/stack, decay 1/turn), Asleep (always set to 3, decays, wake-on-damage `effectHandlers.ts:188-246`, natural wake grants StableOS `battleReducer.ts:713-718`, incapacitates `battleReducer.ts:435-436`), Stunned (boolean, 1 turn, no stacking, StableOS on expiry), Weakened/Strengthened/Dazed/Sharp (permanent, uncapped stacks, damage effect 2%/stack capped at ±25% `Hooks.ts:72-74` — the cap is the mirror-deadlock fix; raw stacks stay readable for scalings), Regen (3% maxHp/stack, decay), Energized (banked, converts to energy at refill `battleReducer.ts:805-813`), StableOS (1-turn hard-CC immunity, blocks Stun+Sleep application `effectHandlers.ts:406-408`), BarkShield (% maxHp absorb, 20%/turn decay), DarkStance (+30% outgoing damage)/LightStance (+50% healing) (mutually exclusive, cap 1). ⚠ **Bleed** appears in debuff lists (`ConditionValidator.ts:9`) but has **no registered behavior** — applying it errors (`effectHandlers.ts:393-395`); it cannot carry an archetype until implemented.

---

## 1. ARCHETYPE CATALOG

Format per archetype — **Loop** / **Mechanics** / **Hosts** / **Enablers** (pool count + examples ⇒ est. new cards for a coherent 10-card starter) / **1v1** / **Degeneracy–stall** / **READINESS**.

### Family A — Aggro / Burst

**A1. Strength Snowball** — POOL-READY
- Loop: stack Strengthened every turn via riders and skills, convert into escalating attack damage; finish with a payoff hit (brute_force's conditional second hit).
- Mechanics: STATUS Strengthened (+2%/stack, 25% cap, `Hooks.ts:79-81`); HAS_STATUS:Strengthened conditional (brute_force); STRENGTH_STACKS hook scaling (core_overclock daemon `hooks.json` "daemon_double_strength" — breaks past the cap's usefulness by scaling a multiplier off raw stacks); onActionStart Strength grants (fenrir_v1, skoll_v1, sleipnir_v1).
- Hosts: **fenrir_v1 UNBOUND_KERNEL** (Str per Attack card), **skoll_v1 TREACHERY_KERNEL** (Str per enemy action — works in 1v1, R01 headline), sleipnir_v1 (Str per 0-cost). Fire is the natural element.
- Enablers: 10+ (fury_strike, overdrive, strength_burst, desperate_strike, all_in, reckless_charge, dark_pact, brute_force, cinder_slash, equilibrium, fenrir_v1_daemon) ⇒ 0 new. Skoll's baseDeck already IS this deck (`mingmingRegistry.ts:134`).
- 1v1: fully viable.
- Degeneracy: low — 25% damage cap throttles the snowball unless stack-reading cards multiply it; no loop. Stall: low (it's the anti-stall deck).

**A2. Ramp-to-Nuke (Big-Cost Payoff)** — NEW-CARDS (mechanics exist; pool is 2 cards deep)
- Loop: bank energy for 1–2 turns (Energized/battery_pack/hoarding), then land a 3e+ haymaker amplified by the OS.
- Mechanics: baseCost≥3 hook condition (`HookTypes.ts:51`); kraken_v2 ×1.3 on Water cost≥3 (`hooks.json:123-143`); Energized status; 50×E−10 super-linear budget premium makes big cards intrinsically efficient (`power_curve_spec.md`).
- Hosts: **kraken_v2 TIDAL_CRUSH_OS** (this archetype is its resurrection — DEAD-IN-DECK today, R01), fafnir_v1 (hoard feeds it), audhumbla_v1 (max-energy growth feeds it).
- Enablers: functional big hits: 2 (hydro_blast 150/3e, tidal_wave_v2 60 Side/3e); ramp: capacitor, battery_pack, corrosive_leak, surge_protection ⇒ ~3–4 new Water 3e+ attack cards for a kraken_v2 starter.
- 1v1: viable.
- Degeneracy: low. Stall: low-moderate (dead turns while banking).

**A3. Multi-Hit Flurry** — POOL-READY (payoffs thin)
- Loop: play N-hit attacks; each hit separately benefits from flat per-hit bonuses and per-hit hook procs.
- Mechanics: ATTACK `count` loop (`battleReducer.ts:327-333`); multi-hit prices at total printed power — no surcharge (`power_curve_spec.md`); per-hit onDamageCalculated flat bonuses (gullinbursti_v2 +1×Sharp per hit); enemy-side multi-hit intents proc skoll_v1 per hit (R01 row 7).
- Hosts: Air (gale_slash 15×2, sky_dance 10×3), Nature (thistle_barrage 10×4); **gullinbursti_v2** as bonus-per-hit host if Earth multi-hit cards are authored (Earth has none — its 5 attacks are all single-hit).
- Enablers: 4 (thistle_barrage, gale_slash, sky_dance, glass_cannon's two actions) ⇒ 2–3 new for a dedicated deck; the flat-bonus payoff needs an OS/daemon to matter.
- 1v1: viable.
- Degeneracy: watch flat-bonus × hit-count inflation; the removed "+2 per hit" bug is the cautionary tale (`power_curve_spec.md` §Engine changes 1). Stall: low.

**A4. Prime-and-Spike** — NEW-CARDS
- Loop: play a setup card that primes `nextProgramModifier` (multiplier/flatBonus/costReduction), then unload one oversized attack.
- Mechanics: BUFF_NEXT_PROGRAM action + `nextProgramModifier` with `appliesTo` category gate (`types.ts:139, 307-313`; clearing `battleReducer.ts:397-410`); today only gullinbursti_v1's OS emits it.
- Hosts: **gullinbursti_v1 UNSTOPPABLE_MASS** (already the OS version: status-Skill primes −1 cost Attack); any element via new cards.
- Enablers: 0 cards with the action (OS-only) ⇒ 2–3 new "prime" cards; the pinned semantics (next card spends the charge regardless of category, R01 §5 item 8) is the rules text to author against.
- 1v1: viable.
- Degeneracy: multiplier stacking is single-slot (one modifier field, overwritten) — inherently safe. Stall: low.

### Family B — DoT Stacking

**B1. Poison Engine** — POOL-READY (deepest archetype in the pool)
- Loop: layer cheap Poison appliers, then multiply (contagion ×2) or detonate early ticks (toxic_surge) while decay drains the enemy; optionally eat the stack for healing (umbral_feast).
- Mechanics: Poison behavior (1% maxHp/stack, decay — `StatusBehaviors.ts:197-240`); MULTIPLY_STATUS, TRIGGER_STATUS (executor-tested in `NewArchetypes.test.ts:44-89`); nidhoggr_v1's end-turn re-add cancels decay at ≥2 stacks (`hooks.json:984-1014`); onStatusDamageCalculated exists for future poison-amp hooks.
- Hosts: **jormungandr (both OS)** — baseDeck is already 100% this; **nidhoggr_v1 ROOT_CORRUPTION** (decay-cancel = the archetype's OS-level engine); hel (venom_shade/curse_mark/umbral_feast).
- Enablers: 9 appliers + contagion + toxic_surge + umbral_feast ⇒ 0 new.
- 1v1: fully viable.
- Degeneracy: low. Stall: moderate vs heal decks — Poison's %-maxHp ticks are actually the best stall-breaker in the game; mirror poison-vs-poison races end fast.

**B2. Burn Overflow Tempo** — POOL-READY (Fenrir) / NEW-CARDS (Skoll)
- Loop: pump Burn to the 3-cap fast, then keep applying — every excess stack converts to an immediate max-tier burst (floor(maxHp×12%) each, `StatusBehaviors.ts:140-153`) — while cap-state unlocks OS payoffs.
- Mechanics: Burn tiers/decay/overflow; MULTIPLY_STATUS Burn (heat_wave); HAS_STATUS:Burn rider (cinder_slash); consume-heal (ash_reclamation); fenrir_v2 Burn→Sharp (`hooks.json:68-95`); skoll_v2 energy refund vs Burn-3 target (`hooks.json:440-470` — "Burn 3" = at cap, R01 row 8).
- Hosts: **fenrir_v2 CINDER_WALL_OS** (also procs off self-burn — hybrid with H2), **skoll_v2 SOLAR_FLARE_OS** (currently DEAD-IN-DECK; fixed by moving pool burn cards — ignite/fire_poke/scorch — into his starter).
- Enablers: 8 Burn sources + heat_wave + cinder_slash + ash_reclamation ⇒ 0 new for fenrir_v2; 0 new for skoll_v2 (deck swap suffices — pool already has everything).
- 1v1: viable.
- Degeneracy: overflow burst scales with target maxHp — self-burn (all_in/overheat) on a big unit is self-harm, not exploit. Stall: low.

**B3. DoT-Consume Drain** — NEW-CARDS (2 cards exist)
- Loop: apply a DoT, then cash the whole stack via `consume: true` into STATUS_CONSUMED-scaled healing (or, with new cards, damage) — tempo hinge between DoT and sustain.
- Mechanics: STATUS consume → `lastStatusConsumed` (`ActionExecutors.ts:103-134`, `types.ts:412-413`); STATUS_CONSUMED heal scaling (`ActionExecutors.ts:190-192`). A consume→ATTACK scaling key does **not** exist (heal-only today) — damage-consume needs either a new scaling key (small ENGINE-WORK) or flat conditional attacks.
- Hosts: hel (umbral_feast), fenrir (ash_reclamation), nidhoggr.
- Enablers: 2 (ash_reclamation Burn, umbral_feast Poison) ⇒ 2–3 new consume payoffs for a dedicated deck.
- 1v1: viable.
- Degeneracy: consuming your OWN nidhoggr_v1 fuel is anti-synergy to watch in deck pairings, not an exploit. Stall: moderate (heals).

**B4. Status-Count Nuker** — NEW-CARDS
- Loop: pile ANY statuses on the target (Poison, Dazed, Weakened all count — `STATUS_COUNT` sums **all stacks**, buffs included), then land a +25%-per-stack finisher.
- Mechanics: STATUS_COUNT attack scaling (`ActionExecutors.ts:73-75`) — **zero pool cards use it**; uncapped-stack design explicitly preserves it (`power_curve_spec.md` cap-mechanism note).
- Hosts: nidhoggr (poison counts), kraken/jormungandr (daze+poison), hel (weaken+poison), draugr_v2 (its ≥2-distinct-debuffs condition wants the same setup).
- Enablers: setup is everywhere (30+ debuff cards); payoff cards: 0 ⇒ 1–2 new finishers.
- 1v1: viable.
- Degeneracy: ⚠ counts the target's **buffs** too — a Strengthened-stacked enemy makes your nuke bigger; also +25%/stack with uncapped stacks is the most explosive scaler in the vocabulary — budget it at conditional ×0.7 and playtest.

### Family C — Control / Lockdown

**C1. Stun Cadence Control** — POOL-READY
- Loop: alternate Stun turns with damage turns; enemy loses every other action; payoff cards bite Stunned targets (shatter's bonus hit).
- Mechanics: Stunned (1-turn boolean, no stacking — `StatusBehaviors.ts:290-316`); incapacitation check `battleReducer.ts:435-436`; StableOS on expiry forces a 1-turn gap (`battleReducer.ts:713-718`) — perma-stun is impossible **by design**; HAS_STATUS:Stunned conditional (shatter); StableOS-block (`effectHandlers.ts:406-408`).
- Hosts: **ymir_v1/v2** (Ice owns 3 of 4 stun cards; ymir_v2's 2-cards/turn cap likes high-impact CC turns), draugr, huldra (stunning_strike is Nature).
- Enablers: 4 appliers (flash_freeze, glacial_slam, stunning_strike, entangle) + shatter payoff ⇒ 0–1 new.
- 1v1: viable — vs MOVES enemies stun is fully effective (intent skipped).
- Degeneracy: engine-proofed by StableOS. Stall: moderate — a stun deck that can't close damage drags fights; pair with shatter-style payoffs.

**C2. Sleep Setup / Permafrost** — NEW-CARDS
- Loop: (a) offensive — sleep the enemy (3 incapacitated turns unless damaged), take free setup turns, then alpha-strike (waking them); or (b) draugr_v1's inversion — sleep YOURSELF, tank the 3 turns, wake into +3 Strengthened.
- Mechanics: Asleep behavior (reset-to-3, wake-on-damage `effectHandlers.ts:188-246`, StableOS on natural wake); onStatusRemoved trigger fires on all four removal paths (R01 §1 condition semantics); draugr_v1 PERMAFROST_WAKE (`hooks.json:754-781`).
- Hosts: **draugr_v1** (DEAD-IN-DECK today; needs an on-element Ice self-sleep card — the only applier is Nature `sleep_powder`, off-element and never auto-suggested, R01 §5 deckSuggest rules), **huldra** (sleep_powder ×2 already in her baseDeck, `mingmingRegistry.ts:333`), ymir (NorseExpansion 6A/6B ADAPT/KEEP, R01 §4).
- Enablers: 1 applier ⇒ 2–3 new (Ice self-sleep "hibernate", sleep-payoff attacks per 6B "Brittle Point" — HAS_STATUS:Asleep conditionals, precedent `nidhoggr_feast` move).
- 1v1: viable both directions; self-sleep in 1v1 means 2–3 turns of not acting — needs BarkShield/Sharp support to survive.
- Degeneracy: sleep→no-damage-setup→re-sleep loop vs MOVES enemies could soft-lock fights long; StableOS gap prevents full lock. Stall: high if the deck can't convert the free turns.

**C3. Daze Amplification** — POOL-READY
- Loop: stack Dazed (enemy takes +2%/stack, cap +25%), then collect the amplified damage with ordinary attacks; draw riders key off it (pressure_point).
- Mechanics: Dazed defender-side multiplier (`Hooks.ts:92-95`); kraken_v1 dazes per effect-draw (`hooks.json:96-122`); ratatoskr_v2 dazes per 0-cost (`hooks.json:171-194`); HAS_STATUS:Dazed conditional (pressure_point).
- Hosts: **kraken_v1 ABYSSAL_INK_SYS** (draw-daze engine — see F2), **ratatoskr_v2 INSTIGATOR_OS**, sleipnir/hraesvelgr (Air has 2 appliers).
- Enablers: 8 appliers (blind_spot, ink_cloud, acid_splash, dust_devil, disorienting_gust, creeping_dread, crippling_vine, reckless_charge-self) + pressure_point ⇒ 0 new.
- 1v1: viable.
- Degeneracy: 25% cap bounds it. Stall: low-moderate.

**C4. Weaken Attrition** — POOL-READY
- Loop: stack Weakened to blunt enemy offense to the −25% floor, out-sustain, win on chip damage — the classic Ice identity.
- Mechanics: Weakened attacker-side multiplier (`Hooks.ts:81-82`); ymir_v1 auto-weaken on being targeted (`hooks.json:723-746`); huldra_v1 mirrors Weakened per own-side status (`hooks.json:693-716`); draugr_v2's cost-tax wants Weakened+one-more-type on the attacker.
- Hosts: **ymir_v1 RIME_HEART_SYS**, **draugr_v2** (partially — see D3), huldra_v1, hel/nidhoggr (Dark has 4 appliers).
- Enablers: 9 appliers (cold_snap, hoarfrost, winters_grasp, ice_spear, pollen_cloud, crippling_vine, curse_mark, night_terror, creeping_dread) ⇒ 0 new.
- 1v1: viable.
- Degeneracy: none. **Stall: HIGH — Weakened+heal is exactly the known mirror-stall shape (kraken/hel/audhumbla 400/400 draws); the 25% cap keeps net damage ≥56% (`Hooks.ts:66-74`) so it resolves, but slowly. Budget the deck's clock.**

### Family D — Resource Denial (all CARDS-mode-dependent)

**D1. Energy Drain** — NEW-CARDS + CARDS-mode only
- Loop: negative-ENERGY cards strip the enemy's pool before they act; win the action-economy war.
- Mechanics: ENERGY executor accepts negative amounts, clamp ≥0 (`resolutionEngine.ts` ENERGY case); negative MAX_ENERGY mutation exists (`resolutionEngine.ts:189-202`).
- Hosts: jormungandr (NorseExpansion 2B "Tidal Constrict" — ADAPT-narrow, R01 §4), kraken.
- Enablers: 0 cards ⇒ 3–4 new. **Dead vs MOVES enemies (the default) — intents pay no energy (`battleReducer.ts:232` context, R01 draugr_v2 finding).** Sim-viable only with `enemyMode: 'CARDS'`.
- Degeneracy: enemy locked at 0 energy every turn = hard lock in CARDS mode; needs drain amounts < enemy refill.

**D2. Hand Attack (Mill/Discard Denial)** — NEW-CARDS + CARDS-mode only
- Loop: FORCE_DISCARD strips the enemy hand; they draw into nothing.
- Mechanics: FORCE_DISCARD delegates to DiscardExecutor incl. enemy `discardEffect` triggers (`ActionExecutors.ts:550-559`); onDiscarded hooks fire for the discarding side — ⚠ forcing discards on an enemy Hraesvelgr feeds its GALE_FORCE.
- Hosts: hraesvelgr (thematic wind-theft), kraken.
- Enablers: 0 cards ⇒ 3+ new. MOVES enemies have no hand — dead by default.
- Degeneracy: low. Stall: moderate (denial without clock).

**D3. Cost Taxation** — NEW-CARDS (daemon vehicle) + CARDS-mode only
- Loop: install taxes that make enemy cards cost +1 under conditions; strangle their turns.
- Mechanics: onCostCalculated hook (`HookTypes.ts:126`), evaluated only in `handlePlayProgram` (`battleReducer.ts:232`); precedents: draugr_v2 GRAVE_CHILL (`hooks.json:782-802`), boss_relic_ice poison-tax. Cards can't carry hooks — **but Daemon-category cards can** (`Hooks.ts:33-40`), so a "tax daemon" card is authorable without engine work.
- Hosts: **draugr_v2** (this is its whole identity; currently dead vs MOVES + starved of the 2-distinct-debuffs setup — rework candidate), ymir.
- Enablers: 0 cards ⇒ 1–2 new tax daemons + debuff-variety cards (draugr's deck applies only Weakened, R01 row 24).
- Degeneracy: stacked taxes could brick a CARDS-mode enemy entirely.

### Family E — Ramp / Economy

**E1. Energized Banking** — POOL-READY
- Loop: convert spare tempo into Energized stacks that cash out as bonus energy at next refill; smooth 2-energy turns into 3–4 energy spikes.
- Mechanics: Energized behavior (persistent, consumed at refill — `StatusBehaviors.ts:361-382`, `battleReducer.ts:805-813`); price 35 power vs 40 for immediate energy (`power_curve_spec.md`).
- Hosts: any; jormungandr baseDeck already carries capacitor; ratatoskr (photosynthesis_v2).
- Enablers: 3 Energized (capacitor, photosynthesis_v2, lumen_surge) + 3 immediate ENERGY (corrosive_leak, surge_protection, battery_pack) ⇒ 0–2 new. Feeds A2.
- 1v1: viable. Degeneracy: capacitor is over-budget (E2=70 on 40, flagged in spec shopping list). Stall: moderate (banking turns are passive).

**E2. Max-Energy Growth** — POOL-READY-adjacent (UNDER-FED)
- Loop: repeatedly satisfy a counter condition to permanently grow maxEnergy; late turns dwarf the opponent's action economy.
- Mechanics: MAX_ENERGY hook action (`HookFactory.ts:218-231` — grants max only, not current) and MAX_ENERGY mutation (max+current, `resolutionEngine.ts:189-202`); OWNER-scoped counters.
- Hosts: **audhumbla_v1 GENESIS_FIRMWARE** (every 3rd Heal/Skill card, R01 row 27 — 4 deck enablers today, needs ~6), **hraesvelgr_v2 UPDRAFT_KERNEL** (one-shot +1 on deck cycle — WELL-FED).
- Enablers: 34 Heal/Skill-category pool cards to choose from ⇒ 2 new Light Heal/Skill cards at most (or just re-deck).
- 1v1: viable. Degeneracy: unbounded maxEnergy over a long fight; boss fights (11–13 turns) could reach 6+ energy — watch. Stall: **high** — the audhumbla heal-spam shell is a known 400/400-draw participant.

**E3. Hoard (Unspent-Energy Payoff)** — POOL-READY
- Loop: deliberately underspend; end turn with energy in the tank; next turn cash Energized = leftover + counter, eat the small recoil, spike.
- Mechanics: fafnir_v1 CUSTOM hoard/recoil (`CustomFirmware.ts:7-46`, verified `OSGapClosures.test.ts:118-143`); CURRENT_ENERGY hook scaling exists for future variants.
- Hosts: **fafnir_v1 HOARD_PROTOCOL** (unconditional — any deck works, WELL-FED).
- Enablers: unconditional ⇒ 0 new; deck wants cheap cards + one big spender (overlaps A2).
- 1v1: viable. Degeneracy: recoil scales with hoard — self-limiting. Stall: moderate (passive turns are literally the strategy; give the deck a payoff clock).

**E4. Zero-Cost Tempo Swarm** — POOL-READY
- Loop: play 3–6 free cards a turn; every 0-cost play triggers the OS (Str/heal/daze) and feeds combo counters; energy goes to one paid threat.
- Mechanics: baseCost:0 hook condition; 23 zero-cost cards in pool (incl. 2 tokens); token generation compounds it (G1).
- Hosts: **sleipnir_v1 MOMENTUM_DRIVE**, **ratatoskr_v1 GOSSIP_NODE**, **ratatoskr_v2 INSTIGATOR_OS** (avoid self-targeted 0-costs — self-daze bug, R01 row 18); echo_chamber daemon.
- Enablers: 21 non-token 0-costs across all elements ⇒ 0 new.
- 1v1: viable. Degeneracy: bounded by hand size 9 and draw; echo_chamber's `isToken: false` guard is the safe pattern; sleipnir_v2's missing guard is the unsafe one. Stall: low.

### Family F — Cycle / Draw Engines

**F1. Draw-Scaling Burst** — POOL-READY
- Loop: chain draw cards to inflate `cardsDrawnThisTurn`, then play a CARDS_DRAWN-multiplied finisher the same turn.
- Mechanics: CARDS_DRAWN attack scaling (×drawn — `ActionExecutors.ts:76-78`, tested `NewArchetypes.test.ts:110-133`); CARDS_DRAWN card constraint gates cards behind draw count.
- Hosts: **kraken** (ink_stream is the payoff; Water has 4 draw cards), hraesvelgr/hel (cardDraw 4 = free head start — natural draws count in `cardsDrawnThisTurn`, `resolutionEngine.ts:460`).
- Enablers: 9 draw cards + ink_stream ⇒ 0–1 new (a second payoff card).
- 1v1: viable. Degeneracy: ×draw multiplier on a 10-card deck with reshuffles — ink_stream after tailwind+scry ≈ ×7+; watch budgets. Stall: low.

**F2. On-Draw Proc Engine** — POOL-READY
- Loop: every non-natural draw triggers installed effects (daze, damage, heal); the deck becomes a machine gun where draw cards ARE the payload.
- Mechanics: onCardDraw hook, per-card loop (`resolutionEngine.ts:470-490`), `isNaturalDraw` gate; **the one archetype where daemon cards give a pure-cards deck hook access**: feedback_loop_daemon (7 dmg/draw), recursion_daemon hook (heal 5/draw — hook exists in hooks.json, **orphaned: no card carries it** — a free NEW-CARD), fertile_ground (+1 draw/turn).
- Hosts: **kraken_v1 ABYSSAL_INK_SYS** (daze per drawn card — note it also procs on enemy effect-draws, R01 row 3).
- Enablers: 9 draw cards + 2 daemons ⇒ 0 new (kraken_v1 UNDER-FED verdict fixed by re-decking draw cards in).
- 1v1: viable. Degeneracy: draw→proc→draw loops are bounded by deck size and hand limit; fine. Stall: low.

**F3. Deck-Cycle Payoff** — POOL-READY
- Loop: burn through the 10-card deck fast (draw 4 + tailwind/slipstream), reshuffle by ~turn 3, collect cycle rewards; thin-deck consistency is its own payoff.
- Mechanics: reshuffle-during-draw sets `deck_shuffles` counter (`resolutionEngine.ts:463-468`); hraesvelgr_v2 one-shot +1 max/current energy on next draw after cycle (`CustomFirmware.ts:86-106`). No repeatable per-cycle hook exists (onDeckShuffled has no listeners) — repeat-cycle payoffs are ENGINE-WORK.
- Hosts: **hraesvelgr_v2 UPDRAFT_KERNEL** (WELL-FED today).
- Enablers: draw suite as F1 ⇒ 0 new.
- 1v1: viable. Degeneracy: none (one-shot). Stall: low.

**F4. Cards-Played Combo ("Storm")** — POOL-READY
- Loop: dump cheap/free cards to inflate `cardsPlayedThisTurn`, then seed_bomb_v2 (×cards played) or the every-3rd-card OS payout closes.
- Mechanics: CARDS_PLAYED attack scaling (`ActionExecutors.ts:67-69`); jormungandr_v1 counter/payout pair (3rd Water card in a turn → +1 energy +1 draw, `hooks.json:471-540`); audhumbla_v1's every-3rd-Heal/Skill counter is the same skeleton.
- Hosts: **jormungandr_v1 OUROBOROS_LOOP** (Water storm), **ratatoskr** (energy 3 + draw 4 + Nature's seed_bomb_v2 and 0-costs = the premier storm chassis), sleipnir.
- Enablers: 23 zero-costs + seed_bomb_v2 + jorm's 4 cheap Waters ⇒ 0 new.
- 1v1: viable. Degeneracy: **jormungandr_v1's payout (energy+draw per 3 Waters) is self-feeding** — with enough 0-cost Waters (water_slap, poison_injection, blind_spot, corrosive_leak) each cycle refunds part of the next; bounded by deck/hand today, but adding more 0-cost Water cards pushes it toward a full storm loop. Stall: low.

### Family G — Token / Generation

**G1. Token Swarm** — POOL-READY (one host degenerate)
- Loop: convert plays into free 0-cost token cards that feed every "per card played"/"per 0-cost" trigger in the game (E4, F4, sleipnir_v1).
- Mechanics: GENERATE_CARD action/mutation; tokens `isToken: true`, never deck-suggested (`deckSuggest.ts:29-30`); `isToken: false` hook guard is the anti-loop tool (`hooks.json` echo_chamber vs war_steed).
- Hosts: **sleipnir_v2 WAR_STEED_OS** (⚠ INFINITE as shipped — hoof_strike token retriggers its own generator, R01 headline; needs the guard added), echo_chamber_v2 daemon (Nature — ratatoskr).
- Enablers: 2 tokens + 1 daemon + 2 OS hooks ⇒ 0 new for sleipnir/ratatoskr; other elements need their own generator daemons.
- 1v1: viable. Degeneracy: **the** case study — any generator whose token satisfies its own trigger loops; lint every future GENERATE_CARD hook for `isToken: false`.

**G2. Echo / Replay** — POOL-READY (thin)
- Loop: play the most expensive effect in hand, then reprogram it for 2e without re-paying riders' costs; double-dip 3e effects.
- Mechanics: PLAY_LAST_CARD re-executes `lastProgramPlayed`'s actions cost-free (`ActionExecutors.ts:410-446`); recursion-guarded.
- Hosts: kraken/jormungandr (reprogram is Water); pairs with A2 big hits and B1 (replaying toxic_cloud).
- Enablers: 1 (reprogram) ⇒ 1–2 new echo variants for a dedicated deck.
- 1v1: viable. Degeneracy: flagged watch item — "sims watch the 3e-replay combo" (`power_curve_spec.md`); replay of tidal_wave/hydro_blast is the ceiling.

**G3. Tutor Consistency** — NEW-CARDS (1 card exists)
- Loop: SEARCH pulls the combo piece every game; 10-card decks barely need it, but 40-card late-game decks will.
- Mechanics: SEARCH with element/category criteria (`ActionExecutors.ts:325-335`); bypasses onCardDraw (no kraken_v1 synergy — `deckLogic.ts:173`, R01).
- Hosts: any; scavenge_data is Water.
- Enablers: 1 ⇒ 1 per element that wants it. Low priority for 10-card starters.
- 1v1: viable. Degeneracy/stall: none.

### Family H — Defense / Attrition / Thorns

**H1. Shield Wall** — POOL-READY
- Loop: keep a BarkShield buffer rolling (top up against 20%/turn decay), let DoTs/chip win underneath.
- Mechanics: BarkShield %-maxHp absorb pool, recompute-per-hit, decay (`StatusBehaviors.ts:421-481`); huldra_v2's battle-start shield (⚠ player-side dead + quadratic-stacks bug, R01 headline — fix before building around it).
- Hosts: **huldra_v2 BARK_SHIELD_OS** (post-fix), fafnir/gullinbursti (Earth owns stone_bark/spiked_carapace), ymir/draugr (glacier_wall).
- Enablers: 3 (glacier_wall, stone_bark, spiked_carapace) ⇒ 1–2 new for shield-matters payoffs ("while shielded, X" needs sourceStatus:BarkShield hook conditions — exists — or HAS_STATUS:BarkShield card conditionals — exists).
- 1v1: viable. Stall: **HIGH — shield+heal is the canonical stall kit; a shield deck must carry a clock (DoT or Sharp payoff) or it recreates the 400/400 draws.**

**H2. Sharp Fortress** — POOL-READY (the deepest defensive archetype)
- Loop: stack Sharp for the dual payoff — −2%/stack incoming (cap 25%) AND +5 power/stack on SHARP_STACKS attacks (spike_launch); defense that converts directly into offense.
- Mechanics: Sharp defender modifier (`Hooks.ts:95-98`); SHARP_STACKS attack power scaling (`ActionExecutors.ts:38-45` — power-side, so it scales with level and survives resistances); SHARP_STACKS hook scaling (gullinbursti_v2 +1 dmg×Sharp on Earth attacks; boss_relic_fire).
- Hosts: **gullinbursti_v2 KINETIC_RAM_OS**, **fafnir** (NorseExpansion 3A "Golden Scales" = KEEP, R01 §4), fenrir_v2 (Burn→Sharp bridge).
- Enablers: 9+ Sharp sources (shield_shards, keen_edge, iron_bark, stone_fist, spiked_carapace, scry, growth, harden_daemon, cinder_armor_daemon) + spike_launch payoff ⇒ 0 new. fafnir's current baseDeck already is this deck.
- 1v1: viable. Degeneracy: uncapped stacks × +5 power/stack = the strongest legal snowball; fine under the 40-power/energy curve but watch iron_bark (3 stacks/1e vs the 10-power price = on curve). Stall: moderate — Sharp-vs-Sharp mirrors slow to the 56% floor.

**H3. Retaliation / Punish** — NEW-CARDS (daemon vehicle; OS versions live)
- Loop: get hit, hit back automatically — turn the enemy's actions into your damage/debuffs.
- Mechanics: onPostDamage hook fires per enemy action component, damaging or not (`battleReducer.ts:389, 559`); precedents: skoll_v1 (+Str when own side hit), ymir_v1 (Weaken attacker), boss_relic_water (side-heal on hit). True damage-**reflection** (mirror N% of damage) does not exist — flat/status retaliation only (R01 §4 7A REJECT).
- Hosts: **skoll_v1**, **ymir_v1** (both WELL-FED, unconditional); any deck via 1–2 new "thorns daemon" cards (harden_daemon pattern).
- Enablers: OS-unconditional ⇒ 0 new for skoll/ymir; 1–2 daemons to export it. 
- 1v1: viable (multi-hit enemy intents feed it fastest). Degeneracy: skoll_v1 also procs on non-damaging enemy actions — free scaling vs status-heavy enemies. Stall: moderate.

**H4. Cleanse / Immunity Tech** — POOL-READY (thin, support-shell not a full archetype)
- Loop: blank enemy DoT/CC decks — purify the stack, aegis before the stun window, soothe the chip debuffs.
- Mechanics: CLEANSE action (all-negatives or targeted); negative-stack STATUS removal (soothe); StableOS pre-emptive CC block.
- Hosts: valkyrie/audhumbla (Light owns purify/aegis); a tech layer inside other decks rather than a standalone deck — 10 slots of answers with no threats loses to clock.
- Enablers: 3 (purify, aegis, soothe) ⇒ 0 new as tech; not viable standalone.
- 1v1: viable as a layer. Note: cleanse fires onStatusRemoved — it FEEDS an enemy draugr_v1 (cleansing his Asleep = +3 Str to him).

**H5. Anti-Debuff Inversion** — NEW-CARDS
- Loop: WANT to be debuffed — every debuff that lands on you pays out (+1 energy), so self-debuff cheaply and profit; soft-counters C3/C4/B decks.
- Mechanics: fafnir_v2 CORRUPTED_GOLD (debuff on self → +1 Energy, `hooks.json:12-34` — id-collision fragility noted R01 row 6); onStatusApplied fires even when duality cancels (`effectHandlers.ts:500-514`).
- Hosts: **fafnir_v2** (UNDER-FED: self-debuff enablers are Fire/Water — reckless_charge, all_in, corrosive_leak, overheat — all off-element for Earth-locked decks; the deckSuggest element rule blocks them, R01 §5).
- Enablers: 4 off-element ⇒ 2–3 new Earth self-debuff cards ("cursed relic: gain 2 energy, take 2 Poison").
- 1v1: enemy-fed mode works vs any debuffing enemy; self-fed mode needs the new cards. Degeneracy: energy-positive self-debuff loops (0-cost card granting a debuff = free energy) — price carefully.

### Family I — Lifedrain / Sustain

**I1. Vampire Drain** — POOL-READY
- Loop: every attack heals; trade evenly on damage and win the HP war; DarkStance amps outgoing, LightStance amps the heals.
- Mechanics: ATTACK+HEAL(healOverride) multi-action cards; LightStance ×1.5 on both heal pipelines (`ActionExecutors.ts:180-192`).
- Hosts: **hel_v1** (baseDeck is already this: leech_strike ×2, drain_life ×2, umbral_feast — `mingmingRegistry.ts:521`), nidhoggr.
- Enablers: 4 (leech_strike, drain_life, dawns_respite, umbral_feast) ⇒ 0–1 new.
- 1v1: viable. Stall: **moderate-high — hel is a named participant in the 400/400 mirror draws; drain-vs-drain mirrors are the slow shape. Keep drain decks' damage above the sustain line.**

**I2. Overheal Cannon** — NEW-CARDS-light (UNDER-FED today)
- Loop: heal past full on purpose; every wasted point converts to Light damage at a random enemy — sustain that IS the win condition, the designed anti-stall sustain deck.
- Mechanics: real intended-vs-applied overheal split + `last_overheal` global counter (`effectHandlers.ts:329-357`, verified `OSGapClosures.test.ts:80-116`); OVERHEAL hook scaling; audhumbla_v2 NOURISH_ROUTINE (`hooks.json:883-916`).
- Hosts: **audhumbla_v2** (2 deck enablers today; healing_light flat-20 is the overheal workhorse), jormungandr_v2 (its over-firing 2-heal-per-turn-end, R01 row 10, is passive overheal fuel once at full HP — accidental synergy).
- Enablers: 10 HEAL cards, ~3 practical overheal generators ⇒ 2–3 new Light heal cards (cheap self-heals, Regen sources — Regen ticks route through the same choke point).
- 1v1: viable. Stall: LOW by design — this is what you give a heal deck so its mirrors end. Degeneracy: none (damage = overheal, 1:1, and heal is priced at 4 power/1% vs damage 3).

**I3. Heal-Spam Economy** — POOL-READY-adjacent
- Loop: chain cheap Heal/Skill-category cards; every 3rd grows maxEnergy (E2's engine) while Regen/heals keep you topped; converges with I2 as the overheal source.
- Mechanics: audhumbla_v1 counter (programCategoryIn Heal/Skill — note uplift is category Status and does NOT count, R01 row 27); Regen 3%/stack.
- Hosts: **audhumbla_v1**, ratatoskr_v1 (0-cost heals double-dip GOSSIP_NODE).
- Enablers: 34 Heal/Skill pool cards, 4 in audhumbla's deck ⇒ re-deck +2 cards.
- 1v1: viable. Stall: **HIGH — this is the archetypal stall kit; pair with I2's cannon or it recreates the known draws.**

### Family J — High-Risk / HP-as-Resource

**J1. Missing-HP Berserker** — NEW-CARDS
- Loop: hurt yourself (or just get hurt) to unlock the deck: MISSING_HP attacks add +50% of your missing HP as damage; HEALTH_THRESHOLD LT gates flip cards into desperation mode (equilibrium's dual-mode is the template).
- Mechanics: MISSING_HP attack scaling (`ActionExecutors.ts:70-72` — **zero pool attack uses it**); MISSING_HP hook scaling; HEALTH_THRESHOLD constraints; self-damage sources abound (fenrir_v1 recoil, all_in/overheat self-Burn, fafnir_v1 recoil, hel_v2 HP-cost).
- Hosts: fenrir (NorseExpansion 1B "Ragnarok" = KEEP-mostly, R01 §4), skoll, hel.
- Enablers: payoffs: 1 partial (equilibrium) ⇒ 2–3 new MISSING_HP/threshold cards; self-damage fuel already exists.
- 1v1: viable. Degeneracy: MISSING_HP is uncapped (+0.5 dmg per missing HP — at L10 ~50 maxHp that's up to +25 flat, fine; at high level it's a scaling cannon) — audit at boss levels. Risk: the deck feeds enemy MISSING_HP/faint conditions; genuinely high-risk.

**J2. HP-for-Resources** — POOL-READY-adjacent (UNDER-FED)
- Loop: pay HP instead of energy — hel_v2 refunds the full baseCost of Dark non-Attacks and charges HP; every Skill/Status becomes "free" while the drain package (I1) pays the blood back.
- Mechanics: hel_v2 UNDERWORLD_GATEWAY (BASE_COST-scaled refund + self-damage, `hooks.json:945-983`; energy still needed up front, R01 row 30).
- Hosts: **hel_v2** (3 deck enablers; 5 in pool: creeping_dread, curse_mark, dawns_respite, umbral_feast, venom_shade).
- Enablers: 5 ⇒ 1–2 new Dark non-Attack cost-2+ cards (bigger refunds = bigger identity).
- 1v1: viable. Degeneracy: refund uses printed baseCost even when discounted — a cost-reduced Dark card is energy-POSITIVE; interaction with gullinbursti_v1-style costReduction is a live exploit seam. Stall: low.

**J3. Threshold Gambler** — folded into J1 (HEALTH_THRESHOLD is J1's gate, not a separate loop; a GT-gated "healthy aggression" variant is a card-design knob, not a distinct archetype).

### Family K — Stance / Mode-Switching

**K1. Stance Dancer** — NEW-CARDS
- Loop: alternate DarkStance (+30% dmg) and LightStance (+50% heal) turns; every genuine shift draws a card (hel_v1), so the dance is card-neutral; deck splits into "dark half" and "light half".
- Mechanics: SHIFT_STANCE executor (exclusivity, re-entry no-op — `ActionExecutors.ts:569-618`); stance modifiers (`Hooks.ts:83-87`, `ActionExecutors.ts:180-192`); hel_v1 EQUINOX_TOGGLE draw (`hooks.json:917-944`).
- Hosts: **hel_v1** (Dark is the only element with stance cards; the archetype cannot leave Dark without new cards).
- Enablers: 2 (nightfall_edge, dawns_respite — one of each direction; UNDER-FED) ⇒ 2–4 new stance-shift cards + stance-payoff conditionals (HAS_STATUS:DarkStance riders — expressible today).
- 1v1: viable. Degeneracy: draw-per-shift with cheap alternating shifters approaches a cantrip loop — the re-entry no-op is the only brake; keep shifters ≥1e. Stall: low.

### Family L — Team Support (multi-unit / CARDS-mode)

**L1. Ally Buffer-Healer** — NEW-CARDS + ally-dependent
- Loop: aim buffs/heals at allies; valkyrie_v1 pays a heal per ally-buff, valkyrie_v2 pays +10% damage per living ally.
- Mechanics: TargetType Side/Single-ally cards; valkyrie_v1 custom (self excluded, `CustomFirmware.ts:107-141`); ALIVE_ALLIES scaling (excludes owner, `HookFactory.ts:110-114`).
- Hosts: **valkyrie_v1/v2** (both 1v1-DEAD, R01 §3 — the definitive list), audhumbla, huldra_v1.
- Enablers: ally-targetable buffs: 3 (growth, overgrowth, uplift — two are Nature, off-element for Light decks) ⇒ 3-4 new Light ally-buff cards (NorseExpansion 7B "Gjallarhorn" = KEEP, exactly this fix, R01 §4).
- 1v1: **DEAD** — worthless in the 1v1 sim harness; only testable in multi-unit battles. Stall: moderate.

**L2. Bodyguard (Taunt/Redirect)** — NEW-CARDS + ally-dependent
- Loop: TAUNT pulls all enemy targeting onto the tank (who runs H1/H2); REDIRECT_TARGET re-aims specific threats.
- Mechanics: TAUNT (party-wide forcedTargetId), REDIRECT_TARGET (single, random-ally option) — both executor-only, 0 cards.
- Hosts: gullinbursti/fafnir (Earth tanks), huldra.
- Enablers: 0 ⇒ 2–3 new. 1v1: dead (nothing to protect; forcedTargetId is a no-op with one target). 
- Degeneracy: none known.

**L3. Faint Feast** — OS-led, multi-unit only
- Loop: units dying (either side) super-charge the survivor (+3 Str +3 Sharp per faint).
- Mechanics: onUnitFainted (`effectHandlers.ts:305-314`); nidhoggr_v2 (`hooks.json:1015-1047`, fragile `"ANY"` fall-through). No card-level on-faint vehicle (hooks are OS/daemon) — a "harvest daemon" card is authorable.
- Hosts: **nidhoggr_v2** (1v1-DEAD, R01 §3).
- Enablers: n/a (trigger is battle-shape) ⇒ deck just wants generic aggro + maybe 1 harvest daemon.
- 1v1: DEAD. Degeneracy: none.

### Family M — Graveyard / Recursion

**M1. Discard-Matters (Windmill)** — NEW-CARDS (the single highest-leverage authoring gap)
- Loop: voluntarily over-draw and pitch cards; every discard fires its `discardEffect` and the OS's onDiscarded gale (10-power free attack); "draw 2, discard 1" cards are strictly-better cantrips for this deck.
- Mechanics: DISCARD action + `discardEffect` action-list on cards (`types.ts:351`) + onDiscarded hook pipeline — all fully wired, ZERO cards use any of it (R01 headline); end-of-turn discardHand does NOT trigger it (`resolutionEngine.ts:106-160`).
- Hosts: **hraesvelgr_v1 GALE_FORCE_OS** (DEAD-IN-POOL today; this archetype IS its resurrection — NorseExpansion 4A = KEEP, R01 §4).
- Enablers: 0 ⇒ 4–5 new Air cards (draw-discard cantrips + cards with juicy discardEffects: "if discarded: deal 10 / draw 1 / gain 1 Energized").
- 1v1: viable. Degeneracy: discardEffect→DRAW→hand→discard chains can loop if a discardEffect draws AND another discard outlet is free; keep discardEffects payoff-only (no free DISCARD actions inside discardEffects). Stall: low.

**M2. Recursion Value (RETURN)** — NEW-CARDS
- Loop: replay your best card from the discard pile every turn; a 10-card deck with RETURN approaches a fixed script; also rescues exhausted daemons (sourcePile EXHAUST).
- Mechanics: RETURN executor (DISCARD/EXHAUST → HAND/DRAW, `ActionExecutors.ts:313-323`) — 0 cards; NorseExpansion "Recycle"/"Corrupted File" salvage items (R01 §4 3B/8B).
- Hosts: hel/nidhoggr (Dark grave flavor), kraken.
- Enablers: 0 ⇒ 2–3 new. 1v1: viable.
- Degeneracy: RETURN targeting reprogram/other RETURN cards = engine of loops; with 10-card decks the reshuffle already recycles everything, so RETURN's value is selection, not volume — price low, watch pairings with G2.

**M3. Exhaust Purge / Deck-Thinning** — NEW-CARDS
- Loop: burn your own weak cards out of the battle (EXHAUST action or `exhaust: true` one-shots) so every reshuffle is denser with payoffs; the 10-card deck magnifies each removal (10→8 cards = 25% more OS-trigger density per cycle).
- Mechanics: EXHAUST action (mill N to exhaust pile) — 0 cards; `exhaust: true` self-purge exists on 8 cards (strength_burst, all 7 daemons).
- Hosts: hraesvelgr_v2 (faster cycles), any storm/cycle deck (F3/F4).
- Enablers: 0 EXHAUST-action cards ⇒ 1–2 new ("purge: exhaust the top 2 of your draw pile, gain X").
- 1v1: viable. Degeneracy: thinning to a 2–3 card loop deck is the StS "infinite" recipe — combined with F4 payouts, audit deck-size floors.

### Family N — Element-Count / Misc

**N1. Mono-Element Ritual** — NEW-CARDS
- Loop: play K same-element cards this turn, then a finisher multiplied by that count (ELEMENT_PLAYED ×plays-this-turn).
- Mechanics: ELEMENT_PLAYED attack scaling + per-turn `elementPlays` tracking (`ActionExecutors.ts:79-83`, `battleReducer.ts:280-284`) — **0 pool cards**; element-locked baseDecks make the condition trivially always-on (every deck is mono-element), so it plays as a strictly-better CARDS_PLAYED unless the finisher demands a count higher than natural.
- Hosts: jormungandr_v1 (Water-count synergy), ymir_v2 (anti-host — 2-card cap fights it).
- Enablers: 0 ⇒ 1–2 new. 1v1: viable. Degeneracy: same profile as F4. **Design note: given element-locking, ELEMENT_PLAYED and CARDS_PLAYED are nearly redundant keys; consider reserving ELEMENT_PLAYED for future dual-element decks or 'None'-splash decks rather than spending starter slots on it.**

**N2. Buff-Mirror Hex** — POOL-READY-adjacent (UNDER-FED)
- Loop: every buff you give your own side auto-Weakens a random enemy (huldra_v1) — a buff deck that debuffs for free; bridges A1/H2 stacking with C4 attrition.
- Mechanics: huldra_v1 ALLURE_PROXY (onStatusApplied, target ALLY incl. self, `hooks.json:693-716`; works in 1v1, R01 §3).
- Hosts: **huldra_v1** (1 deck enabler today — overgrowth; Nature pool self-buffs: growth, iron_bark?, no — Nature buffs: growth, overgrowth, photosynthesis_v2, soothe... plus 23 self-status appliers pool-wide).
- Enablers: 26 pool triggers, ~4 on-element ⇒ 2–3 new Nature self/ally buff cards.
- 1v1: viable. Stall: moderate (buff+weaken+heal drifts toward the stall shape; keep a clock).

---

## 2. VOCABULARY LEFTOVERS — items that carry no archetype, and why

| Item | Status |
|---|---|
| `onModifierPhase` trigger | Zero listeners, zero data hooks — inert plumbing; no archetype until something uses it |
| `onDeckShuffled` trigger | Listeners deleted (R01 §5 item 6); repeat-cycle payoffs (F3+) would need it re-implemented — ENGINE-WORK if wanted |
| `Bleed` status | In debuff lists only; no behavior registered — applying it errors (`effectHandlers.ts:393-395`). ENGINE-WORK; until then it cannot anchor anything |
| `HP_PERCENT` scaling | Phantom key on supernova_v2 — unimplemented, silently ignored. Either implement (an "execute"/%HP nuke archetype would slot into Family A) or strip from data |
| Poison `getScaledStacks` | Dead code (STATUS pipeline never passes power — `power_curve_spec.md` known facts); no archetype reads it |
| `CURRENT_ENERGY` hook scaling | No data hook uses it; E3 (fafnir_v1 custom) covers the design space; available for future "X per unspent energy" cards |
| `REDIRECT_TARGET`, `TAUNT` | Covered by L2 but genuinely uncarded and 1v1-dead — lowest-priority executors in the codebase |
| String card-conditionals (`self_sharp`, `target_burned`, `target_poisoned`) | Always-pass bug in `ConditionValidator` default branch — molten_core's conditional rider and both consume-cards' gates are currently unconditional; fix before building conditional-rider archetypes on this syntax (object-form conditionals work fine) |
| `tempHp` field | Only debug SET_VITALS writes it (R01 §4 7A); BarkShield is the sanctioned shield — no temp-HP archetype without ENGINE-WORK |
| Revive / on-faint recovery | No mechanic anywhere (R01 §4 8B REJECT); graveyard-of-units archetypes are ENGINE-WORK |
| Status transfer between units | No TRANSFER_STATUS; consume only feeds same-card heals (R01 §4 5B REJECT) |
| Damage reflection (%) | No mechanic; flat retaliation only (H3) |

---

## TABLE A — THE MENU: archetype × readiness × best hosts

| # | Archetype | Family | Readiness | Best hosts (OS it brings to life **bold**) | 1v1 |
|---|---|---|---|---|---|
| A1 | Strength Snowball | Aggro | POOL-READY | fenrir_v1, skoll_v1, sleipnir_v1 | ✓ |
| A2 | Ramp-to-Nuke | Aggro | NEW-CARDS (~3-4) | **kraken_v2**, fafnir_v1 | ✓ |
| A3 | Multi-Hit Flurry | Aggro | POOL-READY (thin payoff) | Air/Nature; gullinbursti_v2 w/ new Earth multi-hits | ✓ |
| A4 | Prime-and-Spike | Aggro | NEW-CARDS (~2-3) | gullinbursti_v1 | ✓ |
| B1 | Poison Engine | DoT | POOL-READY | jormungandr_v1/v2, nidhoggr_v1, hel | ✓ |
| B2 | Burn Overflow Tempo | DoT | POOL-READY (fenrir) / re-deck (**skoll_v2**) | fenrir_v2, **skoll_v2** | ✓ |
| B3 | DoT-Consume Drain | DoT | NEW-CARDS (~2-3) | hel, fenrir | ✓ |
| B4 | Status-Count Nuker | DoT | NEW-CARDS (1-2 finishers) | nidhoggr, kraken, hel, feeds **draugr_v2** setup | ✓ |
| C1 | Stun Cadence | Control | POOL-READY | ymir_v1/v2, draugr | ✓ |
| C2 | Sleep Setup / Permafrost | Control | NEW-CARDS (~2-3, Ice self-sleep) | **draugr_v1**, huldra | ✓ |
| C3 | Daze Amplification | Control | POOL-READY | kraken_v1, ratatoskr_v2, Air | ✓ |
| C4 | Weaken Attrition | Control | POOL-READY | ymir_v1, huldra_v1, draugr_v2 | ✓ (stall!) |
| D1 | Energy Drain | Denial | NEW-CARDS (~3-4) | jormungandr | CARDS-mode only |
| D2 | Hand Attack | Denial | NEW-CARDS (~3) | hraesvelgr, kraken | CARDS-mode only |
| D3 | Cost Taxation | Denial | NEW-CARDS (tax daemons) | **draugr_v2**, ymir | CARDS-mode only |
| E1 | Energized Banking | Ramp | POOL-READY | any; jormungandr, ratatoskr | ✓ |
| E2 | Max-Energy Growth | Ramp | re-deck (+~2) | **audhumbla_v1**, hraesvelgr_v2 | ✓ |
| E3 | Hoard | Ramp | POOL-READY | fafnir_v1 | ✓ |
| E4 | Zero-Cost Tempo | Ramp | POOL-READY | sleipnir_v1, ratatoskr_v1/v2 | ✓ |
| F1 | Draw-Scaling Burst | Draw | POOL-READY | kraken, hel, hraesvelgr | ✓ |
| F2 | On-Draw Proc Engine | Draw | POOL-READY (re-deck) | **kraken_v1** | ✓ |
| F3 | Deck-Cycle Payoff | Draw | POOL-READY | hraesvelgr_v2 | ✓ |
| F4 | Cards-Played Storm | Draw | POOL-READY | jormungandr_v1, ratatoskr | ✓ |
| G1 | Token Swarm | Token | POOL-READY (⚠ fix sleipnir_v2 guard) | sleipnir_v2, ratatoskr (echo_chamber) | ✓ |
| G2 | Echo / Replay | Token | POOL-READY (thin) | kraken, jormungandr | ✓ |
| G3 | Tutor Consistency | Token | NEW-CARDS (1/element) | any | ✓ |
| H1 | Shield Wall | Defense | POOL-READY (⚠ fix **huldra_v2**) | huldra_v2, Earth, Ice | ✓ (stall!) |
| H2 | Sharp Fortress | Defense | POOL-READY | gullinbursti_v2, fafnir, fenrir_v2 | ✓ |
| H3 | Retaliation | Defense | POOL-READY (OS) / NEW-CARDS (daemons) | skoll_v1, ymir_v1 | ✓ |
| H4 | Cleanse Tech | Defense | POOL-READY (layer only) | Light | ✓ |
| H5 | Anti-Debuff Inversion | Defense | NEW-CARDS (~2-3 Earth self-debuffs) | **fafnir_v2** | ✓ |
| I1 | Vampire Drain | Sustain | POOL-READY | hel_v1, nidhoggr | ✓ (stall watch) |
| I2 | Overheal Cannon | Sustain | NEW-CARDS-light (~2-3) | **audhumbla_v2**, jormungandr_v2 | ✓ (anti-stall) |
| I3 | Heal-Spam Economy | Sustain | re-deck (+~2) | audhumbla_v1, ratatoskr_v1 | ✓ (stall!) |
| J1 | Missing-HP Berserker | HP-risk | NEW-CARDS (~2-3 payoffs) | fenrir, skoll, hel | ✓ |
| J2 | HP-for-Resources | HP-risk | POOL-READY-adjacent (+1-2) | **hel_v2** | ✓ |
| K1 | Stance Dancer | Stance | NEW-CARDS (~2-4) | **hel_v1** | ✓ |
| L1 | Ally Buffer-Healer | Team | NEW-CARDS (~3-4 Light) | **valkyrie_v1/v2**, audhumbla | ✗ 1v1-dead |
| L2 | Bodyguard | Team | NEW-CARDS (~2-3) | Earth tanks, huldra | ✗ 1v1-dead |
| L3 | Faint Feast | Team | OS-led | **nidhoggr_v2** | ✗ 1v1-dead |
| M1 | Discard Windmill | Graveyard | NEW-CARDS (~4-5 Air) | **hraesvelgr_v1** | ✓ |
| M2 | Recursion Value | Graveyard | NEW-CARDS (~2-3) | hel, nidhoggr, kraken | ✓ |
| M3 | Exhaust Thinning | Graveyard | NEW-CARDS (~1-2) | cycle decks | ✓ (loop audit) |
| N1 | Mono-Element Ritual | Misc | NEW-CARDS (1-2; near-redundant w/ F4) | jormungandr | ✓ |
| N2 | Buff-Mirror Hex | Misc | NEW-CARDS-light (~2-3 Nature buffs) | **huldra_v1** | ✓ |

Totals: 21 POOL-READY (incl. re-deck-only), 21 NEW-CARDS, 0 pure ENGINE-WORK archetypes (engine-work items are sub-features: Bleed, revive, reflection, repeat-cycle hook, consume-to-damage scaling, temp-HP — see §2).

## TABLE B — COVERAGE CHECK: all 32 OS mechanics → feeding archetype(s)

| OS | Feeding archetype(s) | Status |
|---|---|---|
| fenrir_v1 UNBOUND_KERNEL | A1 (+J1 recoil synergy) | fed today |
| fenrir_v2 CINDER_WALL_OS | B2 + H2 bridge | fed today |
| kraken_v1 ABYSSAL_INK_SYS | F2 + C3 | fed (re-deck draw cards in) |
| kraken_v2 TIDAL_CRUSH_OS | A2 (+G2) | needs new 3e Water attacks |
| fafnir_v1 HOARD_PROTOCOL | E3 + A2 | fed today (unconditional) |
| fafnir_v2 CORRUPTED_GOLD_OS | H5 | needs Earth self-debuff cards |
| skoll_v1 TREACHERY_KERNEL | H3 + A1 | fed today (unconditional) |
| skoll_v2 SOLAR_FLARE_OS | B2 | fed by re-deck (pool burn cards exist) |
| jormungandr_v1 OUROBOROS_LOOP | F4 + B1 | fed today |
| jormungandr_v2 VENOM_TRENCH_OS | B1 + I2 (passive overheal) | fed today (over-fires, R01) |
| gullinbursti_v1 UNSTOPPABLE_MASS | A4 (+H2 primers) | fed today |
| gullinbursti_v2 KINETIC_RAM_OS | H2 + A3 | fed today |
| hraesvelgr_v1 GALE_FORCE_OS | M1 (only) | **needs new cards — no archetype feeds it from the pool** |
| hraesvelgr_v2 UPDRAFT_KERNEL | F3 + E2 + M3 | fed today |
| sleipnir_v1 MOMENTUM_DRIVE | E4 + A1 | fed today |
| sleipnir_v2 WAR_STEED_OS | G1 | fed today (⚠ infinite — add isToken guard first) |
| ratatoskr_v1 GOSSIP_NODE | E4 + I3 | fed today |
| ratatoskr_v2 INSTIGATOR_OS | E4 + C3 | fed today (self-daze caveat) |
| huldra_v1 ALLURE_PROXY | N2 + C4 | needs ~2-3 Nature buff cards |
| huldra_v2 BARK_SHIELD_OS | H1 | **bug-blocked (player-side never fires) — fix before any deck feeds it** |
| ymir_v1 RIME_HEART_SYS | C4 + H3 | fed today (unconditional) |
| ymir_v2 GLACIAL_PACE_OS | C1 (few big Ice turns) | fed today |
| draugr_v1 PERMAFROST_WAKE | C2 (only) | **needs Ice self-sleep card — nothing on-element feeds it** |
| draugr_v2 GRAVE_CHILL_OS | D3 + C4 + B4 setup | **CARDS-mode-only + starved — REWORK CANDIDATE (dead vs MOVES regardless of deck)** |
| valkyrie_v1 VALHALLA_UPLINK | L1 (only) | **1v1-dead + needs Light ally-buff cards — REWORK CANDIDATE for 1v1 product** |
| valkyrie_v2 EINHERJAR_RALLY | L1 | **1v1-dead (×1.0 in 1v1) — REWORK CANDIDATE for 1v1 product** |
| audhumbla_v1 GENESIS_FIRMWARE | I3 + E2 | fed by re-deck (+2 Heal/Skill) |
| audhumbla_v2 NOURISH_ROUTINE | I2 | needs ~2-3 overheal generators |
| hel_v1 EQUINOX_TOGGLE | K1 + I1 | needs more stance cards for full identity (2 exist) |
| hel_v2 UNDERWORLD_GATEWAY | J2 + B1 | fed today (thin) |
| nidhoggr_v1 ROOT_CORRUPTION | B1 | fed today |
| nidhoggr_v2 FALLEN_FEAST_OS | L3 (only) | **1v1-dead — REWORK CANDIDATE for 1v1 product** |

**No-archetype / rework flags (for the OS design review):** draugr_v2 (mode-dead), valkyrie_v1, valkyrie_v2, nidhoggr_v2 (1v1-dead trio — only multi-unit archetypes serve them), huldra_v2 (bug-dead). hraesvelgr_v1 and draugr_v1 are servable but ONLY via new cards (M1, C2) — they are the two highest-leverage card-authoring targets.

**Element overlap risk (two species sharing one 10-card element pool):**

| Element | Species pair | Risk | Notes |
|---|---|---|---|
| Fire | fenrir / skoll | MODERATE | Both gravitate to A1+B2; separate as fenrir=self-recoil Burn-Sharp (B2/H2/J1) vs skoll=retaliation + burn-refund tempo (H3/B2-refund) — distinct loops on shared cards |
| Water | kraken / jormungandr | LOW | Daze-draw (C3/F1/F2/A2) vs Poison-storm (B1/F4) — cleanly split already |
| Earth | fafnir / gullinbursti | **HIGH** | Both v2 identities are Sharp payoffs (H2), decks nearly interchangeable today; differentiate via fafnir=E3 hoard + H5 self-debuff (needs the new Earth self-debuff cards) vs gullinbursti=A4 prime + A3 multi-hit (needs Earth multi-hit cards) |
| Air | hraesvelgr / sleipnir | **HIGH (known)** | baseDecks already near-identical (`mingmingRegistry.ts:230,262`); the split is M1 discard-windmill (hraesvelgr) vs E4/G1 zero-cost token swarm (sleipnir) — but M1 is 100% unauthored, so today they collapse into one deck. The M1 card batch is what buys Air its variety |
| Nature | ratatoskr / huldra | LOW | Storm/zero-cost (E4/F4) vs sleep/hex/support (C2/N2) — distinct once huldra's buff cards land |
| Ice | ymir / draugr | **HIGH** | Both kits are Weaken/Stun (C1/C4) today; draugr's designed identity (C2 self-sleep + D3 tax) is entirely unauthored/mode-blocked, so both species currently play ymir's deck |
| Light | valkyrie / audhumbla | MODERATE | Both drift to heal/buff; audhumbla owns I2/I3/E2, valkyrie owns L1 — but L1 is 1v1-dead, leaving valkyrie with no live 1v1 identity at all (compounding the rework flag) |
| Dark | hel / nidhoggr | LOW | Drain/stance/HP-cost (I1/K1/J2) vs Poison/faint (B1/L3) — distinct |

**Stall-shape summary (for sim gating):** highest mirror-stall risk decks are C4, H1, I1, I3 (and any Light heal shell) — the documented kraken/hel/audhumbla 400/400 draws are this shape; the 25%-cap net-damage floor (`Hooks.ts:66-74`) guarantees eventual resolution but not fast resolution. Every such starter should ship with a clock (B1 Poison, I2 overheal-cannon, or H2 Sharp payoff). Infinite-loop watch list: sleipnir_v2 token guard (live bug), G2 replay of 3e cards, F4/M3 thin-deck storm interactions, J2 refund-vs-costReduction seam, K1 cheap-shifter cantrip loop, M1 discardEffect-draw chains.


---

## REVISION 2 — post-rework re-examination (2026-08-05, after tickets 07/09/10/11)

Requested by Henry after the OS reworks landed. Re-derives **Table B** and the **element overlap** table against the current state: defect fixes ([07](../tickets/07-firmware-defect-fixes.md)), review verdicts ([09](../tickets/09-os-design-review.md)), tweaks ([10](../tickets/10-os-tweak-pass.md)), rework specs ([11](../tickets/11-os-rework-specs.md)). Rows not listed are unchanged from the original tables above.

### New catalog entries (the reworks created archetypes the original menu lacked)

- **H6 — Buff-Variety Snowball** (family H): layer *distinct* buff types, cash them as damage. Loop: alternate buff sources (Sharp, Strengthened, Regen, StableOS, Energized, BarkShield) → Light attacks at +10%/type (**valkyrie_v2 CRUSADER_KERNEL**). Partially fed today (her deck reaches 2 types → +20%); wants 1–2 more distinct-type Light buff cards. 1v1 ✓. Distinct from H2 (stack-count) by construction — wants breadth, not depth. Readiness: re-deck + NEW-CARDS-light.
- **B5 — Threshold Feeder / Anti-Heal** (family B/J hybrid): chip anything — including yourself — across the 50% HP line, collect permanent stats per crossing (**nidhoggr_v2 BLOOD_SCENT_OS**: +2 Str +2 Sharp per crossing, re-armed by healing). Fed **today** by his own poison kit (DoT ticks cross the line) + the J-family self-damage line (`dark_pact`). The catalog's first archetype that *wants* the enemy to heal — stall kits (kraken/hel/audhumbla) feed it. 1v1 ✓. Bounded by the 25% cap. Readiness: POOL-READY.

### Table B changes (status deltas only)

| OS | was | now |
|---|---|---|
| huldra_v2 | bug-blocked (player-side never fired) | **fed today** — fixed (07), 50% maxHP locked (09); H1 Shield Wall live, deck must carry a clock |
| sleipnir_v2 | fed ⚠ infinite token loop | **fed, clean** — `isToken:false` guard (07); FTK redline cleared |
| ratatoskr_v2 | fed w/ self-daze caveat | **fed, clean** — enemy-only daze (10); its §2.3 redline cleared (18% → 6%) |
| kraken_v1 | fed (any side's draws) | fed, own-side draws only (10) — F2/C3 unchanged as feeders |
| jormungandr_v2 | fed (over-firing, 2× rate) | fed at the described rate (10) — passive halved, so its B1 deck needs the clock, not the OS |
| ymir_v2 | fed (+50%) | fed (+35%, 10) — C1 unchanged |
| hraesvelgr_v1 | **needs new cards — nothing in pool** | **COMMITTED** — Air discard package (~4–5 cards, 09); M1 Discard Windmill goes from unauthored to planned |
| draugr_v1 | needs Ice sleep cards | **COMMITTED** — Ice sleep package (~2–3 cards, 09); C2 planned; dead "revived" text to drop |
| draugr_v2 | mode-dead REWORK CANDIDATE | **rebuilt (11)**: −20% damage from attackers with 2+ debuff types, works vs intents. Feeder: C4 Weaken + **the v1 sleep package supplies debuff type #2 (Asleep)** — both draugr OSes share the same new enablers with different payoffs (the uniqueness rule working as intended) |
| valkyrie_v1 | 1v1-dead + 0 enablers | **COMMITTED** — deliberate team OS + Light ally-buff cards (09); L1 planned; measured via team scenarios ([05](../tickets/05-team-battle-os-variance-design.md)) |
| valkyrie_v2 | 1v1-dead REWORK CANDIDATE | **replaced (11)** — CRUSADER_KERNEL, feeder **H6** (new entry above) |
| nidhoggr_v2 | 1v1-dead REWORK CANDIDATE | **replaced (11)** — BLOOD_SCENT_OS, feeder **B5** (new entry above); implementation = [ticket 12](../tickets/12-os-rework-implementation.md) |
| — | EINHERJAR_RALLY (valkyrie_v2) | lives on as the **`einherjar_standard` team daemon card** (2e Light, exhaust) — L1-family tool, player-earnable, lands with the Light card work |

**No-archetype / rework flags: none remain.** Every OS in the standard 32 now has a live or committed feeding archetype; valkyrie_v1 is team-by-design, not unserved. Still needs-new-cards (uncommitted): kraken_v2 (3e Water attacks), fafnir_v2 (Earth self-debuffs), huldra_v1 (~2–3 Nature ally-buffs), audhumbla_v2 (~2–3 overheal generators), hel_v1 (stance cards beyond the 2 in pool).

### Element overlap — revised

| Element | was | now | note |
|---|---|---|---|
| Air | **HIGH** | **RESOLVED (on commitment)** | discard package splits hraesvelgr (M1 windmill / F3 cycle) from sleipnir (E4 zero-cost / G1 token swarm). Henry's correction stands: the OSes never overlapped — only the card lists did |
| Ice | **HIGH** | **RESOLVED (on commitment + rework)** | draugr = C2 sleep-wake aggro + rebuilt debuff-stack mitigation vs ymir = C1 stun cadence + few big +35% hits; the sleep package is the shared enabler, payoffs differ |
| Earth | **HIGH** | **HIGH — deferred by decision** | fafnir_v2 and gullinbursti_v2 are both H2 Sharp payoffs on a 9-card pool; the sketched differentiators (fafnir: ~2–3 Earth self-debuff cards + E3 hoard lean; gullinbursti: ~1–2 Earth multi-hit cards + A4 prime) are **deliberately uncommitted — Henry deferred the split to the Earth deck pass (ticket 04 fog)**, which may resolve it without new cards |
| Light | MODERATE | **LOW-MODERATE** | valkyrie finally has a live solo identity (H6 buff-variety attacks) distinct from audhumbla's I2/I3/E2 heal economy; both still shop in the buff/heal card space — watch in the deck pass |
| Fire | MODERATE | **LOW-MODERATE** | fenrir's self-burn axis is now official (09): fenrir = B2/H2/J1 reckless burn-armor vs skoll = H3 retaliation + B2-refund tempo |
| Water | LOW | LOW | unchanged |
| Nature | LOW | LOW | huldra's ~2–3 buff cards still wanted; direction clear |
| Dark | LOW | LOW | note: BLOOD_SCENT's self-damage line shares `dark_pact` with hel_v2's J2 — shared card, different payoffs (allowed) |

### Stall/loop watch — revised

Kraken's eternal mirror already eased from the tweaks alone (61 → 54.7 avg turns, 400 → 354 draws). BLOOD_SCENT is the first *systemic* anti-stall tool — its natural prey is exactly the C4/H1/I1/I3 stall shells. New loop-audit item from the reworks: BLOOD_SCENT heal-drop cycling (bounded by the 25% cap and HP cost — verified not degenerate in the 11 grilling) and CRUSADER + `core_overclock_daemon` stack-reader interaction (flagged in [ticket 12](../tickets/12-os-rework-implementation.md) tests).
