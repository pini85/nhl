import Link from "next/link";
import { RemoveScoutButton } from "@/components/club/RemoveScoutButton";
import { Section } from "@/components/club/Section";

type Req = { id: number; query: string; status: "pending" | "done" | "not_found" | "error"; clubId: number | null; results: number | null };

const LABEL: Record<Req["status"], string> = {
  pending: "⏳ waiting for the next collector run",
  done: "✓ scouted",
  not_found: "✗ no club found",
  error: "✗ EA didn't answer, try again later",
};

export function ScoutRequests({ requests }: { requests: Req[] }) {
  if (!requests.length) return null;
  return (
    <Section title="Recent scout requests">
      <ul className="space-y-1.5 text-sm">
        {requests.slice(0, 6).map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2">
            {r.status === "done" && r.clubId ? (
              <Link href={`/clubs/${r.clubId}`} className="truncate font-semibold text-[var(--accent-blue)]">
                {r.query}
              </Link>
            ) : (
              <span className="truncate">{r.query}</span>
            )}
            <span className="ml-auto shrink-0 text-[11px] text-[var(--muted-fg)]">
              {r.status === "done" && (r.results ?? 0) > 1 ? `✓ ${r.results} found · search to see all` : LABEL[r.status]}
            </span>
            <RemoveScoutButton id={r.id} query={r.query} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
