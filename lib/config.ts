export const CLUB_ID = 56507;
export const PLATFORM = "common-gen5";
export const MATCH_TYPES = ["gameType5", "gameType10", "club_private"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];
export const CLUB_TAG = "club-56507";
export const EA_BASE = "https://proclubs.ea.com/api/nhl";
export const CLUB_NAME = "Drop drop drop";
// The admin (puck_control): only this player sees the game night poll button.
export const ADMIN_PLAYER_ID = "1273735466";
