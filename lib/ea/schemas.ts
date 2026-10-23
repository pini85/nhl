import { z } from "zod";

// EA sends most numbers as strings; accept both and normalize later.
const strNum = z.union([z.string(), z.number()]);

export const EaPlayerSchema = z.looseObject({
  playername: z.string(),
  position: z.string(),
});
export type EaPlayer = z.infer<typeof EaPlayerSchema> & Record<string, unknown>;

export const EaMatchClubSchema = z.looseObject({
  score: strNum,
  opponentClubId: strNum,
  result: strNum,
  details: z.looseObject({ name: z.string() }).optional(),
});
export type EaMatchClub = z.infer<typeof EaMatchClubSchema> & Record<string, unknown>;

export const EaMatchSchema = z.looseObject({
  matchId: strNum.transform(String),
  timestamp: z.number(),
  clubs: z.record(z.string(), EaMatchClubSchema),
  players: z.record(z.string(), z.record(z.string(), EaPlayerSchema)).default({}),
  aggregate: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
});
export type EaMatch = z.infer<typeof EaMatchSchema>;

export const EaMatchListSchema = z.array(EaMatchSchema);

const recentFields = Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [
    [`recentOpponent${i}`, z.string()],
    [`recentScore${i}`, z.string()],
  ]).flat(),
) as Record<`recentOpponent${number}` | `recentScore${number}`, z.ZodString>;

export const EaSeasonalStatsSchema = z.looseObject({
  clubId: strNum,
  currentDivision: z.number(),
  recentResults: z.array(z.string()),
  ...recentFields,
});
export type EaSeasonalStats = z.infer<typeof EaSeasonalStatsSchema> &
  Record<`recentOpponent${number}` | `recentScore${number}`, string>;

export const EaSeasonalStatsListSchema = z.array(EaSeasonalStatsSchema).min(1);
