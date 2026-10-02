# Ticket 187: A deep dive on the walker, with pictures

**Type:** balance tooling report (no game code). **Status:** PARKED (Henry, 2026-10-02): saved for later. **Do not start until Henry says go.** It replaces row 170d of [ticket 170](170-better-walker.md) as the next step on the walker: Henry looks at this first, and then names the fixes.

**Henry (2026-10-02, handwritten):**

> *"I need a deep dive on the walker and why it's failing but not just a wall of text. Add this to the wayfinder, save for later."*

**Why.** The walker is the bot that plays whole runs for the balance reports. It reaches the gym in about 1 run in 10, and a person reaches it far more often. So every number in those reports mixes "the game is hard" with "the walker plays badly", and nobody can tell which. Row 170c already measured where the walker dies. Henry wants the story **shown**, so he can see it at a glance and then choose what to fix.

**What we already know** (170c, `docs/balance/walker-deaths-170.md`, 30 seeds times 12 starters, tier 0):

- 9 in 10 walks never reach the gym. The first-biome elite alone ends 42% of walks.
- 72% of deaths are a party of one: the walker rarely recruits.
- 55% die holding a recruit blueprint they never used, and 67% die holding 45 scrap or more.
- The default walker buys no upgrades.
- It wins about 89% of wild fights, so the fights are not the main problem. The choices around them are the suspects.

**The form is the point.** This is a short page of pictures, not a report to read.

- It is a published page (an Artifact), not a markdown file. The repo keeps only the data script and its output file.
- **Six pictures at most.** Each has one line saying what to look at. No paragraph longer than three sentences. One line at the very top says the verdict.
- The pictures should answer, in this order:
  1. Where do walks end? (fights won before dying, coloured by what killed the walk)
  2. How big is the party when it dies, compared with Henry's own logged runs?
  3. What was left unspent at death: scrap, blueprints, upgrades?
  4. Deck size and party size fight by fight, the walker next to Henry.
  5. Which of these gaps is the biggest? (the three most likely fixes, ranked, each with its number)
- If a number cannot be read from a log, the page says so. It does not guess.

## How to work this ticket

1. **Read the whole row first.** Search for the names quoted in it; line numbers drift.
2. **Test first, run it on the parent, see it fail** (row 187a).
3. **No change to anything under `src/engine`, `src/ui` or a data JSON file.** Only `src/debug/balance/` and `docs/balance/`. If a row seems to need more, stop and ask Henry.
4. **Commits** authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`), no `Co-Authored-By`, last line `HANDOFF: <one sentence>`. **Do not push.** One commit per row, stage explicit paths only.
5. **Line endings:** CRLF in `docs/wayfinder`, LF in `src/debug` and JSON.
6. **Report** in plain English, ending with the decisions Henry owes.

| Row | What | Depends on |
|---|---|---|
| 187a | The data: a script that collects, fight by fight, the party size, deck size, scrap, unused blueprints and upgrades, and what killed the walk, for the walker (the same 30 seeds times 12 starters as 170c) and for Henry's logged runs under `playtest-results/` | none |
| 187b | The page: the pictures above, published as an Artifact | 187a |
| 187c | Henry picks the fixes from the page. Each pick becomes a 170d row, with the rules 170d already has (a walker policy change only, behind an option that is off by default, measured on the same seeds, kept only if it moves reach-the-gym by 5 points or more) | 187b |
