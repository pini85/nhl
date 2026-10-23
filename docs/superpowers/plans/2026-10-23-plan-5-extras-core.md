# Plan 5: Extras I (records, chemistry, nights, awards, sharing, app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The "extras" that make the site fun for teammates: club records and streaks, line chemistry, game-night recap pages, automatic awards and badges, rich link previews for the group chat, and an installable app.

**Architecture:** All new logic is pure functions in `lib/stats/` (tested on the real fixtures), rendered by server components that read the existing cached data (`getGames`, `getOurLines`, `getMatch`, `getClubRows`). There are no new tables: everything is derived from archived games. Share images use Next's `ImageResponse` (`opengraph-image.tsx` per route).

**Tech Stack:** existing (Next 16, Recharts not needed here, `next/og`).

**Spec:** §4 Players Lines/Records, game Share, Extra (add to home screen); §8 phase 5; §8b (user: research and be creative, no approval needed).

## Research → chosen extras (done 2026-10-23, recorded per spec §8b)

**Sources and patterns:**
- Squad apps (Squadius, SquadCard, OnBall): post-game MVP, badges like Winner/MVP/Streak/Blowout/Giant Slayer, evolving player cards, Team of the Week images, season Wrapped.
- Tracker sites: match history, ratings, session recaps, streaks.
- Strava and Spotify Wrapped: shareable year/season recaps with playful labels.
- EA's own club page: record, season progress, trophies, member stats.

**What fits our data:** per-player per-game G/A/+/-/shots/hits/takeaways/blocks/TOI/ratings, and club division per game (`match_clubs.division`, which enables "Giant Slayer").

**Plan 5 (this plan):**
1. Records & streaks
2. Line chemistry plus "with/without you"
3. Game-night recap page
4. Awards & badges (per game and night, with a badge cabinet)
5. Link-preview images (game, night, player)
6. Installable app (manifest and icons)

**Plan 6 (fun layer):**
7. FUT-style player cards built from EA's per-game ratings
8. Compare two teammates
9. Season what-if simulator on the season card
10. Confetti when promotion or the title is clinched
11. Auto-generated fun facts on Home
12. Season Wrapped story (swipeable)

## Global Constraints

- Plan 2–4 constraints apply (theme, mobile-first, cache via `lib/data/*`, Suspense for params, palette `#2f9be0`/`#e5506a` for charts, text never in series colors).
- Only **full** games feed player-based extras. Summary games count only for team results (records like biggest win, win streaks).
- **Award rules** (per player per game, our club only; a game can give several):

  | Award | Rule |
  |---|---|
  | 🎩 Hat trick | goals ≥ 3 |
  | 🎯 Playmaker | assists ≥ 3 |
  | 🔫 Sniper | goals ≥ 2 and goals/shots ≥ 0.5 |
  | 💥 Bruiser | hits ≥ 6 |
  | 🧤 Brick wall | goalie, glShots ≥ 15 and glSaves/glShots ≥ 0.9 |
  | 🔒 Shutout | goalie, glGa = 0 and glShots ≥ 5 |
  | ➕ Mr. Plus | plusMinus ≥ 4 |
  | 🕵️ Pickpocket | takeaways ≥ 4 |
  | 🗡️ Giant slayer | team award to every skater of ours when we win and the opponent's `match_clubs.division` < ours (lower number = higher division) |
  | ⭐ Night MVP | per night (existing `nightMvp`, only if points > 0) |

- **Records:** most goals, assists, points, hits and shots by one player in a game; most goals by the team in a game; biggest win margin; longest win streak (team, chronological, any game type); current streak (W or L run from the newest game); longest player point streak (consecutive *played* full games with ≥ 1 point). Ties: earliest record holder wins.
- **Milestones:** club points 10/25/50/100/200 and club goals 10/25/50/100, plus first hat trick. Each lists the game where it was reached.
- **Chemistry:**
  - Trio = sorted names of our C, LW and RW in a game (exactly one of each).
  - D-pair = our two `defenseMen`.
  - Show at ≥ 3 games together: GP, W-L, win %, GF/GP, GA/GP. Sort by win %, then GP.
  - With/without: for each member with ≥ 3 games, team win % in games they played vs games they didn't (full games only; null when the "without" side has 0 games).
- Commit with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A night with only summary games:** the recap page shows results and hides player sections. → Task 3 test.
2. **Ties in records:** stable and deterministic (earliest wins). → Task 1 test.
3. **A game where we have no C (only 2 forwards, or a position missing):** no trio is produced; no crash. → Task 2 test.
4. **OG image for an unknown match:** returns a generic club card, not a 500. → Task 5 test (route returns 200 image).
5. **Badge cabinet for a goalie-only player:** shows goalie awards only. → Task 4 test.

---

### Task 1: Records, streaks, milestones (pure + Records tab)

**Files:** Create `lib/stats/records.ts`, `tests/stats/records.test.ts`, `components/club/RecordsView.tsx`. Modify `app/players/page.tsx` (Records tab).

**Interfaces:**
- `type RecordItem = { key: string; label: string; value: number; holder: string | null; matchId: string | null; playedAt: Date }`
- `clubRecords(lines: PlayerLine[], games: GameLite[], ourClubId: number): RecordItem[]`. Keys: `goals-game`, `assists-game`, `points-game`, `hits-game`, `shots-game`, `team-goals-game`, `biggest-win`, `win-streak`, `point-streak`.
- `currentStreak(games: GameLite[]): { kind: "W" | "L"; length: number } | null`
- `milestones(lines, games, ourClubId): { label: string; reachedAt: Date; matchId: string; holder: string | null }[]`

- [ ] **Step 1: Failing tests** (fixtures):
  - `goals-game` = 4 by ThePooker (vs Pulp Odysseys, match 2696722690436)
  - `team-goals-game` = 7 (CSKA, match 2780666310166)
  - `biggest-win` = 6 (7-1)
  - `win-streak` = 5: in chronological order, results are Sun L; Tue W W; Thu L(SSK), W(1974, summary), W, W, W, W, L. The longest run is 5 (1974 → CSKA). Confirm the exact count from the fixture timestamps in the test, and pin it.
  - `currentStreak` = `{ kind: "L", length: 1 }`
  - A tie test with two synthetic 3-goal games → the earlier one is the holder.
  - Milestones include "Club goals 10" (any holder null) reached in a game on Tue Oct 20 or later. Compute the expected matchId with a one-off script, then pin it.
- [ ] **Steps 2–4:** red → implement → green. **Step 5:** RecordsView in the Records tab: record cards with value, holder, a link to the game, and the date; a current-streak banner; a milestones timeline. **Step 6:** Build, commit.

### Task 2: Line chemistry + with/without (pure + Lines tab)

**Files:** Create `lib/stats/chemistry.ts`, `tests/stats/chemistry.test.ts`, `components/club/LinesView.tsx`. Modify `app/players/page.tsx` (Lines tab).

**Interfaces:**
- `type Combo = { names: string[]; gp: number; wins: number; losses: number; winPct: number; gfPerGame: number; gaPerGame: number }`
- `chemistry(lines, games, ourClubId, minGames = 3): { trios: Combo[]; pairs: Combo[] }`
- `withWithout(lines, games, ourClubId, minGames = 3): { name: string; withPct: number; withGp: number; withoutPct: number | null; withoutGp: number }[]` (sorted by `withPct − withoutPct` desc, nulls last)

- [ ] **Step 1: Failing tests:**
  - Trio `["Kai_Fretwell18","ThePooker","puck_control"]` (sorted case-insensitively) appears with GP = the number of fixture games where those three played C/LW/RW. Compute and pin it.
  - A game without a center yields no trio.
  - `withWithout` for ThePooker (played all 9) gives `withoutPct: null`.
- [ ] **Steps 2–4.** **Step 5:** LinesView: Trios / D-pairs cards and a "With / without" table, with an empty hint "Lines appear after 3 games together". **Step 6:** Build, commit.

### Task 3: Game-night recap page

**Files:** Create `app/nights/[key]/page.tsx`, `lib/stats/nightRecap.ts`, `tests/stats/nightRecap.test.ts`. Modify `components/club/GamesBrowser.tsx` (night header links to the recap), `components/club/LatestNight.tsx` (a "Night recap →" link).

**Interfaces:**
- `nightRecap(nightKey: string, games: GameLite[], lines: PlayerLine[], ourClubId: number)` returns `null` when no night has that key. Otherwise `{ night: GameNight; mvp; stars: { name; goals; assists; points }[] /* night top 3 by points, +/-, rating */; leaders: { hits: {name, value}|null; plusMinus; shots; goalie: {name, saves, shots, pct}|null }; awards: Award[] /* Task 4, empty until then */; hasPlayerData: boolean }`

**Page:**
1. Hero with the night label, a big W-L, GF-GA and the result strip (pills in order).
2. ⭐ MVP card.
3. Three stars of the night.
4. "Night leaders" tiles (hits, +/-, shots, goalie).
5. Game list linking to the game pages.
6. Awards row (after Task 4).
7. A Share button.

- [ ] **Step 1: Failing tests:**
  - `nightRecap("2026-10-22", …)` gives 7 games, MVP puck_control, `hasPlayerData: true`, `stars[0].name === "puck_control"`.
  - An unknown key → null.
  - A night made only of the summary game → `hasPlayerData: false`.
- [ ] **Steps 2–4.** **Step 5:** Page plus links; `notFound()` for an unknown key. **Step 6:** Build, commit.

### Task 4: Awards & badges

**Files:** Create `lib/stats/awards.ts`, `tests/stats/awards.test.ts`, `components/club/AwardChips.tsx`. Modify the game page (awards under three stars), the night recap (awards row), and the player page ("Badge cabinet": counts per award, most recent first).

**Interfaces:**
- `type AwardKey = "hattrick" | "playmaker" | "sniper" | "bruiser" | "brickwall" | "shutout" | "plus" | "pickpocket" | "giantslayer" | "nightmvp"`
- `type Award = { key: AwardKey; emoji: string; label: string; eaPlayerId: string; name: string; matchId: string | null; nightKey: string | null }`
- `gameAwards(lines: PlayerLine[], game: GameLite, clubs: MatchClubRow[], ourClubId: number): Award[]`
- `allAwards(lines, games, clubs, ourClubId): Award[]` (game awards plus a night MVP per night)
- `badgeCabinet(awards: Award[], eaPlayerId: string): { key; emoji; label; count }[]`

- [ ] **Step 1: Failing tests:**
  - Pulp Odysseys game: ThePooker gets 🎩 (4 goals).
  - CSKA game: check every rule with the fixture values, and pin which players get which awards (compute with a script first).
  - Giant slayer appears when a synthetic opponent has division 3 and ours is 8 and we won, and doesn't appear when we lost.
  - A goalie-only player's cabinet contains only goalie awards (Review Focus 5).
- [ ] **Steps 2–4.** **Step 5:** UI. **Step 6:** Build, commit.

### Task 5: Link-preview images

**Files:** Create `app/games/[matchId]/opengraph-image.tsx`, `app/nights/[key]/opengraph-image.tsx`, `app/players/[playerId]/opengraph-image.tsx`, `app/opengraph-image.tsx`, `lib/og/card.tsx` (shared JSX), `e2e/og.spec.ts`.

**Spec:**
- 1200×630 Arena Night card: the club name, a big score or record, the opponent name and crest URL when known, the top performer line, and the date in Amsterdam time.
- Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md` first.
- Unknown IDs render a generic club card (status 200).
- The data comes from the `lib/data/*` cached functions.

- [ ] **Step 1:** Write e2e `og.spec.ts`: GET `/games/2782817800237/opengraph-image` → 200 with `content-type` image/png; GET `/games/nope/opengraph-image` → 200 image (generic).
- [ ] **Step 2:** Implement. **Step 3:** `pnpm build && pnpm e2e`, green. Open one PNG and look at it. **Step 4:** Commit.

### Task 6: Installable app

**Files:** Create `app/manifest.ts`, `app/icon.tsx` (512 icon), `app/apple-icon.tsx` (180), all generated with `ImageResponse` (crest-style "DDD" monogram on `#070b14` with a glow).

- **Manifest:** name "Drop drop drop", short_name "DDD", `display: "standalone"`, `background_color` and `theme_color` `#070b14`, `start_url "/"`.
- Read the metadata docs for `manifest`/`icon` in node_modules first.

- [ ] **Step 1:** Implement. **Step 2:** e2e: `/manifest.webmanifest` is JSON with `display: "standalone"`; `/icon` is an image. **Step 3:** Build, e2e, commit, push, Fable final review, fix pass, merge.
