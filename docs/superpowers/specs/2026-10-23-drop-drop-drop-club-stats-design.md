# Drop drop drop — Club Stats Site: Design

**Date:** 2026-10-23
**Status:** Draft for review
**Club:** Drop drop drop · clubId `56507` · platform `common-gen5` · NHL 26 EASHL

## 1. Goal

A mobile-first website dedicated to our NHL 26 Pro Club. The home page is always ours. It shows stats that **only count games played for this club** (EA and chelhead show NHL 26 career totals), makes our game history easy to browse, and helps us scout any opponent in seconds while we're in the lobby.

**Audience:** our teammates, plus anyone we share the link with. Public, read-only, no login.

**Success looks like:**
- After a game night, the site shows that night's games and updated club-only stats within ~10 minutes with no manual action.
- In the lobby, searching an opponent and seeing our head-to-head record, their dangerous players and their play style takes under 10 seconds on a phone.
- Season progress (points vs Safe / Promotion / Title lines) is visible at a glance.

## 2. Key facts about the EA API (verified 2026-10-23)

Base: `https://proclubs.ea.com/api/nhl/`

| Endpoint | Returns | Notes |
|---|---|---|
| `clubs/info?platform&clubIds` | name, crest, teamId | |
| `clubs/matches?platform&clubIds&matchType` | **last 5 games only** per type, full box score per player for both clubs | matchType: `gameType5` (season), `gameType10` (playoffs), `club_private` |
| `members/stats?platform&clubId` | roster with **NHL 26 career totals** (not club-only), incl. DNF/quit counts | |
| `clubs/seasonalStats?platform&clubIds` | currentDivision, record, promotions/holds/relegations, titles, ranking points, last 10 results with opponent IDs and scores, `recentResults` = current season results | |
| `clubs/search?platform&clubName` | club lookup by name | |

**Access:** EA's Akamai edge rejects plain requests (403). Requests succeed over **HTTP/2 with full browser headers** (User-Agent, Accept, Accept-Language, Origin/Referer `https://www.ea.com`, Sec-Fetch-*, sec-ch-ua*). Not yet verified from Vercel/GitHub Actions IP ranges.

**Consequence:** because EA only exposes the last 5 games, club-only stats require us to **poll and archive every game ourselves**. Games played before archiving starts are lost (except the 10 score-only results from `seasonalStats`).

**Season rules** (10 games per season, W = 2 pts, OTL = 1, L = 0, max 20). Thresholds per division, taken from chelhead's public client code (not confirmed by EA; verify Div 8 against the in-game season screen):

| Div | Group | Safe | Promotion | Title |
|---|---|---|---|---|
| 1 | Gold | 9 | — (top division) | 16 |
| 2 | Gold | 8 | 13 | 15 |
| 3 | Silver | 8 | 12 | 14 |
| 4 | Silver | 7 | 11 | 13 |
| 5 | Silver | 7 | 11 | 13 |
| 6 | Silver | 7 | 10 | 12 |
| 7 | Bronze | 6 | 9 | 11 |
| 8 | Bronze | 5 | 8 | 10 |
| 9 | Bronze | 4 | 7 | 9 |
| 10 | Bronze | 0 | 6 | 8 |

The table lives in one config file so it's a one-line fix if EA changes it.

## 3. Architecture

**Stack:** Next.js 16 (App Router, Cache Components) on Vercel · Neon Postgres · Drizzle ORM · Zod · shadcn/ui · Tailwind 4 · Framer Motion · Recharts · Vitest · Playwright. Code on GitHub.

```
EA API ──(every 10 min + on visit if stale)──▶ Collector ──▶ Postgres (Neon)
                                                  │                 │
                                    revalidateTag on new games   Stats module
                                                                    │
           Opponent pages ◀── live EA data (cached 10 min)      Pages (Next.js)
```

### Units

1. **EA client** (`lib/ea/`): the only code that calls EA. Sends the browser-like HTTP/2 request, one retry on failure, Zod-validates every response, returns typed data or a typed error. Must not be used from the browser.
2. **Collector** (`lib/collector/` + route `app/api/collect/route.ts`): for each matchType, fetches recent matches, upserts new ones keyed on EA `matchId` (idempotent), stores a `club_snapshots` row from `seasonalStats`, logs a `collector_runs` row, and calls `revalidateTag` when anything changed. Protected by a `CRON_SECRET` bearer token.
3. **Database** (`db/schema.ts`), tables:
   - `matches`: matchId (PK), timestamp, matchType, our score, opponent score, opponent clubId, result, overtime flag, DNF flags, `source` (`full` | `summary`), `raw` JSONB (EA's original payload)
   - `match_clubs`: per match per club: score, shots, hits, passing, PP, faceoffs, TOA, division, name, crest
   - `match_players`: per match per player for **both** clubs: EA player ID, name at time, clubId, position, isGuest, all skater/goalie stats, ratings, DNF
   - `club_snapshots`: timestamp, clubId, division, season record, recentResults, trophy counts, ranking points
   - `collector_runs`: timestamp, trigger (`cron` | `visit` | `manual`), status, new match count, error, missed-games warning
4. **Stats module** (`lib/stats/`): pure functions over DB rows. Club-only player totals and averages, game nights, MVP/three stars, head-to-head, nemesis/punching bags, lines, hot/cold, season progress, records/milestones, scouting summaries. No I/O, fully unit-tested.
5. **Live opponent data** (`lib/opponents/`): club info, members, seasonalStats and recent matches for any club via the EA client, cached with `use cache` + `cacheLife` ~10 min.
6. **UI** (`app/`): Server Components reading through cached data functions tagged per club; client components only where needed (charts, search, animations, share).

### Triggers

> **Decided 2026-10-23:** EA returns 403 to Vercel functions (tested iad1 and fra1) but 200 to GitHub Actions runners. The production collector is therefore the GitHub Actions workflow `.github/workflows/collect.yml` (every 10 min, `pnpm collect:ci`, `DATABASE_URL` from repo secrets). cron-job.org is not used. `/api/collect` stays for manual use. Because the collector writes to the database outside Vercel, Plan 2 must make pages pick up new games (short `cacheLife` or a revalidate call from the workflow).

- **cron-job.org** calls `/api/collect` every 10 minutes (Vercel Hobby cron is limited to once per day).
- **On visit:** if the last successful run was more than 5 minutes ago, the page triggers a background collect (`after()`), rate-limited through `collector_runs`.
- **Fallback:** if EA blocks Vercel IPs, a scheduled GitHub Actions workflow runs the same collector code (`pnpm collect`) against the database directly.

### Backfill

On first run:
1. Import our own last 5 matches per matchType.
2. **Opponent recovery:** for every club in `seasonalStats.recentOpponent0-9`, fetch that club's recent matches (all matchTypes) and import any match that includes clubId 56507. A game is in both clubs' lists, so it can still be in the opponent's last 5 after it has left ours. Tested 2026-10-23: this recovered 4 of the 5 games older than our own last 5, with full box scores.
3. Any `recentOpponent`/`recentScore` entry still without a full match is stored as a `source = 'summary'` game (opponent + score only). These count toward head-to-head and records but not player stats.

Matches captured on 2026-10-23 (9 full + 1 summary-only vs club 1974, a 3-1 win) are saved in `tests/fixtures/ea/2026-10-23/` and are imported as seed data, since they will have aged out of EA by the time the collector is live.

## 4. Screens

Mobile-first, **Arena Night** style: dark, ice-blue neon glow, scoreboard-style numbers. Bottom tab bar: **Home · Games · Players · Opponents**. PWA manifest so it can be added to the home screen with the club crest.

- **Home `/`**
  - Header: crest, name, "Division 8 · Season N · all-time record"
  - **Season card:** points, games played/left, progress bar to 20 with Safe / Promotion / Title marks for the current division, the reachable range shaded, a plain-language outlook ("1 win to promotion · 2 wins to title"), 10-slot season strip
  - **Trophy case:** division titles, promotions, holds, relegations
  - **Tonight card** (on a game night with games in the current session): running record and top scorer; otherwise **Last game** card
  - **Hot right now:** top players over the last 5 games, with 🔥/🧊
  - Nemesis top 3, quick opponent search, goals-for/against trend chart
- **Games `/games`:** game nights (newest first) with record and night MVP, expandable to games. Filter by match type.
  - **Game `/games/[matchId]`:** score, shots, both box scores, three stars, Share button (Web Share API) and an Open Graph recap image (`opengraph-image`) for link previews.
- **Players `/players`:** tabs **Leaders · Lines · Records**
  - Leaders: club-only, sortable, skaters/goalies, time filter All time / Last 30 days / Last 10 games, guest/former badges
  - Lines: trios (C+LW+RW) and D-pairs with ≥3 games together: GP, W-L, win %, GF/GA
  - Records: single-game and streak records, milestones
  - **Player `/players/[eaPlayerId]`:** club totals and averages, last-10 form chart, best games, best linemates, separate "NHL 26 career" section from EA
- **Opponents `/opponents`:** auto-focused search (our opponents first, then EA `clubs/search`), nemesis and punching-bag cards, list of all opponents sortable by recent / most played / worst record. Rows: crest, name, H2H record, GF-GA, last meeting.
  - **Scouting `/clubs/[clubId]`** (any club): head-to-head summary and all meetings (if any), their dangerous players vs us, usual lineup and positions, human vs CPU goalie, quit rate ⚠️, play style vs ours, platform and player levels, usual playing time, division and current form. Shows "No games against them yet" when applicable.

## 5. Stat rules

- **Club game:** any stored match containing clubId 56507, of any matchType (filterable).
- **Identity:** players keyed by EA player ID (the key in the match `players` object); display the most recent name.
  - **Member:** in current `members/stats` roster
  - **Guest:** `isGuest = 1` in that match
  - **Former:** played as non-guest before, not on the current roster
  - Everyone who played for us counts in stats and team totals, with badges.
- **Result:** win/loss from score; OT and DNF from EA result codes and `winnerByDnf` flags. Observed codes: `1`, `2`, `5`, `16385` (e.g. 16385 = win where the opponent quit). Confirm the code meanings against real games before relying on OT/DNF labels.
- **Game night:** consecutive games less than 3 hours apart, dated by the start of the first game in **Europe/Amsterdam (CET/CEST)**. Times are shown in the viewer's local time zone. Typical schedule: Sun/Tue/Thu from 20:30–21:00 CET for 2–4 hours.
- **MVP / three stars:** points, then +/-, then EA ratings (offense + defense + teamplay). Night MVP = most points across the night (same tiebreaks).
- **Nemesis:** opponents with ≥2 games, ranked by lowest win %, then lowest goal difference, then most games. Punching bags: the reverse. Show however many qualify (up to 3).
- **Lines:** trio = C+LW+RW in the same game; D-pair = the two D. Shown at ≥3 games together.
- **Hot / cold:** points per game over the last 5 games vs the player's overall club PPG; ≥ +25% = hot, ≤ −25% = cold; only for players with ≥8 club games.
- **Season progress:** points from `recentResults` (wins ×2, OTL ×1), games left = 10 − played, thresholds from the division table. States: not started / title zone / promotion zone / contending / promotion in reach / safe / at risk / relegated.
- **Scouting:**
  - Quit rate: their members' career DNF % from EA, plus DNFs in games vs us
  - Play style: their per-game averages over their last 5 EA matches vs our all-time per-game averages; labels when ≥20% different ("very physical", "shoots a lot", "disciplined", ...)
  - Usual lineup: most frequent position per player in recent matches; goalie = human if a goalie appears in their player list, else CPU

## 6. Error handling

- **EA down or blocked:** pages render from stored data with a "Last updated X ago" indicator; failures logged in `collector_runs`; the next run catches up.
- **Possible missed games:** if every fetched match is new and the newest stored match is older than the oldest fetched one, run **opponent recovery** (see Backfill) for the clubs in the latest `recentOpponent` list, then log a warning only for games still missing.
- **Schema drift:** Zod validation failures skip that match and log the error; `raw` payloads let us re-process stored matches after fixing parsers.
- **Live opponent fetch fails:** scouting page shows head-to-head from our DB and an inline "EA unavailable, retry" for the live sections.
- **Abuse:** `/api/collect` requires `CRON_SECRET`; visit-triggered collects are limited to one per 5 minutes; the site has no write endpoints.
- **Empty states** for no games tonight, unplayed clubs, players with too few games, and lines below the minimum.

## 7. Testing

- **Unit (Vitest):** stats module using real EA fixtures (the 5 matches, members and seasonalStats captured on 2026-10-23, saved in `tests/fixtures/ea/2026-10-23/`): result decoding, game nights across midnight, MVP, nemesis ordering, lines, hot/cold thresholds, season states for all divisions.
- **Collector:** dedupe (same match twice → one row), invalid payload skipped, snapshot written, missed-games warning, summary backfill.
- **EA client:** parses fixtures; a manual `pnpm ea:smoke` script hits the live API.
- **E2E (Playwright, mobile viewport):** Home, Games, a game page, Players, Opponents search → scouting page render without errors.

## 8. Build phases

0. **Access test:** GitHub, Vercel, Neon, cron-job.org accounts; deploy a minimal route that calls EA from Vercel and reports the status.
1. **Collector live:** schema, EA client, collector, backfill, cron every 10 min. Archiving starts here.
2. **Core screens:** Home (season card, trophy case, Tonight/Last game, hot players), Games + game page, Players leaders + player page.
3. **Opponents:** list, search, nemesis/punching bags, scouting page.
4. **Charts and form:** GF/GA trend, player form charts, hot/cold, division history from snapshots.
5. **Extras:** lines, records and milestones, share image, PWA.

## 9. Out of scope

Logins or admin pages, push notifications, archiving other clubs' full histories, importing data from chelhead, multiple "home" clubs.
