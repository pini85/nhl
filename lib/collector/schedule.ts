// When the collector should run next. Every ~10 minutes in the evening, when games are played,
// and once an hour (just after the hour) the rest of the day, so the database can sleep in between.
const TZ = "Europe/Amsterdam";
const EVENING_MS = 8 * 60_000; // plus ~2 minutes of run time ≈ every 10 minutes
const PAST_HOUR_MIN = 5; // off-hours runs start at :05, so the 08:00 recap posts around 08:05

const partsFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

/** Evening play hours in Amsterdam: 18:00 to 03:00. */
export function isPlayHours(hour: number): boolean {
  return hour >= 18 || hour < 3;
}

/** Milliseconds to wait before starting the next collector run. */
export function msUntilNextRun(now: Date): number {
  const p = Object.fromEntries(partsFmt.formatToParts(now).map((x) => [x.type, Number(x.value)]));
  if (isPlayHours(p.hour)) return EVENING_MS;
  const intoHour = (p.minute * 60 + p.second) * 1000 + now.getMilliseconds();
  let wait = PAST_HOUR_MIN * 60_000 - intoHour;
  if (wait < 60_000) wait += 3_600_000; // already past :04, wait for the next hour
  return wait;
}
