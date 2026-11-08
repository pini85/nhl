// Read-only: lists the newest stored games and checks they show on the site.
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { matches, matchPlayers } from "@/db/schema";
import { CLUB_ID } from "@/lib/config";

const db = getDb();
const rows = await db
  .select({
    id: matches.matchId, at: matches.playedAt, type: matches.matchType, source: matches.source,
    gf: matches.goalsFor, ga: matches.goalsAgainst, opp: matches.opponentName,
    ours: sql<number>`(select count(*) from ${matchPlayers} where ${matchPlayers.matchId} = ${matches.matchId} and ${matchPlayers.clubId} = ${CLUB_ID})`,
  })
  .from(matches).orderBy(desc(matches.playedAt)).limit(10);
for (const r of rows) console.log(r.at.toISOString(), r.type, r.source, `${r.gf}-${r.ga}`, r.opp, `our players: ${r.ours}`, r.id);
void eq;

const site = process.env.SITE_URL;
if (site) {
  for (const path of ["/", "/games", "/players"]) {
    const res = await fetch(site + path);
    const html = await res.text();
    const seen = rows.slice(0, 5).map((r) => `${r.id.slice(-4)}:${html.includes(r.id) ? "yes" : "no"}`);
    console.log("site", path, res.status, html.length, "ids shown:", seen.join(" "));
  }
}
process.exit(0);
