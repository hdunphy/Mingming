# OS design review & rework decisions

- Type: wayfinder:grilling
- Status: open
- Assignee: —
- Blocked by: —

## Question

All 32 firmware variants were designed over a year ago (with help from an older AI model), before the rev-3 power curve, the balance suite, and most of the current engine existed. Review every one with Henry against three tests, and decide keep / tweak / rework per OS:

1. **Power level** — is the mechanic's ceiling sane under the rev-3 economy? Bring numbers: the [firmware truth table](../research/01-firmware-truth.md) (what each actually does), current §2.3 gaps *with the dead-hook caveats attached*, and — once [ticket 07](07-firmware-defect-fixes.md)'s mechanical fixes land — the post-fix `npm run balance` re-run. Power judgments made against the bugged sims are unreliable; sequence the power half of this review after 07 where possible.
2. **Fit with the game being built** — does the mechanic produce the playstyle Henry wants for that species, and do v1/v2 read as two *playstyles* rather than a strong/weak pair (§2.3's own stated goal)? The [archetype catalog](08-archetype-possibility-space.md) is the reference for what else that slot could be.
3. **Practical viability** — can a 10-card deck actually turn the mechanic on (enabler matrix), and is it measurable (1v1-dead trio: valkyrie_v1, valkyrie_v2, nidhoggr_v2 — decide whether ally-dependence is their intended team-content identity or grounds for rework; a rework here changes what [ticket 05](05-team-battle-os-variance-design.md) needs to build)?

Inherited design-choice items moved here from ticket 07 (each is a behavior question, not a bug):

- **jormungandr_v2** heals at the end of *both* sides' turns (4 HP/round in 1v1) vs the described 2/turn — intended rate?
- **kraken_v1** procs on *any* side's effect-draws (no `source` condition) — intended breadth?
- **fenrir_v2** grants Sharp when Fenrir burns *himself* (`all_in`) — intended synergy or leak?
- **ratatoskr_v2** dazes Ratatoskr himself on 0-cost self-target cards — intended?
- **draugr_v2** does nothing vs MOVES enemies (cost hooks only run on card plays) — accept as CARDS-only, or rework?
- **hraesvelgr_v1** (discard-triggered) and **draugr_v1** (sleep-triggered) — their enablers don't exist / barely exist; commit to building the enabler cards, or rework the OS?
- **huldra_v2**'s intended shield size (the fix in 07 makes it fire and makes it linear; the % is a design call — "massive, temporary" per description).

Output: a per-OS verdict table (keep / tweak with the change named / rework with a one-line new design), recorded in the resolution; any rework big enough to need its own design pass graduates as a new ticket. Reworked OSes then feed [ticket 04](04-archetype-identity-template.md)'s deck designs — decks should not be built for firmware that's about to change.
