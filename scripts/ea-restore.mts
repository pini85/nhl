// Loads EA backups (JSON files from ea-backup.mts, searched recursively) into the database.
// Usage: node --import tsx scripts/ea-restore.mts <backup-dir>
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDb } from "@/db/client";
import { restoreBackups, type EaBackup } from "@/lib/collector/backup";

const dir = process.argv[2] ?? "ea-backup";
const files = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".json"));
const backups = files.map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")) as EaBackup);
const r = await restoreBackups(getDb(), backups);
console.log(`ea-restore: ${JSON.stringify(r)}`);
process.exit(r.errors.length && !r.newMatches ? 1 : 0);
