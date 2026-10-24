"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { skipOnboarding } from "@/app/me/actions";
import { ClubLogo } from "@/components/club/ClubLogo";
import { AppIcon, InstallSteps, snoozeInstallBanner, useInstallMode } from "@/components/club/InstallPrompt";
import { ME_CHANGED, RosterPicker } from "@/components/club/RosterPicker";
import type { Choice } from "@/lib/stats/personal";

type Step = "who" | "install" | "done";

const noop = () => () => {};

/**
 * First-visit setup on Home and the Me tab: who are you → add to home screen → done.
 * Always rendered there; `needed` (no player cookie yet) decides whether it opens. It stays mounted
 * while the page refreshes after a pick, so the later steps keep their place.
 */
export function Onboarding({ needed, main, rest }: { needed: boolean; main: Choice[]; rest: Choice[] }) {
  const router = useRouter();
  const mode = useInstallMode();
  // Client only: without JavaScript nothing here could work, so nothing is drawn.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [closed, setClosed] = useState(false);
  const [step, setStep] = useState<Step>("who");
  const [name, setName] = useState<string | null>(null);

  const open = mounted && !closed && (needed || step !== "who");

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = before;
    };
  }, [open]);

  if (!open) return null;

  const close = () => {
    setClosed(true);
    window.dispatchEvent(new Event(ME_CHANGED));
  };
  const canInstall = mode !== null && mode !== "installed" && mode !== "none";
  const steps: Step[] = canInstall ? ["who", "install", "done"] : ["who", "done"];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set up Drop drop drop"
      className="fixed inset-0 z-[75] flex flex-col overflow-y-auto bg-[radial-gradient(120%_60%_at_50%_0%,#12305a_0%,#070b14_65%)] px-5 pt-4 animate-in fade-in duration-300 motion-reduce:animate-none"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <div className="flex gap-1.5" aria-hidden>
          {steps.map((s) => (
            <span key={s} className={`h-1.5 rounded-full transition-all ${s === step ? "w-6 bg-[var(--accent-blue)]" : "w-1.5 bg-white/25"}`} />
          ))}
        </div>
        {step !== "done" && (
          <button
            onClick={async () => {
              if (step === "who") {
                await skipOnboarding();
                router.refresh();
              } else snoozeInstallBanner();
              close();
            }}
            className="px-2 py-1 text-sm text-[var(--muted-fg)]"
          >
            Skip
          </button>
        )}
      </div>

      <div className="mx-auto mt-6 w-full max-w-md flex-1">
        {step === "who" && (
          <>
            <ClubLogo size={64} className="rounded-2xl shadow-[0_0_24px_rgba(92,200,255,0.25)]" />
            <h2 className="mt-4 text-2xl font-black">{mode === "installed" ? "Welcome to the app! Who are you?" : "Who are you?"}</h2>
            <p className="mt-1 mb-5 text-sm text-[var(--muted-fg)]">Tap your gamertag. You&apos;ll get your own stats, streaks and milestones.</p>
            <RosterPicker
              main={main}
              rest={rest}
              showNotOnTeam
              onPicked={(choice) => {
                if (!choice) return close();
                setName(choice.name);
                setStep(canInstall ? "install" : "done");
              }}
            />
          </>
        )}

        {step === "install" && mode && (
          <>
            <AppIcon size={64} />
            <h2 className="mt-4 text-2xl font-black">Get your stats one tap away, {name}</h2>
            <p className="mt-1 mb-5 text-sm text-[var(--muted-fg)]">Add Drop drop drop to your home screen. It opens full screen, like an app.</p>
            <InstallSteps mode={mode} onInstalled={() => setStep("done")} />
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => {
                  snoozeInstallBanner();
                  setStep("done");
                }}
                className="flex-1 rounded-full border border-[var(--card-border)] py-3 text-sm font-semibold text-[var(--muted-fg)]"
              >
                Not now
              </button>
              <button onClick={() => setStep("done")} className="flex-1 rounded-full bg-white/[0.08] py-3 text-sm font-semibold">
                Done
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="flex h-full flex-col items-center justify-center pb-20 text-center">
            <div className="text-6xl" aria-hidden>
              🏒
            </div>
            <h2 className="mt-4 text-2xl font-black">You&apos;re all set, {name}</h2>
            <p className="mt-2 text-sm text-[var(--muted-fg)]">Your stats are on the Me tab, and Home shows what&apos;s new since you last looked.</p>
            <button
              onClick={close}
              className="mt-8 w-full rounded-full bg-[var(--accent-blue)] py-3 text-sm font-bold text-[#070b14] active:opacity-80"
            >
              Let&apos;s go
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
