# Personal Layer (phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teammates pick who they are once, then get a Me tab, a personal Home card, "You" highlights and public moment cards, without making the shared pages per-person.

**Architecture:** Identity and seen-moments live in two cookies set by server actions. Pages stay prerendered with `cacheComponents`; only small personal pieces read the cookies, each inside its own `Suspense`, and compute from the existing cached data functions. All stats (moments, streaks, milestones…) are pure functions in `lib/stats/` with vitest tests; UI is checked with phone-size Playwright tests.

**Tech Stack:** Next 16.4 (App Router, `cacheComponents`), React 19.3, Tailwind 4, Base UI, vitest, Playwright, Drizzle/Neon (read only here).

**Spec:** `docs/superpowers/specs/2026-10-24-personal-layer-design.md`

## Global Constraints

- Read `node_modules/next/dist/docs/` for any Next API before using it (AGENTS.md). `cookies()` is async; setting cookies only in server actions.
- Personal server components must call `getMe()` (which awaits `cookies()`) **before** `new Date()`/`Date.now()`, so prerendering never sees the clock.
- Every personal server piece sits in its own `<Suspense>`; shared pages must keep prerendering (build must not fail with "uncached data outside Suspense").
- Cookies: `ddd-player` (values `<eaPlayerId>` | `guest` | `skipped`) and `ddd-seen` (comma-separated moment ids, newest 60), both `maxAge` one year, `sameSite: "lax"`, `path: "/"`, `httpOnly: false` (the "You" highlight reads `ddd-player` in the browser).
- Moments window: 14 days. First pick: moments older than 7 days are marked seen. Near miss: within 15% of a record. Picker: players without a game in 60 days go behind "Show everyone". Best linemates: minimum 3 games together, top 2 by win %.
- Milestone steps: games 25/50/100/200/500; goals and assists 10/25/50/100/250; points 10/25/50/100/200/500; hits 100/250/500/1000.
- Rare awards that are moments: `hattrick`, `shutout`, `nightmvp` only.
- Copy style: plain, short, emoji-led cards as in the spec's moments table. Lint rules forbid `setState` directly in effects and impure calls during render (use `useSyncExternalStore` or event handlers, as in `components/club/InstallPrompt.tsx`).
- Existing e2e must keep passing, including "without JavaScript" and "localStorage is blocked".

## Review Focus

1. Cookie holds a player id that has no lines (data reset, typo): treat as unset, never crash. → Task 2 test `parseMe` + Task 6 e2e with a bogus cookie.
2. A goalie-only player (no skater lines) opens the Me tab and Home: goalie numbers, no NaN or empty sections. → Task 4 tests `vsTeam`/`lastNight` for a goalie.
3. A picked player with no box-score games in 14 days (or none at all): Home card falls back to milestone + "Last played", Me tab sections hide cleanly. → Task 4 test `lastNight` returns null; Task 8 e2e.
4. No JavaScript: onboarding overlay must not cover Home (render it client-only); Home content stays visible. → existing no-JS smoke test plus Task 7 check.
5. Malformed or oversized `ddd-seen` cookie (garbage, 500 ids): parsed safely, trimmed to 60. → Task 2 test.

---

### Task 1: Records know their holder's id

**Files:**
- Modify: `lib/stats/records.ts` (`RecordItem`, `clubRecords`, `pointStreaks`, `milestones` return type)
- Modify: `components/club/RecordsView.tsx:54,80` (holder names become links)
- Test: `tests/stats/records.test.ts`

**Interfaces:**
- Produces: `RecordItem` gains `holderId: string | null`; `milestones()` items gain `holderId: string | null`.

- [ ] **Step 1: Failing test** in `tests/stats/records.test.ts`:
```ts
it("records carry the holder's player id", () => {
  expect(rec("point-streak")).toMatchObject({ holder: "puck_control", holderId: "828785353" });
  expect(rec("team-goals-game").holderId).toBeNull();
});
```
- [ ] **Step 2:** `pnpm vitest run tests/stats/records.test.ts` → FAIL (`holderId` undefined).
- [ ] **Step 3:** Add `holderId` everywhere a record/milestone is built (`top.eaPlayerId`, `hat.eaPlayerId`, `null` for team records). In `RecordsView`, wrap a holder with `holderId` in `<Link href={`/players/${holderId}`}>`.
- [ ] **Step 4:** Tests pass; `pnpm tsc --noEmit` clean.
- [ ] **Step 5:** Commit `feat: records carry holder ids and link to the holder`.

### Task 2: Identity cookies and server actions

**Files:**
- Create: `lib/me.ts` (pure: cookie names, parsing, seen-list maths)
- Create: `lib/me-server.ts` (`import "server-only"`; `getMe()`)
- Create: `app/me/actions.ts` (`"use server"`)
- Test: `tests/me/me.test.ts`

**Interfaces:**
- Produces (`lib/me.ts`):
  - `PLAYER_COOKIE = "ddd-player"`, `SEEN_COOKIE = "ddd-seen"`, `SEEN_MAX = 60`
  - `type Me = { kind: "player"; playerId: string } | { kind: "guest" } | { kind: "skipped" } | { kind: "unset" }`
  - `parseMe(raw: string | undefined, knownIds: Set<string>): Me` — unknown id → `unset`
  - `parseSeen(raw: string | undefined): string[]` — ids match `/^[a-z0-9]{1,12}$/`, max 60, junk dropped
  - `addSeen(seen: string[], ids: string[], activeIds: Set<string>): string[]` — union, keep only active, newest last, cap 60
- Produces (`lib/me-server.ts`): `getMe(): Promise<{ me: Me; seen: string[] }>` (reads cookies; `knownIds` from `getOurLines()` ids of our club)
- Produces (`app/me/actions.ts`):
  - `choosePlayer(choice: string | "guest"): Promise<void>` — validates the id exists; sets `ddd-player`; for a player also seeds `ddd-seen` with ids of active moments older than 7 days (uses Task 3 `activeMoments`)
  - `skipOnboarding(): Promise<void>` — sets `skipped` (never overwrites a player/guest value)
  - `markSeen(ids: string[]): Promise<void>` — `addSeen` against current active moment ids
  - `clearPlayer(): Promise<void>` — deletes `ddd-player` (used by "Switch player")

- [ ] **Step 1: Failing tests** `tests/me/me.test.ts`:
```ts
const known = new Set(["828785353"]);
expect(parseMe("828785353", known)).toEqual({ kind: "player", playerId: "828785353" });
expect(parseMe("999", known)).toEqual({ kind: "unset" });
expect(parseMe("guest", known)).toEqual({ kind: "guest" });
expect(parseMe("skipped", known)).toEqual({ kind: "skipped" });
expect(parseMe(undefined, known)).toEqual({ kind: "unset" });
expect(parseSeen("ab12,<script>,cd34,,")).toEqual(["ab12", "cd34"]);
expect(parseSeen(Array.from({ length: 500 }, (_, i) => `x${i}`).join(","))).toHaveLength(60);
expect(addSeen(["a1", "b2"], ["c3"], new Set(["b2", "c3"]))).toEqual(["b2", "c3"]);
```
- [ ] **Step 2:** Run → FAIL (module missing).
- [ ] **Step 3:** Implement `lib/me.ts`, then `lib/me-server.ts` and `app/me/actions.ts` (actions call `getDb`-backed cached loaders like `app/opponents/actions.ts` does; cookie options from Global Constraints).
- [ ] **Step 4:** Tests pass; tsc + lint clean.
- [ ] **Step 5:** Commit `feat: identity and seen-moment cookies with server actions`.

### Task 3: Moments engine

**Files:**
- Create: `lib/stats/moments.ts`
- Test: `tests/stats/moments.test.ts`

**Interfaces:**
- Consumes: `clubRecords`, `milestones` (Task 1), `allAwards`, `divisionJourney`.
- Produces:
```ts
export type Moment = {
  id: string;                 // short stable hash (base36, ≤12 chars) of kind|key|matchId|nightKey|playerId
  kind: "record" | "award" | "milestone" | "team";
  at: Date;
  emoji: string;
  key: string;                // record key, award key, milestone stat, or team event key
  value: number | null;
  label: string;              // e.g. "hits", "Hat trick", "100th point", "Promoted to Division 7"
  playerId: string | null;    // null for team moments
  playerName: string | null;
  prevHolderId: string | null;   // record moments: who held it before
  prevHolderName: string | null;
  matchId: string | null;
  nightKey: string | null;    // Night MVP and night links
};
export type MomentInput = { lines: PlayerLine[]; games: GameLite[]; clubs: MatchClubRow[]; extras: ExtraStats[]; history: { takenAt: Date; division: number }[]; ourClubId: number };
export function moments(input: MomentInput, since: Date): Moment[]   // newest first
export function activeMoments(input: MomentInput, now: Date): Moment[] // moments(input, now − 14 days)
export function momentText(m: Moment, meId: string | null): string
export function momentHref(m: Moment): string | null  // /games/:id or /nights/:key
export function isAboutMe(m: Moment, meId: string): boolean // playerId or prevHolderId
```
- Rules:
  - **Records**: baseline = `clubRecords` on games before `since`; then for each game at/after `since` in time order, recompute on the prefix. A key whose value went up **and existed in the baseline/previous prefix with value > 0** emits one `record` moment (team records have `playerId: null`). First establishment emits nothing.
  - **Awards**: `allAwards` entries with key in `hattrick | shutout | nightmvp` and time ≥ `since` (Night MVP time = last game of that night).
  - **Milestones**: per player, counters start at their `ExtraStats` totals (games without a box score), then replay box-score lines in order; each crossed step at/after `since` emits a `milestone` (steps in Global Constraints). Club milestones from `milestones()` become `team` moments (the "First hat trick" one keeps its holder and is a `milestone`).
  - **Team**: each `divisionJourney` run that starts after `since` with a lower division number than the previous run → `team` "Promoted to Division N" (`emoji "⬆️"`, `key "promotion"`).
- `momentText` copy (exact):
  - record, holder is me: `🏆 You set a club record: {value} {label}`; prev holder is me: `😤 {playerName} took your {label} record ({value})`; public with prev holder: `🏆 {playerName} set a club record: {value} {label} (was {prevHolderName}'s)`; team record: `🔥 Team record: {label} ({value})`
  - award: me `{emoji} Your {label}`; public `{emoji} {label} for {playerName}`
  - milestone: me `💯 Your {label}`; public `💯 {label} for {playerName}`
  - team: `{emoji} {label}`
  - Record labels are short nouns per key (`goals-game` → "goals in a game", `hits-game` → "hits in a game", `win-streak` → "wins in a row", `point-streak` → "game point streak", etc.); keep the map next to `momentText`.

- [ ] **Step 1: Failing tests** with small hand-built games (pattern from the "ties go to the earliest" test in `tests/stats/records.test.ts`):
  - `it("beating an existing record makes one moment with the previous holder")` → `kind "record"`, `playerId` new holder, `prevHolderId` old holder, `value` new value.
  - `it("first time a record exists makes no moment")`.
  - `it("only hat tricks, shutouts and Night MVP count as award moments")` → a game with a Sniper + Bruiser yields no award moments.
  - `it("milestones start from stats of games without a box score")` → extras goals 8, then a 2-goal game → one "10th goal" milestone.
  - `it("promotion becomes a team moment")`.
  - `it("ids are stable across calls and differ per player")`.
  - `it("momentText words it for me, for the previous holder, and for everyone")` → the exact strings above.
  - `it("nothing before since")`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Hash: a simple deterministic string hash (e.g. FNV-1a 32-bit → base36) — no crypto import needed.
- [ ] **Step 4:** Tests pass; also `moments(fixtures, new Date(0))` on `tests/helpers/club-fixtures.ts` runs under 200 ms (add as a test).
- [ ] **Step 5:** Commit `feat: moments engine (records, rare awards, milestones, promotions)`.

### Task 4: Personal stats

**Files:**
- Create: `lib/stats/personal.ts`
- Test: `tests/stats/personal.test.ts`

**Interfaces:**
- Produces:
```ts
export function rosterChoices(lines: PlayerLine[], games: GameLite[], now: Date): { main: Choice[]; rest: Choice[] }
// Choice = { eaPlayerId; name; position (most played); gp; lastPlayed: Date }; main = played in last 60 days and not only-as-guest, newest first; rest = others by gp
export function lastNight(lines, games, playerId, ourClubId): { nightKey; label; gp; goals; assists; plusMinus; wins; losses; pointsVsAvg: number | null; goalie: { saves; shots; ga } | null } | null
export function activeStreaks(lines, games, playerId): { key: "points" | "goals" | "games"; length: number }[]   // only length ≥ 2, box-score games only
export function nextMilestones(lines, extras, playerId, max = 3): { stat: "games" | "goals" | "assists" | "points" | "hits"; target: number; remaining: number }[] // closest by remaining / target
export function recordStanding(records: RecordItem[], lines, playerId): { held: RecordItem[]; nearMisses: { record: RecordItem; best: number; short: number }[] } // within 15%
export function vsTeam(lines, games, playerId, ourClubId): { rows: { stat: string; mine: number; team: number }[]; goalie: boolean }
export function bestTeammates(lines, games, playerId, ourClubId, minGames = 3): { eaPlayerId; name; gp; winPct }[]  // top 2
```
- [ ] **Step 1: Failing tests** (fixtures + small hand-built cases): main/rest split at 60 days; `lastNight` totals for a known night in fixtures and `null` for a player absent from recent nights; streak of 3 point-games reported, broken streak not; `nextMilestones` with extras (e.g. 47 goals → `{ stat: "goals", target: 50, remaining: 3 }`); near miss 12 vs record 14 included, 11 excluded (15%); `vsTeam` for a goalie returns `goalie: true` with save %/GAA rows and no NaN; `bestTeammates` ignores teammates under 3 games.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement (reuse `groupGameNights`, `playerTotals` where it fits).
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5:** Commit `feat: personal stats (last night, streaks, milestones, records, vs team, teammates)`.

### Task 5: Shared player profile with public extras

**Files:**
- Create: `components/club/PlayerProfile.tsx` (server component: everything `PlayerContent` renders today, given `playerId`)
- Create: `components/club/PlayerExtras.tsx` (next milestones, records + near misses, vs team, best teammates; `you: boolean` switches wording)
- Modify: `app/players/[playerId]/page.tsx` (uses `PlayerProfile`)
- Test: `e2e/personal.spec.ts` (new file)

**Interfaces:**
- Consumes: Task 4 functions.
- Produces: `<PlayerProfile playerId={string} you={boolean} />` (calls `notFound()` for unknown ids, as today); `<PlayerExtras ... you={boolean} />` with section titles "Next milestones", "Records", "Vs the team", "Best teammates" (you: "Your next milestones", "Your records", "You vs the team", "Your best teammates").

- [ ] **Step 1: Failing e2e**: `/players/828785353` shows a region/heading "Next milestones" and "Vs the team".
- [ ] **Step 2:** `pnpm e2e e2e/personal.spec.ts` → FAIL.
- [ ] **Step 3:** Move the page body into `PlayerProfile` unchanged, add `PlayerExtras` after the player card. Sections with nothing to show render nothing.
- [ ] **Step 4:** New test + `e2e/smoke.spec.ts` pass.
- [ ] **Step 5:** Commit `feat: player pages show milestones, records, vs-team and best teammates`.

### Task 6: Me tab and roster picker

**Files:**
- Create: `app/me/page.tsx`, `components/club/RosterPicker.tsx` (client), `components/club/MyNight.tsx` (server: "Your last game night" from `lastNight` + "Streaks" from `activeStreaks`; each hidden when empty)
- Modify: `components/club/BottomNav.tsx` (5th tab `{ href: "/me", label: "Me", icon: CircleUser }`)
- Test: `e2e/personal.spec.ts`

**Interfaces:**
- Consumes: `getMe`, `choosePlayer`, `clearPlayer`, `rosterChoices`, `PlayerProfile`.
- Produces: `export type Choice = { eaPlayerId: string; name: string; position: string; gp: number; lastPlayed: Date }` (in `lib/stats/personal.ts`, Task 4); `<RosterPicker main={Choice[]} rest={Choice[]} onPicked?={() => void} showNotOnTeam={boolean} />` — calls `choosePlayer`, dispatches `window` event `"ddd:me-changed"` afterwards.

- Page states: `player` → `MyNight` + `PlayerProfile you` + "Not you? Switch player" (calls `clearPlayer`, shows picker); `unset`/`skipped` → heading "Set up your profile" + picker; `guest` → "You said you're not on the team." + "Pick your player" button showing the picker.

- [ ] **Step 1: Failing e2e**: with cookie for `828785353`, `/me` shows "Your last game night" or (if no night in data) at least "Your next milestones". Open `/me` with no cookie (onboarding off via cookie `ddd-player=skipped`) → "Set up your profile"; tap a roster card → URL stays `/me`, heading shows that player's name and "Your next milestones"; "Not you? Switch player" brings the picker back; cookie `ddd-player=999` behaves as unset; bottom nav has 5 tabs and no sideways scroll.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Page body inside `<Suspense>`; `getMe()` first.
- [ ] **Step 4:** Pass; add `/me` to the smoke list in `e2e/smoke.spec.ts`.
- [ ] **Step 5:** Commit `feat: Me tab with roster picker and switch player`.

### Task 7: Onboarding overlay

**Files:**
- Create: `components/club/Onboarding.tsx` (client)
- Modify: `components/club/InstallPrompt.tsx` (export `InstallSteps` = today's `Steps`, `useInstallMode`, `snoozeInstallBanner` = today's `snooze`; banner also requires `document.cookie` to contain `ddd-player=`)
- Modify: `app/page.tsx`, `app/me/page.tsx` (render `<Onboarding>` in a `Suspense` hole when `me.kind === "unset"`)
- Test: `e2e/personal.spec.ts`, `e2e/install.spec.ts` (set `ddd-player=skipped` cookie in banner tests)

**Interfaces:**
- Consumes: `RosterPicker`, `InstallSteps`, `useInstallMode`, `skipOnboarding`, `snoozeInstallBanner`.
- Produces: `<Onboarding main={Choice[]} rest={Choice[]} />`.

- Behaviour: mounts only on the client (render nothing until mounted, via `useSyncExternalStore`), full-screen `z-[75]`, progress dots, "Skip" (→ `skipOnboarding`). Screen 1 title "Who are you?" (standalone: "Welcome to the app! Who are you?"), picker with "I'm not on the team" (→ `choosePlayer("guest")`, close). Screen 2 "Get your stats one tap away, {name}" + `InstallSteps`, buttons "Done" / "Not now" (→ `snoozeInstallBanner`); left out when mode is `installed` or `none`. Finish: "You're all set, {name}" with "Let's go" → closes, page shows personal content.
- [ ] **Step 1: Failing e2e**: fresh visit to `/` → "Who are you?"; pick → install screen → "Not now" → "You're all set" → "Let's go" → Home shows "Hey {name}"; reload shows no onboarding. Fresh visit to `/games/2782817800237` → no onboarding. "Skip" → no onboarding on reload and Home shows "Set up your profile" card. "I'm not on the team" → no onboarding, no Set up card. iPhone UA with `navigator.standalone = true` → title "Welcome to the app! Who are you?" and no install screen.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Pass, plus `e2e/install.spec.ts` and the no-JS smoke test.
- [ ] **Step 5:** Commit `feat: first-visit onboarding (who are you, add to home screen)`.

### Task 8: Home card, Set-up card and moment cards

**Files:**
- Create: `components/club/HomePersonal.tsx` (server: `getMe` + data → personal card or Set-up card)
- Create: `components/club/MomentCards.tsx` (server wrapper computing unseen active moments, ordered mine first then newest) and `components/club/MomentCard.tsx` (client: text, link, ✕ → `markSeen([id])` and hide immediately; opening the link also calls `markSeen`)
- Modify: `app/page.tsx` (both at the top of `blocks`, each in its own `Suspense fallback={null}`)
- Modify: `app/me/page.tsx` (`<MomentCards onlyMine />` titled "Your moments" above `MyNight` for a player)
- Test: `e2e/personal.spec.ts`

**Interfaces:**
- Consumes: `getMe`, `activeMoments`, `momentText`, `momentHref`, `isAboutMe`, `markSeen`, `lastNight`, `activeStreaks`, `nextMilestones`, `Celebrate`.
- Produces: `<MomentCard moment={...serializable} text={string} href={string|null} />`; `<MomentCards limit={3} expandable />` for Home and `<MomentCards onlyMine />` for the Me tab.

- Home card copy: `Hey {name} 👋` then joined with " · ": last night `{G}G {A}A, {wins}–{losses}` (only if the night is within 14 days), first active streak `🔥 {n}-game point streak`, first milestone `{remaining} {stat} to {target}`; if no night in 14 days: milestone + `Last played {Mon D}`. Links to `/me`. Set-up card (`skipped`/`unset`): "Set up your profile" → `/me`, with ✕ that hides it for the session.
- Moment cards: up to 3, then "Show all (N)" expands; visible to every `me.kind`. A record moment about me renders `<Celebrate>` once (storage key = moment id).
- [ ] **Step 1: Failing e2e**: with cookie for `828785353`, Home shows "Hey puck_control"; with `skipped`, "Set up your profile"; with `guest`, neither. Moment card: if any moment card is visible, ✕ removes it and it stays gone after reload (`test.skip` when the live data has no moment in the last 14 days — note it in the test name).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Pass; smoke suite passes (home still prerenders: `pnpm build` output lists `/` as partially prerendered, not dynamic).
- [ ] **Step 5:** Commit `feat: personal Home card and public moment cards`.

### Task 9: "You" highlights

**Files:**
- Create: `components/club/YouHighlight.tsx` (client, mounted in `app/layout.tsx`)
- Test: `e2e/personal.spec.ts`

**Interfaces:**
- Consumes: `PLAYER_COOKIE`; re-reads on pathname change and on `"ddd:me-changed"`.
- Produces: a `<style>` element only when the cookie holds a numeric id:
```css
:is(li, tr, div[role="row"]):has(> * a[href="/players/ID"], > a[href="/players/ID"]) { background: rgba(92,200,255,0.08); }
a[href="/players/ID"]::after { content: "You"; margin-left: 6px; padding: 0 6px; border-radius: 999px; font-size: 10px; font-weight: 700; background: var(--accent-blue); color: #070b14; }
```
(ID validated as `/^\d+$/` before building the rule.)
- [ ] **Step 1: Failing e2e**: with cookie `ddd-player=828785353`, on `/games/2782817800237` the player link for that id has computed `::after` content `"You"`; without the cookie it has none.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Pass.
- [ ] **Step 5:** Commit `feat: highlight your rows across the app`.

### Task 10: Finish

- [ ] `pnpm test`, `pnpm lint`, `pnpm tsc --noEmit`, `pnpm e2e` all pass; look at the e2e screenshots of Home, Me and onboarding at phone size.
- [ ] Add a line under "Sessions and resumes" in `docs/superpowers/run-log.md`.
- [ ] Whole-branch review by a Fable agent (per the user's standing request); fix findings.
- [ ] Commit; ask the user before pushing (pushing deploys to Vercel).
