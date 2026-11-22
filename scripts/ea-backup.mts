// Saves EA's latest games to a JSON file without the database (used while the database is down).
// Usage: node --import tsx scripts/ea-backup.mts <output-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { takeBackup } from "@/lib/collector/backup";
import { createEaApi } from "@/lib/ea/api";

const dir = process.argv[2] ?? "ea-backup";
const backup = await takeBackup(createEaApi());
mkdirSync(dir, { recursive: true });
const file = path.join(dir, `${backup.takenAt.replace(/[:.]/g, "-")}.json`);
writeFileSync(file, JSON.stringify(backup));
const games = Object.values(backup.matches).reduce((n, l) => n + l.length, 0);
console.log(`ea-backup: ${games} games saved to ${file}${backup.errors.length ? `, errors: ${backup.errors.join("; ")}` : ""}`);
process.exit(games || backup.seasonal ? 0 : 1);
