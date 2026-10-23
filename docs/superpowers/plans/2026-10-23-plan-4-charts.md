# Plan 4: Charts & Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trend and form visuals: goals for/against per game night on Home, a player form chart, 🔥/🧊 hot/cold per the spec rule, and a division journey from season snapshots.

**Architecture:** Pure series builders in `lib/stats/trends.ts` (tested) feed small Recharts client components in `components/charts/*`. Charts follow the dataviz skill:
- one axis per chart
- thin marks with 4 px rounded data ends, 2 px gaps between bars
- hover tooltip on every chart
- a legend whenever there are 2 or more series, and every chart has a "Show as table" `<details>`

**Tech Stack:** Recharts 3 (client components), existing stack.

**Spec:** §4 (Home trend chart, player form chart), §5 (Hot/cold rule), §8 phase 4.

## Global Constraints

- **Chart palette** (validated with dataviz `validate_palette.js`, dark mode, surface `#0d1424`: all checks pass; normal ΔE 29.7, deutan ΔE 19.1): **us `#2f9be0`**, **them `#e5506a`**. A single-series chart uses `#2f9be0`. Text never uses series colors (it uses `--fg` and `--muted-fg`).
- Gridlines `rgba(255,255,255,0.06)`, axis text `--muted-fg` 10 px, no axis lines. Tooltip uses an `arena-card` look.
- **Hot/cold (spec §5):** only players with ≥ 8 club games (skater games). `last5PPG` = points over their own last 5 skater games / 5; `overallPPG` = club points / club games.
  - 🔥 hot when `last5PPG ≥ overallPPG × 1.25` and `last5PPG > 0`
  - 🧊 cold when `last5PPG ≤ overallPPG × 0.75`
  - otherwise neutral
- Charts render nothing when the series is empty, and show the hint "Trends appear after a few game nights" when there are fewer than 2 points.
- Commit with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A single game night** (only one point): no broken axis; the hint shows. → Task 1 test (series length) + Task 3 e2e screenshot.
2. **A player with < 8 games:** never labeled hot/cold. → Task 1 test.
3. **A summary-only game in a night:** counts toward night GF/GA (score known) but not toward player form. → Task 1 test.
4. **Division journey with all snapshots in one division:** a single "Division 8 since Oct 23" chip, no chart. → Task 1 test.
5. **Very long night labels or many nights** (> 12): the chart shows the last 12 nights. → Task 1 test.

---

### Task 1: Trend series + hot/cold (pure)

**Files:** Create `lib/stats/trends.ts`, `tests/stats/trends.test.ts`

**Interfaces:**
- `nightSeries(nights: GameNight[], max = 12): { key: string; label: string; goalsFor: number; goalsAgainst: number; wins: number; losses: number }[]`: oldest → newest, the last `max` nights.
- `playerForm(lines: PlayerLine[], games: GameLite[], n = 10): { matchId: string; label: string; goals: number; assists: number; points: number; outcome: "W" | "L" }[]`: the player's last `n` skater games, oldest → newest. `label` = `"Oct 22"` in Amsterdam time.
- `type Heat = "hot" | "cold" | null`; `heat(lines: PlayerLine[], games: GameLite[], eaPlayerId: string): Heat` (rule above)
- `heatMap(lines, games, ourClubId): Map<string, Heat>` for all our skaters
- `divisionJourney(snapshots: { takenAt: Date; division: number }[]): { division: number; from: Date; to: Date }[]`: consecutive runs of the same division, oldest first.

- [ ] **Step 1: Failing tests:**
  - `nightSeries(groupGameNights(games))` gives 3 points oldest first: `["Sun Oct 18",0,5]`, `["Tue Oct 20",8,2]`, `["Thu Oct 22",29,20]` as `[label, GF, GA]`.
  - 15 synthetic nights → length 12, ending with the newest.
  - `playerForm(lines, games)` for 828785353 gives 9 entries; the last is `{ matchId: "2782817800237", goals: 0, assists: 1, points: 1, outcome: "L" }`.
  - Summary games never appear in `playerForm`.
  - `heat` for ThePooker (9 games: last 5 = 7G 9A = 16 pts → 3.2 PPG vs overall 21/9 = 2.33 → ×1.37) → `"hot"`.
  - A player with 6 games → `null`.
  - Synthetic cold case → `"cold"`.
  - `divisionJourney` with 3 snapshots all in Div 8 → 1 run; with Div 9 then Div 8 → 2 runs in order.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5:** Commit.

---

### Task 2: Chart components

**Files:** `pnpm add recharts`. Create `components/charts/NightTrendChart.tsx` (grouped bars GF/GA per night, legend "Goals for · Goals against" with swatches, direct value labels only on the newest night, tooltip with record and GF-GA), `components/charts/FormChart.tsx` (bars = points per game, a W/L tick under each bar via a custom axis tick in win/loss text colors, tooltip "Oct 22 · 1G 2A · W"), `components/charts/ChartFrame.tsx` (title, legend slot, children, `<details>` table view), `components/club/HeatBadge.tsx` (🔥 or 🧊 with `aria-label` "Hot"/"Cold").

- [ ] **Step 1:** Implement (client components; `ResponsiveContainer` height 180; bar `radius={[4,4,0,0]}`; `barGap={2}`; `isAnimationActive` respects reduced motion).
- [ ] **Step 2:** Build passes.
- [ ] **Step 3:** Commit.

---

### Task 3: Wire into pages + e2e

**Files:** Modify:
- `app/page.tsx`: NightTrendChart after LatestNight; HotPlayers shows the HeatBadge from `heatMap`
- `components/club/Leaders.tsx`: HeatBadge after the name; heat passed in from the server
- `app/players/[playerId]/page.tsx`: FormChart after the stat tiles; HeatBadge in the header; "Division journey" omitted here
- `app/page.tsx`: Division journey chip row under the trophy case (from `club_snapshots`; add `snapshotHistory(db)` to `lib/queries/club.ts` and a cached `getSnapshotHistory()` returning `{ takenAt, division }[]`)
- `e2e/smoke.spec.ts`: assert the Home chart region `[aria-label="Goals for and against per game night"]` exists, and the player page form chart exists

- [ ] **Step 1:** Implement. **Step 2:** `pnpm test && pnpm build && pnpm e2e`, all green. **Step 3:** Look at the Home and player screenshots, then fix collisions or overflow (dataviz step 7). **Step 4:** Commit, push, Fable review, fix pass, merge.
