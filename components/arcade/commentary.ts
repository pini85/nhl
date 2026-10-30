// What the arena announcer shouts. Real gamertags go in.

const pick = <T,>(l: readonly T[]) => l[Math.floor(Math.random() * l.length)];

export function goalLine(name: string, opts: { oneTimer: boolean; fire: boolean; ours: boolean }): string {
  if (!opts.ours) return pick([`${name} beats the goalie`, `${name} finds the net`, `${name} buries it`, `Ugh. ${name} scores`]);
  if (opts.fire) return pick([`${name} IS UNSTOPPABLE`, `${name} IS ON ANOTHER PLANET`, `SOMEBODY CALL THE FIRE DEPARTMENT`]);
  if (opts.oneTimer) return pick([`ONE-TIMER! ${name} HAMMERS IT HOME`, `${name} ONE-TIMES IT INTO THE NEXT POSTCODE`]);
  return pick([`${name} SNIPES IT!`, `BAR DOWN, ${name}!`, `TOP CHEESE FROM ${name}!`, `${name} GOES FIVE-HOLE!`, `${name} PICKS THE CORNER!`, `${name} WITH A ROCKET!`]);
}

export const goalWord = (ours: boolean) => (ours ? pick(["GOAL!", "GOAL!", "SNIPE!", "BAR DOWN!", "TOP SHELF!"]) : pick(["THEY SCORE", "GOAL AGAINST"]));

export const hitWord = () => pick(["BOOM!", "CRUNCH!", "WHAM!", "SMASH!", "KABOOM!"]);

export function hitLine(by: string, victim: string): string {
  return pick([`${by} LAYS THE BODY ON ${victim}!`, `${victim} JUST GOT ERASED BY ${by}`, `${by} SENDS ${victim} TO THE SHADOW REALM`, `${victim} WILL FEEL THAT ONE TOMORROW`]);
}

export const saveLine = (goalie: string) => pick([`${goalie} SAYS NO!`, `WHAT A STOP BY ${goalie}!`, `${goalie} FLASHES THE LEATHER`, `${goalie} IS A BRICK WALL`]);

export const postLine = () => pick(["DING! OFF THE IRON", "PING! THE POST SAVES THEM", "HIT THE POST — SO CLOSE"]);
