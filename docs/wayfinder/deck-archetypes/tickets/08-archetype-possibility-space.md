# Archetype possibility-space catalog

- Type: wayfinder:research
- Status: closed
- Assignee: wayfinder (research subagent)
- Blocked by: —

## Question

Before picking archetypes per species, enumerate **every deck archetype the engine lends itself to today** — a catalog Henry chooses from, so the 32 decks draw on the full option space rather than the first idea per species, and so the game offers a wide variety of gameplay. Derive from the actual vocabulary (ActionTypes, StatusTypes, scaling keys, conditionals, hook triggers, status behaviors, the 111-card pool, the 32 firmware mechanics), with per-archetype: core loop, engine mechanics, natural hosts, enabler density, 1v1-sim viability, degeneracy/stall risk, and readiness class.

## Resolution

Full catalog: [../research/03-archetype-space.md](../research/03-archetype-space.md). **48 archetypes across 14 families** (aggro/burst, DoT, control, resource denial, ramp/economy, draw engines, token/generation, defense/attrition, lifedrain/sustain, HP-as-resource, stance, team support, graveyard/recursion, misc), each with loop, mechanics, hosts, enabler counts, and risk flags. Headlines:

- **Table A is the menu:** ~20 archetypes are POOL-READY today, ~20 need small card batches (mostly 2–4 cards each), 3 are CARDS-mode-only (the whole resource-denial family — meaningless vs intent enemies), and the true ENGINE-WORK list is short because the vocabulary is broader than the pool uses it.
- **Table B maps all 32 OSes to feeding archetypes** and confirms the rework flags for [the OS design review](09-os-design-review.md): draugr_v2 (mode-dead), valkyrie_v1/valkyrie_v2/nidhoggr_v2 (only team archetypes serve them — no live 1v1 identity), huldra_v2 (bug-dead until [07](07-firmware-defect-fixes.md)). hraesvelgr_v1 (Discard Windmill, ~4–5 new Air cards) and draugr_v1 (Sleep Setup, ~2–3 Ice cards) are the two highest-leverage card-authoring targets.
- **Element overlap risk, the variety check Henry asked for:** Earth, Air and Ice are HIGH — both species of each currently collapse into one deck identity, and the differentiator archetype is in every case the unauthored one (fafnir's self-debuff/hoard split, hraesvelgr's discard windmill, draugr's self-sleep). Fire is MODERATE (split fenrir=Burn-Sharp recoil vs skoll=retaliation/burn-refund), Light MODERATE (valkyrie has *no* live 1v1 identity — compounds its rework flag); Water/Nature/Dark are cleanly split already.
- **Stall & loop watch:** mirror-stall shapes are Weaken Attrition, Shield Wall, Vampire Drain, Heal-Spam (the kraken/hel/audhumbla 400/400 shape) — every such starter should ship with a built-in clock (Poison, overheal-cannon, or Sharp payoff). Infinite-loop audit list: sleipnir_v2 token guard (live bug), 3e replay, thin-deck storm, HP-refund seams, cheap stance-shifter cantrips, discard-draw chains.
