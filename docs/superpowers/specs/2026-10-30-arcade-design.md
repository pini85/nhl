# Arcade tab — "Revenge Tour", a 3-on-3 arcade hockey game made of club data

**Goal:** a new bottom-nav tab, **Arcade** (`/arcade`), with a fast, loud, over-the-top 3-on-3 hockey game built for one thumb on each side of a phone in portrait. The teams, ratings, opponents and storyline all come from the club's real games.

## 1. Research notes

- **Controls that work on glass.** Shipped mobile hockey games (Superstar Hockey: tap to pass / swipe to shoot; Slap Shots: hold to charge, release to shoot; Dangle Dash: gestures + a "fire mode") all avoid tiny buttons. A floating joystick (appears under the thumb, anywhere on the left half) plus gestures on the right half needs no aiming at UI at all.
- **Game feel ("juice").** Jonasson & Purho's "Juice it or lose it" and Vlambeer's "Art of Screenshake": hit-stop (freeze a few frames on impact), small screen shake, particles, squash, flashes, floating text and sound stacked on the *core* actions (shoot, hit, score). Keep shake small; overuse hurts clarity.
- **Phone performance.** `requestAnimationFrame` + fixed-timestep physics with an accumulator and a capped frame delta (no spiral after a tab switch); canvas at `devicePixelRatio` capped at 2; few draw calls; cache static art (the rink) in an offscreen canvas. 90/120 Hz screens must not speed the game up.
- **Why Canvas 2D, not three.js here.** The Galaxy tab already shows off WebGL. For a game the priority is crisp readability and 60fps on any phone; ~10 moving things with lots of effects is exactly what 2D canvas does well, and it costs ~0 KB of libraries. A fake third dimension (puck height + shadow, flip passes, players launched by hits) gives depth.

## 2. The game

**Portrait rink**, you attack upward. Camera follows the play vertically (leading the puck), always showing the full width. 3 skaters + 1 goalie per side. One 3:00 period, running clock; tied → sudden-death overtime.

### Controls
| Where | You have the puck | You don't |
| --- | --- | --- |
| Left half (floating stick) | skate; push to the edge = **burst** (uses stamina) | same |
| Right half **tap** | **pass** (to the teammate closest to where you're steering, else the most open one) | **switch** to the teammate nearest the puck |
| Right half **swipe** | **wrist shot** in the swipe direction, power from swipe speed | **body check** dash in the swipe direction |
| Right half **hold → release** | **slapshot**: charge ring fills, releases toward the net | **poke check** lunge at the carrier |

Shooting within ~0.35 s of receiving a pass = **ONE-TIMER** (extra speed, special text). Your controlled player auto-switches to the nearest teammate when the puck is loose or the other team has it (with a short lock after a manual switch).

### Rules of the arcade
- No offside, icing or penalties. Goal → slow-mo, celebration, faceoff at centre.
- **ON FIRE:** a player who scores 2 of his team's goals in a row catches fire (flame trail, +30% shot power, goalies shaken) until the other team scores.
- **Hat trick:** hats rain on the ice.
- **Big hits** knock the carrier flat for a moment and the puck loose; a body hit at speed flings players with hit-stop and shake.
- **INSANE mode** (toggle): game speed ×1.25, two pucks on the ice, hits launch players across the rink.

### Data → game
- **Your team:** club regulars (no guests). Ratings from real totals, scaled within the club to 60–99:
  - *Shot* = goals per game and shooting %; *Pass* = pass % and assists per game; *Hit* = hits per game; *Skate* = points per game and takeaways per game; *Goalie* = save %.
  - Pick 3 skaters + a goalie (defaults: you if picked on this device, then the most-played regulars; your goalie is the most-played goalie). "You" are gold in the game too.
- **Opponents:** every real club we have played, with the real gamertags of their players from our box scores (top 3 skaters + goalie by games against us), ratings from their numbers against us. Clubs with no box score get anonymous numbered players.
- **Difficulty** comes from the real head-to-head: clubs that beat us more, and by more, play faster and smarter.
- **Revenge Tour (campaign):** every club with a losing or even record against us, worst first ("they beat us 5–2, now it's your turn"). Win → **AVENGED** stamp, saved on the device. Last stop is the real nemesis. **Exhibition:** any club played.
- Commentary uses real names: "PePezki_ SNIPES IT!", "mike_v_75 LAYS THE BODY!".
- Post-game card: arcade score, three stars of the game, the real record vs that club, avenged or not.

### Look and sound
- Arena Night palette (dark navy, ice-white rink with blue/red lines, cyan glow). The ice is drawn once to an offscreen canvas; **skate marks are carved into it** as the game goes on.
- Skaters: top-down helmet + shoulders, jersey colour, number, name tag, stick; shadow; lean into turns. Puck with motion trail and height (shadow separates on flips).
- Effects: ice-spray particles on hard stops, sparks + "DING" on posts, shot speed lines, shockwave on hits, net bulge, goal flash, confetti in team colours, floating text, scoreboard "jumbotron" at the top.
- Sound synthesized with Web Audio (no files): stick clack, puck thud on boards, post ding, body hit thump, crowd bed that swells near the net, goal horn chord, whistle. Mute toggle remembered. Short vibrations on hits, shots and goals where supported.

### Edge cases
- Pauses when the tab is hidden; pause button; leave to menu.
- Reduced motion: no screen shake, no slow-mo zoom, fewer particles.
- Landscape: asks to rotate (rink stays portrait).
- Fewer than 3 regular skaters: fills the team with "Call-up" placeholders. No games at all: friendly empty state.
- localStorage can be missing: the game still works, progress just isn't kept.

## 3. Architecture
- `lib/stats/arcade.ts` (pure, tested): builds `ArcadeData` from our lines, games, roster, extras and opponent lines.
- `lib/queries/club.ts` + `lib/data/club.ts`: one new cached read, opponent lines from our own games.
- `components/arcade/engine/` (pure TS, no DOM, tested): rink geometry, physics, the match simulation, AI, seeded RNG.
- `components/arcade/` (browser): canvas renderer, input, audio, effects, React menus.
- `app/arcade/page.tsx` (server) → `ArcadeView` (client menus) → `Game` loaded with `next/dynamic` `ssr: false`.
