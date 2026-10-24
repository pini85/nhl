# Personal layer: onboarding, Me tab, moments (phase 1)

Date: 2026-10-24 · Status: draft for review

## Why

The site is a team app for Drop drop drop teammates. It should also feel personal: each teammate sees their own numbers first, gets nudged toward milestones and records, and sees what happened to the team since their last visit. This also gives people a reason to add the app to their home screen (the install prompt shipped in `0a144a1`).

Who uses it: teammates, almost always on phones. Others (friends, scouted opponents) are rare and just see the team app.

## Decisions

- The app stays a **team app with a personal layer**. Shared links look the same for everyone; personal pieces are added on top.
- Identity is **a cookie, no login**: you pick yourself from the roster. Honor system.
- **Moments are public**: everyone sees every moment; your own are worded "you" and come first.
- **Phase 1** (this spec): onboarding (who are you + install), Me tab, Home card, "You" highlights, moment cards. **Phase 2** (later spec): push notifications, the notifications onboarding screen, morning-after recap.

## Identity

- Cookie `ddd-player`, one year, `SameSite=Lax`, values:
  - `<eaPlayerId>`: the teammate picked themselves
  - `guest`: "I'm not on the team" (never asked again; no personal pieces)
  - `skipped`: closed onboarding (shows "Set up your profile" prompts)
- Set through a server action, then the page refreshes so personal pieces render straight away.
- Pages stay prerendered and cached (`cacheComponents`). Only the personal pieces read the cookie, each inside its own `Suspense` boundary, and use the existing cached data functions (`lib/data/club.ts`).
- iPhone home-screen apps get fresh storage (no cookies from Safari). On first launch without the cookie, the app shows a one-screen "Welcome! Who are you?".
- An unknown player id in the cookie (e.g. player data reset) is treated as not set.

## Onboarding

- Shows on the first visit to **Home or the Me tab** when `ddd-player` is not set. A shared deep link (game, club, night) never shows it; the person sees the page and onboarding waits for Home.
- Full-screen overlay in the Wrapped style, progress dots, **Skip** in the corner (sets `skipped`).
- **Screen 1: Who are you?** Roster cards (gamertag, position, games played), sorted by most recent game. Players without a game in the last 60 days sit behind "Show everyone". Bottom link: "I'm not on the team" (sets `guest`, closes onboarding).
- **Screen 2: Add to your home screen.** The install steps from `components/club/InstallPrompt.tsx`, inline, headed "Get your stats one tap away, {name}". Left out when already installed or the device can't install. "Not now" also snoozes the install banner for 14 days.
- **Finish:** "You're all set, {name}" → Home, now showing their card.
- Skipped or later: the Me tab shows "Set up your profile" (the roster picker inline); Home shows a small "Set up your profile" card with a close button.
- "Not you? Switch player" at the bottom of the Me tab reopens screen 1.
- The install banner stays hidden until `ddd-player` has any value.

## Me tab

Route `/me`, 5th bottom-nav tab (Home · Games · Players · Opponents · Me).

When set to a player, top to bottom:

1. **Your moments**: unseen moments about you (see Moments).
2. **Your last game night**: your totals for the latest night you played, compared with your per-game average ("2G 1A · +2 · 0.8 pts above your average").
3. **Streaks**: active only (point streak, goal streak, games-played streak).
4. **Next milestones**: the 2–3 closest round numbers for games, goals, assists, points, hits ("3 goals to 50").
5. **Records**: club records you hold, plus near misses within 15% ("2 hits short of the club record (14)").
6. **You vs. the team**: your per-game goals, assists, points, hits, +/- next to the team's skater average.
7. **Best linemates**: top 2 teammates by win % together (minimum 3 games), from `lib/stats/chemistry.ts`.
8. The existing player page content (card, club stats, best game, last 10, NHL 27 career), moved into a shared component used by both `/players/[playerId]` and `/me`.
9. "Not you? Switch player".

Goalies get goalie numbers in sections 2–6 (save %, GAA, shutouts); players with games at both positions see both.

Sections 4–7 also appear on every public player page, worded with the player's name.

When not set: "Set up your profile" with the roster picker. For `guest`: a short note and a "Pick your player" link.

## Home card

Directly under the club header, for a set player:
"Hey {name} 👋 · Last night: 2G 1A, 3–1 · 🔥 4-game point streak · 3 goals to 50" → links to `/me`.
No game in 14 days: next milestone + "Last played {date}". Nothing for `guest`; the small "Set up" card for unset/`skipped`.

## "You" highlights

Rows for a player carry `data-player-id`. A small client component reads `ddd-player` and adds a style rule for that id: soft blue tint and a "You" tag after the name. Applies to leaderboards, box scores, records, lines, the Players list and compare. Pages themselves don't change per person.

## Moments

### Kinds

| Kind | Public wording | Your wording |
|---|---|---|
| Club record set | "🏆 puck_control set a club record: 14 hits" | "🏆 You set a club record: 14 hits" |
| Record broken | "R4D1M_19 broke puck_control's hits record (15)" | "😤 R4D1M_19 took your hits record (15)" |
| Rare award | "🎩 Hat trick for puck_control vs HK Bricks" | "🎩 Your hat trick vs HK Bricks" |
| Personal milestone | "💯 100th point for puck_control" | "💯 Your 100th point" |
| Team moment | "⬆️ Promoted to Division 7", "🔥 Team record: 6 wins in a row", "Club goals: 500" | same |

- Rare awards: hat trick, shutout, Night MVP. (First-ever awards of each kind are left out: a new teammate would get a flood of them.)
- Milestone steps: games 25/50/100/200/500; goals and assists 10/25/50/100/250; points 10/25/50/100/200/500; hits 100/250/500/1000.
- Everyday awards (Sniper, Bruiser, etc.) are not moments.

### Computing them

- One pure function in `lib/stats/moments.ts` replays stored games in time order and emits moments: `{ id, kind, playerId | null, matchId, at, ... }`. It reuses `clubRecords` / `milestones` / `gameAwards` logic where possible.
- Records set while a record is first being established (the first game that ever sets it) are not moments; only beating an existing record is.
- `id` is a short stable hash of kind + key + match + player.
- Phase 2 push reuses this same function in the collector.

### Showing them

- **Home**: unseen moments from the last 14 days, yours first, then newest first. Up to 3 cards, then "Show all (N)" expands inline. Shown to everyone, including `guest`, `skipped` and unset visitors.
- **Me tab**: unseen moments about you.
- Each card has ✕ and links to its game. ✕ or opening the card marks it seen.
- Seen ids live in cookie `ddd-seen` (newest 60 ids; ids older than 14 days are dropped as they can't show anyway), so dismissed cards never flash before hiding.
- Your own new club record also triggers the existing confetti (`components/club/Celebrate.tsx`) once.
- Right after first picking a player, only moments from the last 7 days count as unseen; older ones are marked seen.

## Testing

- Unit tests (vitest, fixed game fixtures): moment replay (record set vs first-established, record broken, awards, milestones, team moments, stable ids), streaks, next milestones, near-miss records, you vs. team, best linemates, cookie value parsing.
- Phone e2e (Playwright): onboarding pick / skip / "not on the team" / switch player; deep link doesn't trigger onboarding; Me tab sections; Home card; "You" highlight in a box score; moment card ✕ stays gone after reload; first launch as iPhone home-screen app asks who you are; existing smoke tests still pass (including localStorage-blocked and no-JavaScript).

## Out of scope (phase 2 or never)

- Push notifications, the notifications onboarding screen, the morning-after recap, "your scout is ready".
- Logins or verifying who someone is.
- Personalizing other pages beyond highlights.
