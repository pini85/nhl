import type { Rng } from "@/components/arcade/engine/rng";

/** Ratings in 0..1 (from the 60–99 card numbers). */
export type PlayerInfo = {
  id: string;
  name: string;
  number: number;
  skate: number;
  shot: number;
  pass: number;
  hit: number;
  save: number; // goalies only
  you?: boolean;
};

export type TeamSetup = {
  name: string;
  abbr: string;
  color: string; // jersey colour (hex)
  skaters: PlayerInfo[]; // 3
  goalie: PlayerInfo;
  level: number; // AI quality 0..1
};

export type MatchSetup = {
  home: TeamSetup; // the human team, attacks +y
  away: TeamSetup;
  seed: number;
  insane: boolean;
  length: number; // seconds of game clock
  humanless?: boolean; // AI plays both sides (tests, attract mode)
  versus?: boolean; // a second human drives the away team (online play)
  /** Online party (up to 3 a side): one seat per human, in pilot order. Pilot 0 is the host, always home. */
  party?: Seat[];
};

/** A human's place in a party game. With 2+ humans on a team each starts faceoffs on skater `slot` and can switch to any skater a bot drives. */
export type Seat = { team: 0 | 1; slot: number };

export type Skater = {
  i: number; // index in state.skaters
  team: 0 | 1;
  goalie: boolean;
  info: PlayerInfo;
  x: number;
  y: number;
  vx: number;
  vy: number;
  face: number; // angle, radians
  r: number;
  stun: number; // seconds knocked down
  stamina: number; // 0..1
  burst: boolean;
  dash: number; // body-check dash time left
  dashX: number;
  dashY: number;
  poke: number; // poke-check time left
  pickupCd: number;
  charge: number; // slapshot wind-up 0..1, or -1
  /** A shot on its way: the stick is coming down to the puck, which leaves the blade when `t` runs out. */
  stroke: Stroke | null;
  recvT: number; // seconds since receiving a pass (one-timers)
  think: number; // seconds until the AI decides again
  tx: number; // AI move target
  ty: number;
  speedMul: number;
  holdT: number; // goalie: time holding the puck
  // stats
  goals: number;
  assists: number;
  shots: number;
  hits: number;
  saves: number;
};

export type Stroke = {
  t: number; // seconds until the blade meets the puck
  dur: number;
  lift: number; // how high the stick starts, 0..1 (a full slapshot wind-up is 1)
  dx: number;
  dy: number;
  power: number;
  slap: boolean;
  spread: number;
  oneTimer: boolean;
};

export type Puck = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  owner: number; // skater index or -1
  last: number; // last skater to touch it
  passTo: number; // intended receiver or -1
  shotBy: number; // shooter while a shot is live, or -1
  oneTimer: boolean;
  chain: number[]; // recent touches by the team in possession (assists)
  trail: { x: number; y: number; z: number }[];
};

export type GameEvent =
  | { kind: "shot"; x: number; y: number; by: number; power: number; oneTimer: boolean; slap: boolean }
  | { kind: "pass"; by: number; to: number; saucer: boolean }
  | { kind: "hit"; x: number; y: number; by: number; victim: number; power: number }
  | { kind: "poke"; x: number; y: number; by: number; won: boolean }
  | { kind: "post"; x: number; y: number }
  | { kind: "boards"; x: number; y: number; power: number }
  | { kind: "save"; x: number; y: number; by: number; held: boolean }
  | { kind: "block"; x: number; y: number; by: number }
  | { kind: "goal"; team: 0 | 1; scorer: number; assists: number[]; x: number; y: number; oneTimer: boolean; hatTrick: boolean; fire: boolean }
  | { kind: "fire"; who: number }
  | { kind: "faceoff" }
  | { kind: "drop" }
  | { kind: "overtime" }
  | { kind: "end"; winner: 0 | 1 }
  | { kind: "switch"; to: number }
  | { kind: "steal"; by: number };

/** A human's hold on their team. */
export type Pilot = {
  team: 0 | 1;
  fixed: boolean; // a teammate is human too: starts each faceoff on its own skater and switches only to bot-driven ones
  slot: number; // that skater, 0..2 in the team's line
  controlled: number; // skater the human drives
  idle: number; // seconds without input (autopilot takes over off the puck)
  switchLock: number;
};

export type Phase = "faceoff" | "play" | "goal" | "end";

export type MatchState = {
  setup: MatchSetup;
  rng: Rng;
  t: number; // total sim time
  clock: number; // game seconds left (counts up in overtime)
  ot: boolean;
  phase: Phase;
  phaseT: number;
  score: [number, number];
  sog: [number, number]; // shots on goal
  aiHitCd: [number, number]; // per team: seconds before the AI may throw another body check
  skaters: Skater[];
  pucks: Puck[];
  pilots: Pilot[]; // the humans: [home, away] normally, one per seat in a party game
  fireRun: [{ who: number; n: number }, { who: number; n: number }];
  onFire: number[]; // skater indexes on fire
  events: GameEvent[];
  freeze: number; // hit-stop, real seconds
  timeScale: number; // slow motion after goals
  lastGoal: { team: 0 | 1; scorer: number; x: number; y: number } | null;
};

export type Action =
  | { kind: "tap" } // pass, or switch player without the puck
  | { kind: "swipe"; dx: number; dy: number; power: number } // shoot that way, or body check without the puck
  | { kind: "shoot" } // wrist shot at the net, side picked by the stick
  | { kind: "hit" } // body check the way the stick points, else at the nearest puck carrier
  | { kind: "poke" }
  | { kind: "charge" }
  | { kind: "release" };

/** Human input for one step. Move is a world direction with length 0..1. */
export type Input = { mx: number; my: number; burst: boolean; actions: Action[] };

export const NO_INPUT: Input = { mx: 0, my: 0, burst: false, actions: [] };
