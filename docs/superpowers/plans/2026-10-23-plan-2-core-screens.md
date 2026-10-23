# Plan 2: Core Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mobile-first, Arena Night–styled site at drop-drop-drop.vercel.app with Home (season card, trophy case, Tonight/Last game, hot players), Games by night plus game pages, and club-only Players leaders plus player pages, all reading our archived games.

**Architecture:** Pure stats functions (`lib/stats/*`) turn DB rows into view models. Query functions (`lib/queries/*`) take a `Db` and are tested on PGlite. Thin cached wrappers (`lib/data/*`, `"use cache"` + `cacheTag(CLUB_TAG)` + `cacheLife("club")`) feed Server Components. The GitHub collector also stores the EA roster and pings a secret `/api/revalidate` route after new games, because Vercel can't call EA.

**Tech Stack:** Next.js 16.4.2 (Cache Components) · Tailwind 4 · shadcn/ui · motion (`motion/react`) · lucide-react · Drizzle/Neon · Vitest · Playwright

**Spec:** `docs/superpowers/specs/2026-10-23-drop-drop-drop-club-stats-design.md` (§4 Home/Games/Players, §5 stat rules, §8 phase 2)

## Global Constraints

- Read `node_modules/next/dist/docs/` guides before writing Next code. Route `params` are Promises. `"use cache"` functions can't read `params`/`searchParams`/`headers`: read them outside and pass plain values in. Dynamic route content goes inside `<Suspense>`.
- Cache profile in `next.config.ts`: `cacheLife: { club: { stale: 60, revalidate: 300, expire: 86400 } }`. Every `lib/data/*` function uses `cacheTag(CLUB_TAG)` + `cacheLife("club")`.
- **Arena Night theme (dark only).** CSS tokens on `:root`:
  - `--bg #070b14`, `--bg-glow #12305a`, `--card rgba(255,255,255,.05)`, `--card-border rgba(92,200,255,.18)`
  - `--fg #e8f1ff`, `--muted #7f95b5`, `--accent #5cc8ff`
  - `--win-bg #0f5132`, `--win-fg #5dffa8`, `--loss-bg #5a1220`, `--loss-fg #ff7a8a`
  - Body background: `radial-gradient(120% 50% at 50% 0%, var(--bg-glow) 0%, var(--bg) 60%)`
  - Big numbers: font-weight 900 with a glow, `text-shadow: 0 0 18px rgba(80,170,255,.55)`
- **Mobile first.** Content column `max-w-md mx-auto px-4`. Fixed bottom tab bar (Home · Games · Players · Opponents), with safe-area padding. Opponents links to `/opponents`, which is a "coming soon" page until Plan 3. No horizontal scroll at 360 px.
- **Time.** Game nights are grouped in `Europe/Amsterdam`: a gap under 3 h means the same night, dated by the first game's Amsterdam date (`"Thu Oct 22"`). Clock times render in the viewer's zone through a client component `<LocalTime iso>`.
- **Crest URL:** `https://media.contentapi.ea.com/content/dam/eacom/nhl/pro-clubs/custom-crests/${crestAssetId}.png`. Add the host to `images.remotePatterns`. Fallback is a 🏒 tile.
- **Division table** (`lib/divisions.ts`). Fields: hold / promotion / title. A division with no separate promotion has promotion = title.
  - Div 1: 9/16/16 · Div 2: 8/13/15 · Div 3: 8/12/14
  - Div 4: 7/11/13 · Div 5: 7/11/13 · Div 6: 7/10/12
  - Div 7: 6/9/11 · Div 8: 5/8/10 · Div 9: 4/7/9 · Div 10: 0/6/8
  - Conference: 1–2 Gold, 3–6 Silver, 7–10 Bronze
  - Season: 10 games, W = 2, OTL = 1, max 20 points
- **Player badge:** `member` if in the latest roster snapshot, else `former` if they ever played for us with `isGuest = false`, else `guest`.
- **Skater vs goalie:** a player-game counts as goalie when `position = "goalie"`. Leaders show skaters (≥1 skater game) and goalies (≥1 goalie game) separately.
- Commit after each task with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Empty database / no snapshot yet:** every page renders an empty state instead of crashing. → test in Task 4 (queries return empty/null) and Task 9 (e2e on real data).
2. **Summary-only games** (no clubs/players rows): they appear in game lists and records with a "score only" label, and the game page shows the score without box scores, never a 500. → tests in Tasks 3 and 4.
3. **Unknown player ID or match ID in a URL:** `notFound()`, not a crash. → test in Task 4 (queries return null).
4. **Season not started** (`seasonResults` all empty) or after a season reset: the season card shows "10 games, 20 points on the table". → test in Task 2.
5. **A night crossing midnight in Amsterdam during the DST change** (Oct 25): grouping uses real gaps, not calendar days. → test in Task 3.

---

## File Structure

```
lib/divisions.ts                 division table + lookup
lib/stats/season.ts              seasonProgress()
lib/stats/nights.ts              groupGameNights(), threeStars(), nightMvp()
lib/stats/players.ts             playerTotals(), leaders(), hotPlayers(), playerBadge()
lib/queries/club.ts              DB reads (take Db): snapshot, matches, players, roster
lib/data/club.ts                 cached wrappers ("use cache")
lib/collector/collect.ts         (modify) store roster; call revalidate hook
db/schema.ts                     (modify) club_snapshots.members jsonb
app/api/revalidate/route.ts      POST, secret, revalidateTag
app/layout.tsx, app/globals.css  theme + shell + bottom nav
components/ui/*                  shadcn (card, badge, tabs, table, skeleton)
components/club/*                Crest, LocalTime, ResultPill, StatRow, SeasonCard, TrophyCase, GameCard, NightCard, BoxScore, LeadersTable, BottomNav
app/page.tsx                     Home
app/games/page.tsx, app/games/[matchId]/page.tsx
app/players/page.tsx, app/players/[playerId]/page.tsx
app/opponents/page.tsx           placeholder until Plan 3
tests/stats/*.test.ts, tests/queries/club.test.ts, e2e/smoke.spec.ts, playwright.config.ts
```

---

### Task 1: Roster in the collector + revalidate hook

**Files:**
- Modify: `db/schema.ts` (add `members: jsonb("members").$type<RosterMember[]>()` nullable to `club_snapshots`), `lib/ea/schemas.ts`, `lib/ea/api.ts`, `lib/collector/collect.ts`, `scripts/collect.mts`, `.github/workflows/collect.yml`, `tests/helpers/fixture-ea.ts`
- Create: `app/api/revalidate/route.ts`, migration via `pnpm db:generate`, `tests/api/revalidate-route.test.ts`
- Test: `tests/collector/collect.test.ts`, `tests/ea/api.test.ts`

**Interfaces:**
- Produces:
  - `type RosterMember = { name: string; position: string; gp: number; goals: number; assists: number; points: number; plusMinus: number; raw: Record<string, unknown> }`. Source is EA `members/stats` (`members[]`): `name`, `favoritePosition`, and the skater fields `skgp`, `skgoals`, `skassists`, `skpoints`, `skplusmin`.
  - `EaApi.members(clubId: number): Promise<EaResult<RosterMember[]>>`. Endpoint `members/stats?platform&clubId`.
  - `collect()` stores `members` on the snapshot row when the members call succeeds (null otherwise; a failure is a warning, not an error).
  - `POST /api/revalidate`: `Authorization: Bearer ${CRON_SECRET}` → `revalidateTag(CLUB_TAG, "max")` → `{ ok: true }`; 401 otherwise.
  - `scripts/collect.mts`: after a run with `newMatches + recoveredMatches + summaryMatches > 0` and env `SITE_URL` set, POST `${SITE_URL}/api/revalidate` with the secret. A failure only logs. The trigger comes from env `COLLECT_TRIGGER` (default `"manual"`); the workflow sets `cron`.

- [ ] **Step 1: Write failing tests:**
  - api: `members()` parses `members-stats.json`: 4 members, and `puck_control` has `goals: 114`.
  - collect: snapshot `members` has 4 entries with fixture EA; members failure → `warnings` contains `"members-failed"`, status unchanged.
  - revalidate route: 401 without the secret; 200 calls `revalidateTag("club-56507","max")`.
- [ ] **Step 2: Run** `pnpm test`. Expected: the new tests fail.
- [ ] **Step 3: Implement.** Extend `createFixtureEa` with `members()` from `members-stats.json`. `pnpm db:generate`, then `pnpm db:migrate` (live DB; additive nullable column).
- [ ] **Step 4: Run** `pnpm test`. Expected: all pass.
- [ ] **Step 5: Wire the workflow.** `gh secret set CRON_SECRET` (from `.env.local`) and `gh secret set SITE_URL --body https://drop-drop-drop.vercel.app`. In `collect.yml`, pass `CRON_SECRET`, `SITE_URL` and `COLLECT_TRIGGER: cron` to the step.
- [ ] **Step 6: Commit.**

---

### Task 2: Division table and season progress

**Files:** Create `lib/divisions.ts`, `lib/stats/season.ts`, `tests/stats/season.test.ts`

**Interfaces:**
- `type Division = { id: number; hold: number; promotion: number; title: number; conference: "Gold" | "Silver" | "Bronze" }`; `getDivision(id: number): Division | null`
- `type SeasonState = "not-started" | "title-zone" | "promotion-zone" | "contending" | "promotion-in-reach" | "safe" | "at-risk" | "relegated"`
- `seasonProgress(seasonResults: string[], divisionId: number): { points: number; gp: number; remaining: number; wins: number; losses: number; otl: number; division: Division | null; state: SeasonState; safeReached: boolean; winsToPromotion: number | null; winsToTitle: number | null; maxPoints: number; outlook: string }`

**State rules** (first match wins; `max = points + remaining*2`, `distinct = promotion < title`):
1. `gp == 0` → not-started
2. `points >= title` → title-zone
3. `distinct && points >= promotion` → promotion-zone
4. `max < hold` → relegated
5. `max >= title` → contending
6. `distinct && max >= promotion` → promotion-in-reach
7. `points >= hold` → safe
8. otherwise → at-risk

**Wins needed:** `winsTo(x) = points >= x ? 0 : ceil((x - points) / 2)`. It is `null` when unreachable (`max < x`) or, for promotion, when `!distinct`.

**Outlook copy (exact):**
- not-started: `"10 games, 20 points on the table"`
- title-zone: `"Division title secured 🏆"`
- promotion-zone: `"Promotion secured · {n} win(s) to title"`, or `"Promotion secured"` when the title is unreachable
- contending / promotion-in-reach: `"{p} win(s) to promotion · {t} win(s) to title"`, dropping parts that are null; "win" vs "wins" by count
- safe: `"Safe from relegation · promotion out of reach"`
- at-risk: `"{h} win(s) to stay up"`
- relegated: `"Relegated · can't reach {hold} pts"`

- [ ] **Step 1: Write failing tests:**

```ts
it("our current season: Div 8, L W W W", () => {
  const s = seasonProgress(["losses","wins","wins","wins","","","","","",""], 8);
  expect(s).toMatchObject({ points: 6, gp: 4, remaining: 6, wins: 3, losses: 1, state: "contending", safeReached: true, winsToPromotion: 1, winsToTitle: 2, maxPoints: 18 });
  expect(s.outlook).toBe("1 win to promotion · 2 wins to title");
});
it("not started", () => expect(seasonProgress(Array(10).fill(""), 8).outlook).toBe("10 games, 20 points on the table"));
it("otl counts 1 point", () => expect(seasonProgress(["otl","wins"], 8).points).toBe(3));
it("relegated when max < hold", () => expect(seasonProgress(["losses","losses","losses","losses","losses","losses","losses","losses"], 7).state).toBe("relegated")); // max 4 < 6
it("division 1 has no separate promotion", () => expect(seasonProgress(["wins"], 1).winsToPromotion).toBeNull());
it("title zone", () => expect(seasonProgress(Array(5).fill("wins"), 8).state).toBe("title-zone"));
it("unknown division returns null division and state from points only", () => expect(seasonProgress(["wins"], 42).division).toBeNull());
```
- [ ] **Step 2: Run** `pnpm test tests/stats/season.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** For an unknown division: state `"contending"` when `gp > 0`, and both wins-to values null.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.**

---

### Task 3: Game nights, three stars, night MVP

**Files:** Create `lib/stats/nights.ts`, `tests/stats/nights.test.ts`

**Interfaces:**
- `type GameLite = { matchId: string; playedAt: Date; opponentClubId: number; opponentName: string | null; goalsFor: number; goalsAgainst: number; outcome: "W" | "L"; overtime: boolean; dnf: string; source: "full" | "summary"; matchType: string }`
- `type PlayerLine = { matchId: string; clubId: number; eaPlayerId: string; playerName: string; position: string; isGuest: boolean; goals: number; assists: number; plusMinus: number; ratingOffense: number; ratingDefense: number; ratingTeamplay: number; [stat: string]: unknown }`
- `groupGameNights(games: GameLite[], tz = "Europe/Amsterdam", gapHours = 3): { key: string; label: string; games: GameLite[] /* newest first */; wins: number; losses: number; goalsFor: number; goalsAgainst: number }[]` (nights newest first). `key` = `YYYY-MM-DD` Amsterdam date of the night's first game. `label` = `"Thu Oct 22"` (`en-US`, weekday short, month short, day numeric).
- `threeStars(lines: PlayerLine[], clubId?: number): PlayerLine[]`: up to 3, sorted by points, then plusMinus, then rating sum. Limited to `clubId` when given.
- `nightMvp(lines: PlayerLine[], ourClubId: number): { eaPlayerId: string; playerName: string; goals: number; assists: number; points: number } | null`: sums per player across the night; same tiebreaks; null if no lines.

- [ ] **Step 1: Write failing tests**, built from the 9 fixture matches normalized via `normalizeMatch` plus one summary game vs 1974 at SSK − 1 s:

```ts
it("groups the 10 games into 3 nights", () => {
  const n = groupGameNights(games);
  expect(n.map(x => [x.label, x.wins, x.losses, x.games.length])).toEqual([
    ["Thu Oct 22", 5, 2, 7], ["Tue Oct 20", 2, 0, 2], ["Sun Oct 18", 0, 1, 1],
  ]);
  expect(n[0].key).toBe("2026-10-22");
  expect(n[0].games[0].matchId).toBe("2782817800237"); // newest first
});
it("keeps a session across midnight as one night", /* games at 23:30 and 00:20 Amsterdam on Oct 24→25 (DST night) → 1 night labeled "Sat Oct 24" */);
it("splits on a 3h+ gap", /* 20:00 and 23:30 same day → 2 nights */);
it("three stars of the INFERNAL LEGION loss (our club)", () => {
  // all at 1 point and -1, so ratings decide: 245, 230, 220
  expect(threeStars(linesOf("2782817800237"), 56507).map(p => p.playerName)).toEqual(["ThePooker", "Kai_Fretwell18", "PePezki_"]);
});
it("night MVP for Thu Oct 22", () => {
  expect(nightMvp(linesOfNight("2026-10-22"), 56507)).toEqual({ eaPlayerId: "1273735466", playerName: "puck_control", goals: 8, assists: 10, points: 18 });
});
it("nightMvp returns null with no lines", () => expect(nightMvp([], 56507)).toBeNull());
```

- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Amsterdam dates via `Intl.DateTimeFormat("en-CA", { timeZone })` for the key, and `"en-US"` for the label.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.**

---

### Task 4: Player totals, leaders, hot players, badges + DB queries

**Files:** Create `lib/stats/players.ts`, `lib/queries/club.ts`, `tests/stats/players.test.ts`, `tests/queries/club.test.ts`

**Interfaces:**
- `type Badge = "member" | "former" | "guest"`; `playerBadge(eaPlayerId: string, name: string, roster: RosterMember[] | null, everNonGuest: boolean): Badge`. A roster match is by **name** (the roster has no IDs).
- `type SkaterTotals = { eaPlayerId; name; badge; gp; goals; assists; points; plusMinus; shots; hits; pim; takeaways; giveaways; ppg; shg; gwg; shotPct /* goals/shots*100, 0 if no shots */; pointsPerGame; positions: Record<string, number> }`
- `type GoalieTotals = { eaPlayerId; name; badge; gp; saves; shotsAgainst; goalsAgainst; savePct /* saves/shotsAgainst, 0 if none */; gaa /* goalsAgainst per game */; wins; losses }`
- `playerTotals(lines: PlayerLine[], games: GameLite[], roster: RosterMember[] | null, ourClubId: number): { skaters: SkaterTotals[]; goalies: GoalieTotals[] }`. Only `ourClubId` lines; skaters sorted by points then goals; goalies by savePct.
- `filterGames(games: GameLite[], filter: "all" | "30d" | "last10", now: Date): Set<string>`: the matchIds in range. last10 = newest 10 **full** games.
- `hotPlayers(lines, games, ourClubId, n = 5): { eaPlayerId; name; position; goals; assists; points; gp }[]`: skater totals over our newest `n` full games, top 3 by points, then goals.
- Queries (`lib/queries/club.ts`, all take `db: Db`):
  - `latestSnapshot(db)`: newest `club_snapshots` row or null
  - `allGames(db)`: `GameLite[]` with `opponentName` joined from `match_clubs` (null for summaries)
  - `ourPlayerLines(db)`: all `match_players` rows for `CLUB_ID`
  - `matchDetail(db, matchId)`: `{ game: GameLite; clubs: MatchClubRow[]; lines: PlayerLine[] } | null`
  - `playerDetail(db, eaPlayerId)`: `{ lines: PlayerLine[]; games: GameLite[] } | null` (null when no lines)

- [ ] **Step 1: Write failing tests:**
  - **players:** over the 9 fixture games, ThePooker `{ gp: 9, goals: 11, assists: 10, points: 21, plusMinus: 1 }` is first. puck_control is second with 20. Kai_Fretwell18 has badge `guest` with roster = the 4 fixture members. mike_v_75 is `member`. Liengutten is in goalies with `{ gp: 4, saves: 38, shotsAgainst: 48 }` and `savePct` ≈ 0.7917.
  - **badge:** a player not in the roster with `everNonGuest = true` → `former`.
  - **hotPlayers:** over the newest 5 → ThePooker and puck_control first, each with 16 points (7G 9A); Kai_Fretwell18 has 14.
  - **filterGames:** `"last10"` ignores summary games.
  - **queries (PGlite, seeded with `collect` + fixture EA):**
    - `latestSnapshot` division is 8 and `members` length is 4
    - `allGames` has length 10, and the summary has `opponentName: null`
    - `matchDetail("2782817800237")` has 2 clubs and 12 lines
    - `matchDetail` for the summary id returns clubs `[]`
    - `matchDetail("nope")` is null; `playerDetail("nope")` is null
    - on an empty db, `latestSnapshot` is null and `allGames` is `[]`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test`. Expected: all pass.
- [ ] **Step 5: Commit.**

---

### Task 5: Theme, shell, shared components

**Files:** Modify `app/layout.tsx`, `app/globals.css`, `next.config.ts`. Create `components/club/*`, `components/ui/*` (shadcn), `lib/data/club.ts`, `app/opponents/page.tsx`

**Interfaces:**
- `lib/data/club.ts`: `getSnapshot()`, `getGames()`, `getOurLines()`, `getMatch(matchId: string)`, `getPlayer(eaPlayerId: string)`. Each is `"use cache"` + `cacheTag(CLUB_TAG)` + `cacheLife("club")` and delegates to `lib/queries/club.ts` with `getDb()`. Return values must be serializable: convert `Date` to ISO strings and back in the view layer.
- Components:
  - `<Crest assetId size />`
  - `<LocalTime iso format="time"|"datetime" />` (client)
  - `<ResultPill outcome overtime dnf />`: shows W/L plus "OT" and a "quit" icon
  - `<StatTile label value glow? />`
  - `<BottomNav />` (client, active tab from `usePathname`)
  - `<EmptyState title hint />`

- [ ] **Step 1:** `pnpm dlx shadcn@latest init` (dark only, CSS variables). Then `pnpm dlx shadcn@latest add card badge tabs table skeleton`, and `pnpm add motion lucide-react`.
- [ ] **Step 2:** Theme tokens from Global Constraints in `globals.css`. Layout: Geist font, `metadata.title = "Drop drop drop"`, theme color `#070b14`, `<main className="max-w-md mx-auto px-4 pb-24">`, `<BottomNav />`. Add `images.remotePatterns` and the `cacheLife.club` profile to `next.config.ts`.
- [ ] **Step 3:** Placeholder `app/opponents/page.tsx` ("Scouting is coming soon").
- [ ] **Step 4: Verify.** `pnpm build` passes; `pnpm dev`, then open `/opponents` at 390×844 with no horizontal scroll (Playwright screenshot in Task 9).
- [ ] **Step 5: Commit.**

---

### Task 6: Home page

**Files:** Create `components/club/SeasonCard.tsx`, `TrophyCase.tsx`, `GameCard.tsx`, `HotPlayers.tsx`. Modify `app/page.tsx`.

**Content, top to bottom:**
1. **Header:** crest, "Drop drop drop", `Division {n} · {conference} · {wins}-{losses}-{otl} all-time`.
2. **SeasonCard:**
   - big glowing points, `{gp} / 10 GP`, W·L(·OTL)
   - a progress bar to 20 with tick marks at hold (✓ Safe when reached), promotion (⬆ Promo, hidden when not distinct) and title (🏆 Title), plus a shaded area from points up to `maxPoints`
   - the outlook line, then a 10-slot strip (W green, L red, OTL amber, empty dim)
3. **TrophyCase:** titles, promotions, holds, relegations.
4. **Tonight / Last game:** if the newest night includes a game in the last 6 h → "Tonight" card with running record, games and night MVP. Otherwise "Last game": score, opponent, shots, link to the game page.
5. **HotPlayers:** "Hot · last 5 games", top 3.
6. **No snapshot:** `<EmptyState title="No games saved yet" hint="The collector checks EA every 10 minutes." />`.

Motion: the cards fade/slide in with a 60 ms stagger (`motion/react`, respecting `prefers-reduced-motion`). The progress bar animates width on mount.

- [ ] **Step 1:** Implement the components (presentational; data from `lib/stats/*`).
- [ ] **Step 2: Verify** on `pnpm dev` against the live DB. The home page shows Div 8, 6 pts, "1 win to promotion · 2 wins to title", trophies 1/2/0/0, and Last game L 2-4 vs INFERNAL LEGION.
- [ ] **Step 3: Commit.**

---

### Task 7: Games list and game page

**Files:** Create `app/games/page.tsx`, `app/games/[matchId]/page.tsx`, `components/club/NightCard.tsx`, `BoxScore.tsx`

- **`/games`:**
  - nights from `groupGameNights`, each a card with label, `W-L`, GF-GA and MVP, expandable (first night open) to show game rows
  - each game row: ResultPill, score, opponent name (or "Club {id}"), `<LocalTime>`, and a "score only" chip for summaries
  - filter chips All / Season / Playoffs / Private through `?type=`. The page reads `searchParams` outside cached functions and filters in memory.
- **`/games/[matchId]`:**
  - `params` awaited inside a Suspense child; `getMatch(id)`; `notFound()` when null
  - scoreboard header with crests and the final score
  - team stat comparison rows: shots, hits, faceoff %, passing %, PP, time on attack
  - three stars, then two BoxScores (ours first): skaters G/A/P/+/-/S/H/TOI, goalies SV/SA/SV%
  - summary game: score plus the note "Only the score was saved for this game."
  - Share button (client): `navigator.share({ title, url })`, falling back to copying the link

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify.** `/games` shows 3 nights (Thu Oct 22 5-2, Tue Oct 20 2-0, Sun Oct 18 0-1). `/games/2782817800237` shows 2-4, shots 14-26. `/games/nope` returns 404.
- [ ] **Step 3: Commit.**

---

### Task 8: Players leaders and player page

**Files:** Create `app/players/page.tsx`, `app/players/[playerId]/page.tsx`, `components/club/LeadersTable.tsx`

- **`/players`:**
  - Tabs Leaders · Lines · Records. Lines and Records show "coming soon" until Plan 5.
  - Leaders: Skaters/Goalies toggle; time filter All / 30 days / Last 10 via `?range=`; sortable columns via `?sort=` (pts, g, a, +/-, s, h, sh%)
  - rows link to the player page; name plus a badge chip
- **`/players/[playerId]`:**
  - header: name, badge, main position
  - StatTiles: GP, G, A, P, P/GP, +/-, SH%
  - the last 10 games as rows (date, opponent, G-A-P, +/-, result)
  - best game (most points)
  - "NHL 26 career" section from the roster snapshot (matched by name) when the player is a member, labeled "Career totals from EA (all clubs)"
  - `notFound()` for unknown IDs

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify.** Leaders: ThePooker first with 21 P. Goalie toggle lists Liengutten. `/players/828785353` shows 9 GP, 11 G. `/players/nope` returns 404.
- [ ] **Step 3: Commit.**

---

### Task 9: E2E smoke + deploy

**Files:** Create `playwright.config.ts`, `e2e/smoke.spec.ts`. Modify `package.json` (`"e2e": "playwright test"`) and `vitest.config.mts` (exclude `e2e/`).

- [ ] **Step 1:** `pnpm add -D @playwright/test && pnpm exec playwright install chromium`. Config: `webServer: pnpm build && pnpm start -p 3400`, project `Pixel 7` viewport, `baseURL http://localhost:3400`. Env comes from `.env.local` (`dotenv` not needed: use `node --env-file` in the webServer command).
- [ ] **Step 2: Write tests.**
  - For `/`, `/games`, `/games/2782817800237`, `/players`, `/players/828785353`: status 200, no console errors, `document.documentElement.scrollWidth <= innerWidth`, and a full-page screenshot to `e2e/screenshots/`.
  - `/games/nope` returns 404.
  - Home contains "Division 8".
- [ ] **Step 3: Run** `pnpm e2e`. Expected: all pass. Look at the screenshots; fix visual issues.
- [ ] **Step 4:** Commit, push the branch, check the Vercel preview with `vercel curl` (status 200 for `/`), then merge to `main` and push. Production then deploys.
- [ ] **Step 5:** Trigger `gh workflow run collect.yml` and confirm the run log shows `revalidate: ok` (or no changes).
