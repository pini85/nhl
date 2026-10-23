# Plan 6: Extras II (player cards, compare, what-if, celebrations, fun facts, Wrapped) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The playful layer teammates share in the group chat: FUT-style player cards, a two-player comparison, a season what-if simulator, celebrations when promotion or the title is clinched, auto-generated fun facts, and a swipeable "Wrapped" recap.

**Architecture:** Pure functions in `lib/stats/` (tested) + client components for interaction (simulator, compare picker, Wrapped stories). No new tables.

**Tech Stack:** existing; `motion` for the Wrapped slides and confetti (no new confetti library: a small canvas or motion particle component).

**Spec:** §8b (user: creative extras, no approval needed); research list in Plan 5.

## Global Constraints

- Plans 2–5 constraints apply.
- **Player card ratings** (full games only, skaters with ≥ 3 games; goalies get a GK card):
  - `OFF` = avg `ratingOffense`, `DEF` = avg `ratingDefense`, `TEAM` = avg `ratingTeamplay`. These are EA's 0–100 per-game ratings; round them.
  - `OVR` = round((OFF + DEF + TEAM) / 3)
  - Extra facets for display:
    - `SHO` = clamp(round(shotPct × 2 + shotsPerGame × 5), 0, 99)
    - `PHY` = clamp(round(hitsPerGame × 12), 0, 99)
    - `PLY` = clamp(round(assistsPerGame × 30 + passPct × 0.3), 0, 99), with passPct 0–100 from passes/passAttempts
  - Tier color by OVR: ≥ 85 gold, ≥ 75 silver, else bronze (use `--otl-fg` gold, `#c0c8d8` silver, `#c98b5a` bronze).
  - Form arrow: ↑ when the player is hot (Plan 4 `heat`), ↓ when cold.
  - GK card: `OVR` = round(savePct × 100), plus GAA and GP.
- **What-if simulator:** starts from the current `seasonResults` and lets the user toggle each remaining slot through blank → W → OTL → L. It recomputes with `seasonProgress`, shows the state label and outlook live, and has a "Reset" button. It's pure client state, never saved.
- **Celebration:** when the season state is `promotion-zone` or `title-zone`, show confetti once per device per season. The key is `localStorage` `celebrated:<division>:<seasons>:<state>`, with every access wrapped in try/catch. It respects `prefers-reduced-motion` (no animation, just a banner).
- **Fun facts:** generated server-side, each with a numeric "interest" score. Show the top 3 on Home, rotating per day by date seed. Candidates (each skipped when its data is missing or the sample is small, under 3 games):
  - team record when X scores ≥ 1 point
  - best shooting % (≥ 10 shots)
  - hits leader
  - most common opponent
  - longest current player point streak
  - guest of honor (top-scoring guest)
  - goalie save % leader
  - comeback/blowout counts (wins by ≥ 4)
  - late-night form: record in games starting after 23:00 Amsterdam time
- **Wrapped** (`/wrapped`), 6–8 full-screen slides with tap or swipe to advance and a progress bar on top:
  1. total games and record
  2. goals scored and allowed
  3. top scorer
  4. hit machine
  5. best night
  6. nemesis (or most-played club)
  7. awards count leader
  8. "See you on the ice": share button

  Scope is all time, with a month picker when ≥ 2 months of data exist. Each slide has the big glow number plus one playful line.
- Commit with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Player with < 3 games:** no card, and the hint "Card unlocks after 3 games". → Task 1 test.
2. **Simulator when the season is complete** (10 played): slots locked; shows the final state. → Task 3 test (pure helper).
3. **localStorage unavailable** (private mode): the celebration still renders without crashing. → Task 4 (try/catch, e2e with `localStorage` throwing).
4. **Fun facts on a tiny dataset:** never shows a fact built on < 3 games. → Task 5 test.
5. **Wrapped with no nemesis** (no club with ≥ 2 games): falls back to the most-played club slide. → Task 6 test.

---

### Task 1: Player cards
**Files:** `lib/stats/cards.ts`, `tests/stats/cards.test.ts`, `components/club/PlayerCard.tsx`; modify the player page (card at the top), the Leaders rows (OVR column), and `app/players/[playerId]/opengraph-image.tsx` (card image).
**Interfaces:** `playerCard(lines, games, eaPlayerId): { kind: "skater"; ovr; off; def; team; sho; phy; ply; tier: "gold"|"silver"|"bronze"; gp } | { kind: "goalie"; ovr; gaa; gp; tier } | null`
- [ ] Failing tests: ThePooker's card OFF/DEF/TEAM equal the rounded averages of his 9 fixture ratings (compute them in the test from fixture lines with an independent reducer and pin the literals); a player with 2 games → null; the goalie Liengutten gets kind "goalie" with ovr = round(38/48×100) = 79. Then implement → green → UI → commit.

### Task 2: Compare two teammates
**Files:** `app/players/compare/page.tsx`, `components/club/CompareView.tsx` (client: two selects, defaulting to the top-2 scorers; mirrored horizontal bars per stat, blue vs red using the chart palette; legend with names; table view), `lib/stats/compare.ts` + test (`compareRows(a: SkaterTotals, b: SkaterTotals)` → rows `{label, a, b, better: "a"|"b"|"tie"}`; GAA-style lower-is-better respected).
- [ ] Test-first, implement, link "Compare" from the Leaders header, then commit.

### Task 3: Season what-if simulator
**Files:** `lib/stats/whatif.ts` + test (`cycle(slot)`, `applyWhatIf(seasonResults, picks)` → new results array; complete season → no editable slots), `components/club/WhatIf.tsx` (client, inside SeasonCard: "What if?" toggle reveals the tappable strip and a live outlook).
- [ ] Test-first; e2e: tap 1 slot to W on Home → the outlook text changes to "Promotion secured…"; commit.

### Task 4: Celebrations
**Files:** `components/club/Celebrate.tsx` (client; motion particles ~80 confetti pieces in team colors; a banner "⬆ Promotion clinched!" or "🏆 Division title!"), rendered on Home when the state qualifies.
- [ ] e2e: with `localStorage.getItem` throwing (via `addInitScript`), Home still renders. Commit.

### Task 5: Fun facts
**Files:** `lib/stats/funfacts.ts` + test, `components/club/FunFacts.tsx` (Home card "Did you know?").
- [ ] Failing tests: on the fixtures, the facts include "Record when ThePooker scores: X-Y" (pin X-Y from the fixtures); with a 2-game dataset → `[]`. Implement, then commit.

### Task 6: Wrapped
**Files:** `lib/stats/wrapped.ts` + test (`buildWrapped(games, lines, clubs, range)` → slides data), `app/wrapped/page.tsx`, `components/club/WrappedStory.tsx` (client; tap left/right halves, auto-advance off, progress bars, motion transitions, reduced-motion fallback), a link from Home ("Your season, wrapped →").
- [ ] Failing tests: all-time on fixtures → slide "games" = 10 with record 7-3; nemesis is absent → the most-played slide is used. Implement → e2e (`/wrapped` renders, the next tap advances) → commit → push → Fable review → fixes → merge.
