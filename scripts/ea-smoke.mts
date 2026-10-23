import { CLUB_ID } from "@/lib/config";
import { createEaApi } from "@/lib/ea/api";

const ea = createEaApi();
const m = await ea.clubMatches(CLUB_ID, "gameType5");
const s = await ea.seasonalStats(CLUB_ID);
console.log("matches:", m.ok ? `${m.data.length} games` : m.error);
console.log("seasonal:", s.ok ? `division ${s.data.currentDivision}` : s.error);
process.exit(m.ok && s.ok ? 0 : 1);
