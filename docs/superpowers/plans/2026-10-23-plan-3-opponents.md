# Plan 3: Opponents & Scouting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Opponents tab and a scouting page for any club: head-to-head, nemesis/punching bags, their dangerous players, lineup, goalie, quit rate, play style vs ours, and current form. A home-page nemesis strip and quick search.

**Architecture:** Vercel can't reach EA, and browsers can't either (EA rejects foreign origins with 403). The **GitHub collector** therefore keeps an `opponent_snapshots` table fresh: recent opponents every 6 h, plus any club a user asks to scout via a `scout_requests` queue that the site writes to with a Server Action. Everything else (H2H, dangerous players vs us, lineup in our games) comes from our own archived games. Pure functions in `lib/stats/opponents.ts`.

**Tech Stack:** as Plan 2 (Next 16 Cache Components, Drizzle/Neon, Vitest/PGlite, Playwright)

**Spec:** `docs/superpowers/specs/2026-10-23-drop-drop-drop-club-stats-design.md` §4 Opponents/Scouting, §5 Nemesis and Scouting rules, §8 phase 3

## Global Constraints

- Everything from Plan 2's Global Constraints (theme, mobile, cache profile, Suspense for params, `CLUB_TAG`).
- Opponent pages use tag `CLUB_TAG` (one tag; the collector revalidates it after any change, including opponent snapshots).
- **Nemesis:** opponents with ≥ 2 games (full + summary), ranked by lowest win %, then lowest goal difference, then most games; top 3. **Punching bags:** highest win %, then highest GD, then most games; top 3. Win % = W / GP.
- **Quit rate** (per club roster from `members/stats`): `Σ(gamesplayed − gamesCompleted) / Σ gamesplayed`. Show ⚠️ when ≥ 10 %.
- **Play-style labels** compare their per-game averages over their stored recent matches against our all-time per-game averages from `match_clubs`. A label applies when theirs ≥ 1.2× ours (or ≤ 0.8× for the "low" labels):
  - hits ≥ 1.2× → "Very physical"
  - shots ≥ 1.2× → "Shoots a lot"
  - PIM ≥ 1.2× → "Takes penalties"; PIM ≤ 0.8× → "Disciplined"
  - faceoff % ≥ 1.1× → "Strong on faceoffs"
  - pass % ≥ 1.1× → "Passes well"
- **Human goalie:** a club "usually has a human goalie" when a `goalie` position appears in ≥ 50 % of their recent matches.
- **Opponent refresh budget:** at most 6 clubs per collector run.
  - Order: pending scout requests first, then clubs we played in the last 14 days whose newest snapshot is older than 6 h, most recently played first.
  - Each club costs 4 EA calls: `clubs/search` or `clubs/info` (name/crest/division), `members/stats`, `clubs/matches gameType5`, `clubs/seasonalStats`.
- **Scout request** search: `clubs/search?clubName=` returns an object keyed by clubId. Exact case-insensitive name match first, else the first result. No result → status `not_found`.
- Commit with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A club scouted but never played:** the scouting page shows live-snapshot sections and "No games against them yet", with no H2H errors. → Task 5 test.
2. **Scout request for a name with no results:** marked `not_found`; the UI says "No club found" instead of spinning forever. → Task 2 test.
3. **Opponent club with 0 members or 0 recent matches** (inactive club): profile fields null; the page hides those sections. → Task 1 test.
4. **Duplicate scout requests** (double tap): only one pending row per normalized query. → Task 4 test.
5. **Collector run with the opponent budget exhausted by failures:** our own games and snapshot still save; opponent failures are warnings. → Task 2 test.

---

## File Structure

```
db/schema.ts                     (modify) opponent_snapshots, scout_requests
lib/ea/schemas.ts, lib/ea/api.ts (modify) searchClubs(), clubInfo()
lib/opponents/profile.ts         buildProfile(matches, clubId) from EA matches → OpponentProfile
lib/collector/opponents.ts       refreshOpponents()
lib/collector/collect.ts         (modify) call refreshOpponents after our own work
lib/stats/opponents.ts           headToHead, nemesis, punchingBags, dangerousPlayers, playStyle, quitRate, usualLineup
lib/queries/opponents.ts         DB reads
lib/data/opponents.ts            cached wrappers
app/opponents/page.tsx           list + search + nemesis cards
app/opponents/actions.ts         requestScout server action
app/clubs/[clubId]/page.tsx      scouting page
components/club/OpponentSearch.tsx, OpponentRow.tsx, NemesisCards.tsx
app/page.tsx                     (modify) nemesis strip + search link
tests/opponents/*.test.ts, e2e/smoke.spec.ts (extend)
```

---

### Task 1: Opponent tables, EA search/info, profile builder

**Files:** Modify `db/schema.ts`, `lib/ea/schemas.ts`, `lib/ea/api.ts`, `tests/helpers/fixture-ea.ts`. Create `lib/opponents/profile.ts`, migration, `tests/opponents/profile.test.ts`, `tests/ea/api.test.ts` (extend).

**Interfaces:**
- `opponent_snapshots`:

  | Column | Type |
  |---|---|
  | `id` | serial |
  | `clubId` | int, indexed |
  | `takenAt` | timestamptz |
  | `name` | text |
  | `crestAssetId` | text, null |
  | `division` | int, null |
  | `wins`, `losses`, `otl` | int |
  | `seasonResults` | jsonb `string[]` |
  | `members` | jsonb `RosterMember[]`, null |
  | `profile` | jsonb `OpponentProfile`, null |
  | `raw` | jsonb |

- `scout_requests`:

  | Column | Type |
  |---|---|
  | `id` | serial |
  | `query` | text |
  | `normalized` | text, unique where status = 'pending' |
  | `requestedAt` | timestamptz |
  | `status` | `'pending' \| 'done' \| 'not_found' \| 'error'` |
  | `clubId` | int, null |
  | `processedAt` | timestamptz, null |

- `EaApi.searchClubs(name: string): Promise<EaResult<{ clubId: number; name: string; crestAssetId: string | null; division: number | null; wins: number; losses: number; otl: number; seasonResults: string[]; raw: Record<string, unknown> }[]>>` (`clubs/search?platform&clubName`; response object keyed by clubId; `name` from `clubInfo.name`)
- `EaApi.clubInfo(clubId: number)`: the same shape for one club. It's implemented as `seasonalStats` + `clubs/info?clubIds`.
- `type OpponentProfile = { matches: number; avg: { shots: number; hits: number; pim: number; faceoffPct: number; passPct: number; goalsFor: number; goalsAgainst: number }; humanGoalieShare: number; lineup: { name: string; position: string; games: number }[]; platforms: Record<string, number>; avgPlayerLevel: number; usualHourCet: number | null }`
- `buildProfile(matches: EaMatch[], clubId: number): OpponentProfile | null`: null when `matches` is empty. The lineup lists the most frequent position per player name, sorted by games desc. `usualHourCet` is the mode of the Europe/Amsterdam hour of the match timestamps.

- [ ] **Step 1: Failing tests.**
  - `buildProfile(recoveredMatches.filter(m => "1616" in m.clubs), 1616)` gives `matches: 5`, `humanGoalieShare` between 0 and 1, and a non-empty lineup. The player count equals the distinct names.
  - `buildProfile([], 1)` is null.
  - `searchClubs` parses `clubs-search.json`, giving one result `{ clubId: 56507, name: "Drop drop drop", crestAssetId: "104", division: 8 }`.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement.** Generate the migration and migrate the live DB. **Step 4: Run.** Expected: PASS. **Step 5: Commit.**

---

### Task 2: Collector refreshes opponents and processes scout requests

**Files:** Create `lib/collector/opponents.ts`, `tests/collector/opponents.test.ts`. Modify `lib/collector/collect.ts` (call it last, inside its own try/catch; add `opponentsRefreshed: number` to `CollectSummary`), `db/repo.ts` (helpers below).

**Interfaces:**
- `refreshOpponents(deps: { db; ea; now }, budget = 6): Promise<{ refreshed: number; warnings: string[] }>`
- Repo helpers:
  - `pendingScoutRequests(db, limit)`
  - `markScoutRequest(db, id, status, clubId?)`
  - `staleRecentOpponents(db, now, limit)`: clubIds played in the last 14 days with no snapshot newer than 6 h, ordered by last game desc
  - `insertOpponentSnapshot(db, row)`

**Algorithm:**
1. Process pending requests (oldest first, within the budget): `searchClubs(query)`.
   - No results → `not_found`.
   - EA error → leave `pending`, warning `scout-failed:<id>`.
   - Otherwise pick the match, refresh that club and mark it `done` with its clubId.
2. Fill the remaining budget with `staleRecentOpponents`.
3. **Refreshing a club:** `clubInfo` (or the search result), `members`, `clubMatches(gameType5)`, then insert a snapshot with `buildProfile`. A partial failure still inserts with null fields. If all calls fail, it's a warning only.

- [ ] **Step 1: Failing tests** (PGlite + fixture EA extended so `searchClubs("Sivudeke")` returns club 17024, and `searchClubs("zzz")` returns `[]`):
  - after seeding, `refreshOpponents` writes snapshots for at most 6 clubs from the recent opponents, none older than 6 h on a second run (0 refreshed)
  - a pending request "Sivudeke" becomes `done` with clubId 17024
  - "zzz" becomes `not_found`
  - EA down for opponents → `collect` status is still `ok`, with warnings
- [ ] **Steps 2–5:** run / implement / run / commit.

---

### Task 3: Opponent stats

**Files:** Create `lib/stats/opponents.ts`, `tests/stats/opponents.test.ts`

**Interfaces:**
- `type H2H = { clubId: number; name: string | null; gp: number; wins: number; losses: number; goalsFor: number; goalsAgainst: number; winPct: number; goalDiff: number; lastPlayedAt: Date; games: GameLite[] }`
- `headToHead(games: GameLite[]): H2H[]`: one per opponent, sorted by `lastPlayedAt` desc. `name` is the latest non-null `opponentName`.
- `nemesis(h2h: H2H[], n = 3): H2H[]`; `punchingBags(h2h: H2H[], n = 3): H2H[]` (rules in Global Constraints)
- `dangerousPlayers(lines: PlayerLine[], opponentClubId: number): { name: string; gp: number; goals: number; assists: number; points: number }[]`: their lines in games vs us, top 5 by points, then goals.
- `playStyle(profile: OpponentProfile, ours: { shots: number; hits: number; pim: number; faceoffPct: number; passPct: number }): string[]`
- `ourAverages(clubs: MatchClubRow[], ourClubId: number)`: per-game averages from `match_clubs`
- `quitRate(members: RosterMember[] | null): number | null`: uses `raw.gamesplayed` and `raw.gamesCompleted`; null when no games.

- [ ] **Step 1: Failing tests** (fixture games):
  - `headToHead` gives 10 opponents, each gp 1. INFERNAL LEGION is first (latest) `{ wins: 0, losses: 1, goalsFor: 2, goalsAgainst: 4 }`.
  - `nemesis` is `[]` with the fixtures (no club ≥ 2 games). A synthetic second loss vs 1808 makes `nemesis[0].clubId === 1808`.
  - Ordering tie-break test: two clubs at 0 % win, GD −3 vs −1 → −3 first.
  - `dangerousPlayers(lines, 1808)[0]` is `{ name: "Tazzman-Devil", goals: 2, assists: 2, points: 4 }`.
  - `quitRate(fixtureMembers)` = (8+12+10+24)/(46+214+189+123) = 54/572 ≈ 0.0944.
  - `playStyle` with hits 30 vs ours 20 → includes "Very physical"; pim 2 vs ours 10 → includes "Disciplined".
- [ ] **Steps 2–5.**

---

### Task 4: Queries, data wrappers, scout server action

**Files:** Create `lib/queries/opponents.ts`, `lib/data/opponents.ts`, `app/opponents/actions.ts`, `tests/queries/opponents.test.ts`

**Interfaces:**
- `latestOpponentSnapshot(db, clubId)`: newest row or null
- `scoutedClubs(db)`: latest snapshot per club (id, name, crest, division, takenAt)
- `allClubRows(db)`: all `match_clubs` rows (for `ourAverages` and crests)
- `opponentLines(db, clubId)`: `match_players` for that club
- `createScoutRequest(db, query): Promise<"created" | "exists" | "invalid">`: trims, normalizes to lowercase, and ignores empty strings or strings over 40 chars. If a pending row with the same `normalized` value exists → "exists".
- `scoutRequestStatus(db, normalized)`: latest row or null
- Data wrappers: cached (`CLUB_TAG`, `"club"`) `getOpponentSnapshot(clubId)`, `getScoutedClubs()`, `getClubRows()`, `getOpponentLines(clubId)`
- Server action `requestScout(formData)`: calls `createScoutRequest(getDb(), query)` and returns `{ status }`. **Not cached.**

- [ ] **Step 1: Failing tests.**
  - `createScoutRequest` twice with "Sivudeke " / "sivudeke" → "created" then "exists" (Review Focus 4); "" → "invalid".
  - `latestOpponentSnapshot` returns the newest of two.
  - `opponentLines(db, 1808)` has length 6.
- [ ] **Steps 2–5.**

---

### Task 5: Opponents tab, scouting page, home additions

**Files:** Create `app/clubs/[clubId]/page.tsx`, `components/club/OpponentSearch.tsx`, `OpponentRow.tsx`, `NemesisCards.tsx`. Modify `app/opponents/page.tsx`, `app/page.tsx`, `e2e/smoke.spec.ts`.

- **`/opponents`:**
  - `OpponentSearch` (client): input `autoFocus`, `inputMode="search"`. It filters a passed list of `{ clubId, name }` (played and scouted clubs) live.
  - No match and query length ≥ 2 → a "Scout '{query}'" button calls `requestScout`, then shows "Requested. Data appears within ~10 minutes (next collector run)."
  - Then NemesisCards (3 nemesis + 3 punching bags, each with crest, name and record, linking to the scouting page). Hidden when none qualify, with the hint "Nemesis appear after you play a club twice".
  - Then sort chips Recent / Most played / Worst record, and OpponentRow list: crest, name, `W-L`, `GF-GA`, last meeting date.
- **`/clubs/[clubId]`** (Suspense, await params):
  1. **Header:** crest, name, division and record from the latest snapshot (if any). Snapshot age: "Scouted 2 h ago" (client relative time).
  2. **Head-to-head:** record, GD, games list (links to game pages). Otherwise "No games against them yet."
  3. **Dangerous players vs us:** if we've played them.
  4. **Current form:** last 10 season results strip from `seasonResults`.
  5. **Lineup:** profile lineup (position chips); "🥅 Human goalie usually" / "CPU goalie usually".
  6. **Play style:** labels, plus a compact compare table (their avg vs ours: shots, hits, PIM, FO %, pass %).
  7. **Quit rate:** "% of games their players don't finish", with ⚠️ when ≥ 10 %.
  8. **Roster:** members with career P/GP, labeled "NHL 26 career (all clubs)".
  9. **No snapshot and no games** → `notFound()`. **No snapshot but games** → H2H plus a "Scout this club for live info" button (`requestScout` by name).
- **Home:** after HotPlayers, a "Nemesis" compact card (top 1–3, or hidden) and a search row linking to `/opponents` ("Scouting a club? Search").
- **E2E:** add `/opponents` and `/clubs/1808` to the smoke list. Add a test that typing "INFER" shows INFERNAL LEGION.

- [ ] **Step 1:** Implement the components and pages.
- [ ] **Step 2:** `pnpm build`, then `pnpm e2e`. Expected: all pass. Review the screenshots and fix visual issues.
- [ ] **Step 3:** Commit, push, Fable final review, fix pass, merge to main.
