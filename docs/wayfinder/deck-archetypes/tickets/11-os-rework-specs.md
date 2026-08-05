# OS rework specs: valkyrie_v2, nidhoggr_v2, draugr_v2

- Type: wayfinder:grilling
- Status: open
- Assignee: —
- Blocked by: —

## Question

The [OS design review](09-os-design-review.md) sentenced three variants to rework. Design the replacements with Henry — each needs a named effect, hook-level mechanics inside the existing vocabulary (or an explicit engine-work ask), a rev-3 price sanity check (a passive hook's steady-state value should sit near the daemon rule: per-turn value × 4 ≈ what an energy buys), and enough spec that [the deck template work](04-archetype-identity-template.md) can build its 10-card deck. Constraints locked by 09's principles: payoff-unique across all 32 (share cards, never archetypes), and each of these three must be **solo-live**.

- **valkyrie_v2 (new solo OS, replacing EINHERJAR_RALLY in the pair)** — valkyrie_v1 stays the team OS, so this slot defines her *solo* identity. The catalog's live-1v1 Light options are thin by design (audhumbla owns overheal/heal-economy): candidates include lifedrain-on-Light-attacks, buff-count scaling ("+X% per distinct buff on Valkyrie"), or a Sharp-granting smite line. Also decide **where EINHERJAR_RALLY gets remembered** — shelved in data, a future species, a relic, or a boss OS (Henry: "maybe we can find another place to add it").
- **nidhoggr_v2 (full rework)** — keep the corpse-eater fantasy, alive in 1v1. Candidates: execute/threshold damage ("+X% vs enemies under Y% HP"), feeding on enemy Poison expiries, or scaling off damage the enemy has taken this battle. Must stay distinct from nidhoggr_v1's poison-sustain and hel's drain kits.
- **draugr_v2 (same fantasy, works vs intents)** — "attackers with 2+ distinct debuff types falter against the Draugr," rebuilt off the cost system (which intents never touch). Candidates: −X% damage dealt to Draugr by debuffed attackers (onDamageCalculated works for intents), or debuffed attackers' actions apply 1 fewer status stack. Sized so Draugr's new deck (which must apply 2 debuff types — today it applies only Weakened) turns it on by mid-fight.

Resolution: three named specs + the EINHERJAR disposition, each implementable as a hooks.json/CustomFirmware change; implementation graduates as a task ticket alongside (or folded into) the deck work that feeds them.
