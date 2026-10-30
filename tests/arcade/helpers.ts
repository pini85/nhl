import { createMatch } from "@/components/arcade/engine/core";
import type { MatchSetup, PlayerInfo, TeamSetup } from "@/components/arcade/engine/types";

export const player = (id: string, v = 0.6, extra: Partial<PlayerInfo> = {}): PlayerInfo => ({
  id, name: id, number: 10, skate: v, shot: v, pass: v, hit: v, save: v, ...extra,
});

export const team = (name: string, v = 0.6, level = 0.6): TeamSetup => ({
  name, abbr: name.slice(0, 3).toUpperCase(), color: "#5cc8ff",
  skaters: [player(`${name}1`, v), player(`${name}2`, v), player(`${name}3`, v)],
  goalie: player(`${name}G`, v), level,
});

export const match = (extra: Partial<MatchSetup> = {}) =>
  createMatch({ home: team("Home"), away: team("Away"), seed: 7, insane: false, length: 180, humanless: true, ...extra });
