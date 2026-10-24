"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { choosePlayer } from "@/app/me/actions";
import type { Choice } from "@/lib/stats/personal";

const POS: Record<string, string> = { center: "C", leftWing: "LW", rightWing: "RW", defenseMen: "D", goalie: "G" };

export const ME_CHANGED = "ddd:me-changed";

/** "Who are you?": tap your gamertag. Saves the pick in a cookie and re-renders the page. */
export function RosterPicker({
  main,
  rest,
  onPicked,
  showNotOnTeam = false,
}: {
  main: Choice[];
  rest: Choice[];
  onPicked?: (choice: Choice | null) => void;
  showNotOnTeam?: boolean;
}) {
  const router = useRouter();
  const [everyone, setEveryone] = useState(main.length === 0);
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);

  function pick(choice: Choice | null) {
    setPicked(choice?.eaPlayerId ?? "guest");
    start(async () => {
      await choosePlayer(choice?.eaPlayerId ?? "guest");
      window.dispatchEvent(new Event(ME_CHANGED));
      onPicked?.(choice);
      router.refresh();
    });
  }

  const list = everyone ? [...main, ...rest] : main;
  return (
    <div>
      <ul className="grid grid-cols-2 gap-2">
        {list.map((c) => (
          <li key={c.eaPlayerId}>
            <button
              onClick={() => pick(c)}
              disabled={pending}
              className="arena-card flex w-full flex-col items-start px-3 py-2.5 text-left active:bg-white/[0.08] disabled:opacity-60"
            >
              <span className="w-full truncate text-sm font-bold">
                {c.name}
                {pending && picked === c.eaPlayerId ? " …" : ""}
              </span>
              <span className="text-[11px] text-[var(--muted-fg)]">
                {POS[c.position] ?? c.position} · {c.gp} {c.gp === 1 ? "game" : "games"}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!everyone && rest.length > 0 && (
        <button onClick={() => setEveryone(true)} className="mt-3 w-full py-2 text-sm font-semibold text-[var(--accent-blue)]">
          Show everyone ({rest.length} more)
        </button>
      )}
      {showNotOnTeam && (
        <button onClick={() => pick(null)} disabled={pending} className="mt-2 w-full py-2 text-sm text-[var(--muted-fg)] underline-offset-2 active:underline">
          I&apos;m not on the team
        </button>
      )}
    </div>
  );
}

/** A button that reveals the roster picker in place ("Not you? Switch player", "Pick your player"). */
export function PickerToggle({ label, main, rest }: { label: string; main: Choice[]; rest: Choice[] }) {
  const [open, setOpen] = useState(false);
  if (open) return <RosterPicker main={main} rest={rest} onPicked={() => setOpen(false)} />;
  return (
    <button onClick={() => setOpen(true)} className="w-full py-3 text-sm font-semibold text-[var(--accent-blue)]">
      {label}
    </button>
  );
}
