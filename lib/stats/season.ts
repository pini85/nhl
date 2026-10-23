import { getDivision, MAX_POINTS, SEASON_GAMES, type Division } from "@/lib/divisions";

export type SeasonState =
  | "not-started"
  | "title-zone"
  | "promotion-zone"
  | "contending"
  | "promotion-in-reach"
  | "safe"
  | "at-risk"
  | "relegated";

export type SeasonProgress = {
  points: number;
  gp: number;
  remaining: number;
  wins: number;
  losses: number;
  otl: number;
  division: Division | null;
  state: SeasonState;
  safeReached: boolean;
  winsToPromotion: number | null;
  winsToTitle: number | null;
  maxPoints: number;
  outlook: string;
};

const wins = (n: number) => `${n} ${n === 1 ? "win" : "wins"}`;

export function seasonProgress(seasonResults: string[], divisionId: number): SeasonProgress {
  const played = seasonResults.filter((r) => r === "wins" || r === "losses" || r === "otl");
  const w = played.filter((r) => r === "wins").length;
  const l = played.filter((r) => r === "losses").length;
  const o = played.filter((r) => r === "otl").length;
  const points = w * 2 + o;
  const gp = played.length;
  const remaining = Math.max(0, SEASON_GAMES - gp);
  const maxPoints = Math.min(MAX_POINTS, points + remaining * 2);
  const division = getDivision(divisionId);

  const base = { points, gp, remaining, wins: w, losses: l, otl: o, division, maxPoints };

  if (gp === 0) {
    return {
      ...base,
      state: "not-started",
      safeReached: false,
      winsToPromotion: null,
      winsToTitle: null,
      outlook: `${SEASON_GAMES} games, ${MAX_POINTS} points on the table`,
    };
  }
  if (!division) {
    return { ...base, state: "contending", safeReached: false, winsToPromotion: null, winsToTitle: null, outlook: "" };
  }

  const { hold, promotion, title } = division;
  const distinct = promotion < title;
  const winsTo = (target: number) =>
    maxPoints < target ? null : points >= target ? 0 : Math.ceil((target - points) / 2);
  const toPromo = distinct ? winsTo(promotion) : null;
  const toTitle = winsTo(title);

  let state: SeasonState;
  if (points >= title) state = "title-zone";
  else if (distinct && points >= promotion) state = "promotion-zone";
  else if (maxPoints < hold) state = "relegated";
  else if (maxPoints >= title) state = "contending";
  else if (distinct && maxPoints >= promotion) state = "promotion-in-reach";
  else if (points >= hold) state = "safe";
  else state = "at-risk";

  let outlook: string;
  switch (state) {
    case "title-zone":
      outlook = "Division title secured 🏆";
      break;
    case "promotion-zone":
      outlook = toTitle ? `Promotion secured · ${wins(toTitle)} to title` : "Promotion secured";
      break;
    case "contending":
    case "promotion-in-reach":
      outlook = [toPromo ? `${wins(toPromo)} to promotion` : null, toTitle ? `${wins(toTitle)} to title` : null]
        .filter(Boolean)
        .join(" · ");
      break;
    case "safe":
      outlook = "Safe from relegation · promotion out of reach";
      break;
    case "at-risk":
      outlook = `${wins(winsTo(hold) ?? 0)} to stay up`;
      break;
    default:
      outlook = `Relegated · can't reach ${hold} pts`;
  }

  return { ...base, state, safeReached: points >= hold, winsToPromotion: toPromo, winsToTitle: toTitle, outlook };
}
