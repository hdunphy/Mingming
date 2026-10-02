# Running the agent playtester tonight

This is the plain checklist for the first real night (ticket 180). The tool itself is tested, but the
headless Claude command it uses has only ever been run against a stand-in, so the first run is a
small trial. Do the steps in order and stop at the first one that fails.

Run everything from the repo folder, on branch `first-impressions`, in PowerShell or a terminal.
Use the date as a flag (`--date 2026-10-02`) so the night keeps one folder even if it runs past midnight.

## Before you start

1. **Claude Code is installed and signed in.** `claude --version` prints a version. If it asks you to
   sign in, do that once by running `claude` and then leaving it.
2. **Packages are installed.** `npm install` has been run on this branch.
3. **The other agent is not changing game code overnight.** The night uses whatever is checked out. Each
   session is saved as a seed plus its moves and is replayed to build the report, so if the game's code
   changes between the night and the morning, an old session can replay differently. Leave the screens
   work alone until the report is written, or run the report first thing.
4. **The PC stays awake and plugged in.** Turn off sleep for the night. Sessions run one after another.

## Step 1: look at the plan (free, takes seconds)

    npm run playtest:night -- --dry-run --runs 3 --date 2026-10-02

It prints three sessions (seed, starter, gym, mode) and the exact command it would run for each. It
starts nothing. Check the command ends with `--tools Bash --permission-mode dontAsk --allowedTools ...`.

## Step 2: one small trial (a few cents to a few dollars)

    npm run playtest:night -- --runs 1 --minutes 15 --max-usd 1 --date 2026-10-02 --no-report

One session in `run` mode (the game's own AI plays the fights; the agent makes the choices). When it
ends, look at what it left in `results/playtest/2026-10-02/r01/`:

- `driver.json`: `exitCode` should be 0, and it shows minutes, tokens and cost. **Write the cost down:**
  it sizes the full night.
- `session.json`: the moves with the agent's one-sentence reasons and its notes.
- Read the story it played: `npm run playtest -- state --session r01 --results results/playtest/2026-10-02`

Then build the report for just this trial and read it:

    npm run playtest:report -- 2026-10-02

It writes `docs/playtest/agent-runs/2026-10-02.md`. Delete `results/playtest/2026-10-02` and that
report before the full night, so the night starts clean.

**If the trial fails**, the reason is almost always one of these, and none touches the game:

- `exitCode` is not 0 and `driver.json` has an `error`, or `claude` was not found: Claude Code is not on
  PATH. Open a new terminal and try `claude --version`.
- Claude Code rejects a flag (the message names it): this version does not know that flag. Edit the
  list in `driverCommand` in `scripts/playtest-night.mjs` (`--max-turns` and `--max-budget-usd` are the
  likeliest) and run the trial again. The test for that function is in `src/debug/playtest/night.test.ts`;
  update it with the change.
- The agent says it is not allowed to run the command: the allow list is
  `Bash(npm run playtest -- *)`. Run `claude -p "run: npm run playtest -- plan --date 2026-10-02" --tools Bash --allowedTools "Bash(npm run playtest -- *)"`
  by hand to see the real message.
- The agent made no moves: open `session.json`. If `moves` is empty, the agent never got going; the
  message at the end of the driver's output (run the `claude -p` command by hand) says why.

## Step 3: the night

When the trial looks like a real playthrough, run the night. Ten sessions is the default (nine in `run`
mode and one in `card` mode, where the agent predicts every card and so finds wording bugs).

    npm run playtest:night -- --date 2026-10-02

Sizing, from the trial: sessions are capped at 25 minutes each and `--max-usd 3` each, so ten sessions
can take about four hours and cost up to $30 at the worst. If the trial's cost was higher than you like,
start smaller: `--runs 5 --max-usd 2`. The `card` session is much longer than the others (500 to 700 calls
against 50 to 80), so give it room or leave it out with `--card-runs 0`.

To stop, press Ctrl+C. To pick up again, run **the same command with the same `--date`**. A session that
has a `driver.json` is finished and skipped, and one that was cut off carries on from its saved moves.

## Step 4: the morning

The script writes the report when the last session ends. If it did not (you stopped it, or used
`--no-report`):

    npm run playtest:report -- 2026-10-02

Open `docs/playtest/agent-runs/2026-10-02.md`. From the top:

1. **Invariant failures** are likely bugs. Each has a replay command that shows the screen at that move.
2. **Surprises** are cards or screens where the agent's prediction was wrong. Each is either a bug,
   wording that misled, or the agent being wrong; the list shows the card text next to what happened.
3. **Runs**: one line each, with tokens and minutes. Add up the cost from the `driver.json` files.
4. **Notes** and **decision patterns** are for balance and wording.

Nothing here is committed for you. `results/playtest/` is ignored by git; the report file under
`docs/playtest/agent-runs/` is new and untracked, so commit it yourself if you want to keep it.

## What to tell the next session

Send back the report plus the cost and time from the trial. Those are the numbers ticket 180g (the
pilot) needs to settle the driver, the model and how many runs a night.
