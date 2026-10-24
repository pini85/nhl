import type { ScoutStatus } from "@/app/opponents/actions";

export function scoutMessage(status: ScoutStatus): string {
  switch (status) {
    case "created":
    case "exists":
      return "Searching EA… usually takes a few seconds, at most ~2 minutes.";
    case "invalid":
      return "Type a club name (letters or numbers, up to 40 characters).";
    case "busy":
      return "The scouting queue is full right now. Try again in a few minutes.";
    default:
      return "Couldn't send the request. Try again.";
  }
}
