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
};

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
  skaters: Skater[];
  pucks: Puck[];
  controlled: number; // skater the human drives
  switchLock: number;
  fireRun: [{ who: number; n: number }, { who: number; n: number }];
  onFire: number[]; // skater indexes on fire
  events: GameEvent[];
  freeze: number; // hit-stop, real seconds
  timeScale: number; // slow motion after goals
  lastGoal: { team: 0 | 1; scorer: number; x: number; y: number } | null;
};

export type Action = { kind: "tap" } | { kind: "swipe"; dx: number; dy: number; power: number } | { kind: "charge" } | { kind: "release" };

/** Human input for one step. Move is a world direction with length 0..1. */
export type Input = { mx: number; my: number; burst: boolean; actions: Action[] };

export const NO_INPUT: Input = { mx: 0, my: 0, burst: false, actions: [] };
