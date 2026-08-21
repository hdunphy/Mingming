# Release shape: Early Access or 1.0, and the entry bar in numbers (ticket 05)

- Type: wayfinder:grilling
- Status: closed
- Assignee: wayfinder (Henry grilling session, 2026-08-21)
- Blocked by: [01](01-gap-audit.md)
- Phase: Foundations

## Question

Does Mingming's first Steam release go out as **Early Access** or as **1.0**? The wayfinder's recommendation is in `map.md` (Early Access, with a measured entry bar); Henry rules.

Decide, with numbers: biome pairs at launch, gyms at launch, species count (16 exists), difficulty tiers at launch, target run length (35–45 min is ruled), expected hours of content, price band (feeds ticket 46). Also: what "Content Complete" means for THIS game — the phase-2 ticket list is re-cut from this answer.

Henry's success metric (2026-08-21): **shipped + 10 reviews**; PvP is out of scope for the first release; art budget ≤ $500 and only if the game can earn it back.

## Resolution

**RULED (Henry, 2026-08-21): EARLY ACCESS.** The entry bar, in numbers:

| Dimension | EA launch | Notes |
|---|---|---|
| Elements | **3 — Fire, Water, Nature** | Air is the stretch goal (→ 4). |
| Biomes | **3 mono-element biomes**, one per element | **Amends exploration-map.md's "each biome mixes two elements" — DEFERRED until more types ship.** Reason: the launch triangle is a pure counter cycle (Fire>Nature>Water>Fire in `combatUtils.ts`), so every two-element pairing among them is a counter pair; a Fire starter walking into a Fire/Water biome is not fun. Two-element biomes return as *friendly* pairs (no arrow either way) once the roster widens. |
| Species | **6 / 12 decks** — fenrir, skoll, kraken, jormungandr, ratatoskr, huldra | Air stretch adds hraesvelgr + sleipnir (8 / 16). The other 10 species ARE the Early Access roadmap. |
| Gyms | **3 authored leaders** | A gym = a leader + a 3-deck team drawn from the run's biomes; wild encounters reuse the same tuned decks with OS / sibling-species variation. "The decks are in a decent state — balance and pick the leaders" (Henry). |
| Tiers | **3** | Tier 1 the taught game; 2 elites + enemy Macros; 3 enemy Drivers + ambush density. Tier 4+ and run modifiers are EA growth. |
| Systems | Macros, Drivers, marketplace, workshop, elites (alpha/ambush), events, codex — all in | Per the vertical-slice definition. |
| Run length | 35–45 min, 10–13 fights | Unchanged ruling. |
| Price | **$4.99–$7.99 at EA → $9.99 at 1.0** | Exact number + discount in ticket 46. |

**Fallback, pre-agreed:** if the slice playtest (ticket 25) shows mono biomes producing bad early matchups, the answer is to bring in **all six non-Light/Dark elements early** (Fire, Water, Nature, Earth, Air, Ice — 12 species / 24 decks), not to pair elements within the launch triangle.

**Early-game matchup caution (Henry):** type matters a lot; the first biome a starter meets must be chosen with care. Tickets 07 (graph) and 09 (run start) carry this: the three offered gyms show their biome order up front, and the generator should never force a starter's hard counter as the first biome (proposal — Henry ratifies the exact rule in 07).

**Content Complete (phase 2) therefore means:** the table above, plus the art / audio / settings / resolution-and-Deck / accessibility / performance baseline. Ticket 27 shrinks from "decide the content list" to "confirm the leaders, tiers and event count after the slice"; ticket 28 is sized to 3 leaders.

**Why EA (for the record):** the content ladder the design chose (tiers, held species, Air) is what EA is for; the 10-review bar rewards a finished *loop*; the calendar bends around a fourth child. Costs accepted: Next Fest is one-time and must precede the EA launch, and the EA launch is the launch for review momentum — polish high, quantity low.
