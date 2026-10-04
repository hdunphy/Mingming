#!/usr/bin/env bash
#
# overnight.sh: one command for the nightly agent playtest (tickets 180 and 193).
#
#   bash scripts/overnight.sh                  Night A (haiku) then Night B (sonnet), the 2026-10-04 seeds
#   MODELS=haiku bash scripts/overnight.sh     only one model
#   SEED_DATE=fresh bash scripts/overnight.sh  new worlds tonight (seeds named after tonight's date)
#   DRY_RUN=1 bash scripts/overnight.sh        run the checks and print each night's plan; play nothing
#
# What it does, in order, stopping at the first problem before anything costs tokens:
#   1. checks: Claude Code is installed, no ANTHROPIC_API_KEY (that would bill instead of using the plan),
#      and the playtest tool plays a few real moves through its command line in every mode;
#   2. for each model, plays the night (`npm run playtest:night`), one folder per model:
#      results/playtest/<date>-<model>/ ; the morning report is written for each by the night script
#      to docs/playtest/agent-runs/<date>-<model>.md;
#   3. prints where everything is, and exits non-zero if any night failed.
# Everything is also kept in results/playtest/overnight-<date>.log.
#
# Run it from Git Bash (or WSL with its own node_modules), at the repo root, on branch first-impressions.
# Keep the PC awake and plugged in. It is safe to run again the same day: finished sessions are skipped.
#
# Settings (environment variables; the defaults are the Night A / Night B recipe from ticket 193):
#   DATE        the night's name, fixed once at the start so a night that runs past midnight keeps one folder (today)
#   SEED_DATE   which night's worlds to play: a date, or "fresh" to use DATE            (2026-10-04)
#   MODELS      models in order, space separated                                        ("haiku sonnet")
#   RUNS        sessions per night                                                      (9)
#   STARTER     the starter every session plays, or "all" for the twelve in turn         (kraken_v1)
#   CARD_RUNS   how many sessions play every card themselves                            (0)
#   MINUTES     wall-clock limit per session                                            (25)
#   MAX_USD     Claude Code's own size estimate cap per session; a yardstick, not a bill (3)
#   BRIEF       path of another brief for the driver                                    (the default brief)
set -u

cd "$(dirname "$0")/.." || exit 1

DATE="${DATE:-$(date +%F)}"
SEED_DATE="${SEED_DATE:-2026-10-04}"
[ "$SEED_DATE" = "fresh" ] && SEED_DATE="$DATE"
MODELS="${MODELS:-haiku sonnet}"
RUNS="${RUNS:-9}"
STARTER="${STARTER:-kraken_v1}"
CARD_RUNS="${CARD_RUNS:-0}"
MINUTES="${MINUTES:-25}"
MAX_USD="${MAX_USD:-3}"
BRIEF="${BRIEF:-}"
DRY_RUN="${DRY_RUN:-}"

mkdir -p results/playtest
LOG="results/playtest/overnight-$DATE.log"
exec > >(tee -a "$LOG") 2>&1

say() { printf '%s %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { say "STOP: $*"; exit 1; }

say "overnight playtest for $DATE: models [$MODELS], $RUNS sessions each, starter $STARTER, seeds from $SEED_DATE"

# ---- 1. checks ----------------------------------------------------------------------------------
say "check 1/3: Claude Code"
if [ -n "$DRY_RUN" ]; then
    say "  (dry run: not checked)"
elif ! claude --version >/dev/null 2>&1; then
    die "'claude' was not found. Open a new terminal and try 'claude --version'; sign in once by running 'claude'."
else
    say "  $(claude --version 2>&1 | head -1)"
fi
if [ -n "${ANTHROPIC_API_KEY:-}" ] && [ -z "${ALLOW_API_KEY:-}" ]; then
    die "ANTHROPIC_API_KEY is set, so Claude Code would bill that account instead of using your plan. Run 'unset ANTHROPIC_API_KEY' (or set ALLOW_API_KEY=1 if you mean it)."
fi

say "check 2/3: the playtest tool plays real moves through its command line, in every mode"
SMOKE="results/playtest/.overnight-check-$$"   # inside the repo (git ignores results/), so no path conversion on Windows
mkdir -p "$SMOKE"
trap 'rm -rf "$SMOKE"' EXIT
for mode in run turn card; do
    first="$(npm run --silent playtest -- new --results "$SMOKE" --session "$mode" --seed overnight-check --starter kraken_v1 --gym 2 --mode "$mode" 2>&1)" \
        || die "the playtest tool could not start a $mode session: $first"
    case "$first" in *"RUN FORECAST"*) ;; *) die "the first screen of a $mode session has no run forecast (ticket 193j). Something changed in the tool." ;; esac
    for i in 1 2 3 4 5 6; do
        out="$(npm run --silent playtest -- move --results "$SMOKE" --session "$mode" 1 --why "overnight check" 2>&1)" \
            || die "move $i of a $mode session failed: $out"
    done
    say "  $mode: ok"
done

say "check 3/3: the night's plan"
PLAN_ARGS=(--date "$DATE-check" --seed-date "$SEED_DATE" --runs "$RUNS" --card-runs "$CARD_RUNS" --model haiku --dry-run)
[ "$STARTER" != "all" ] && PLAN_ARGS+=(--starter "$STARTER")
plan="$(npm run --silent playtest:night -- "${PLAN_ARGS[@]}" 2>&1)" || die "the night script could not plan the night: $plan"
say "  $(printf '%s\n' "$plan" | grep -c '^r[0-9][0-9]: seed') sessions planned; first: $(printf '%s\n' "$plan" | head -1)"

# ---- 2. the nights ------------------------------------------------------------------------------
failed=0
for model in $MODELS; do
    night="$DATE-$model"
    args=(--date "$night" --seed-date "$SEED_DATE" --runs "$RUNS" --card-runs "$CARD_RUNS" --model "$model" --minutes "$MINUTES" --max-usd "$MAX_USD")
    [ "$STARTER" != "all" ] && args+=(--starter "$STARTER")
    [ -n "$BRIEF" ] && args+=(--brief "$BRIEF")
    [ -n "$DRY_RUN" ] && args+=(--dry-run)
    say "night: $model -> results/playtest/$night"
    say "  npm run playtest:night -- ${args[*]}"
    if ! npm run --silent playtest:night -- "${args[@]}"; then
        say "  the $model night stopped with an error (see above)"
        failed=1
    fi
done

# ---- 3. where things are ------------------------------------------------------------------------
say "done. Reports (read the table at the top first):"
for model in $MODELS; do
    say "  docs/playtest/agent-runs/$DATE-$model.md   (sessions in results/playtest/$DATE-$model/)"
done
say "log: $LOG"
exit "$failed"
