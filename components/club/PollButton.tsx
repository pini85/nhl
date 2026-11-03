"use client";

import { useState, useTransition } from "react";
import { postPoll } from "@/app/me/admin-actions";
import { Button } from "@/components/ui/button";

const MESSAGES: Record<string, string> = {
  posted: "✅ Poll posted in Discord.",
  already: "Already posted today.",
  error: "Couldn't reach Discord. Try again in a minute.",
  forbidden: "Only the admin can post the poll.",
};

/** Admin only: posts the game night poll to Discord. */
export function PollButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="my-4 rounded-2xl border border-[var(--border)] p-4">
      <h2 className="font-bold">Game night poll</h2>
      <p className="mt-1 text-sm text-[var(--muted-fg)]">Asks Discord who can play tonight: 19:30 to 21:30 CET, open for 16 hours.</p>
      <Button
        className="mt-3"
        size="lg"
        disabled={pending || result === "posted"}
        onClick={() =>
          start(async () => {
            setResult(await postPoll().catch(() => "error"));
          })
        }
      >
        {pending ? "Posting…" : "🏒 Post poll to Discord"}
      </Button>
      {result && (
        <p className="mt-2 text-sm" role="status">
          {MESSAGES[result]}
        </p>
      )}
    </div>
  );
}
