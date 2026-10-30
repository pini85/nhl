"use client";

import { CalendarDays, CircleUser, Gamepad2, Home, Orbit, Swords, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/games", label: "Games", icon: CalendarDays },
  { href: "/players", label: "Players", icon: Users },
  { href: "/opponents", label: "Opponents", icon: Swords },
  { href: "/galaxy", label: "Galaxy", icon: Orbit },
  { href: "/arcade", label: "Arcade", icon: Gamepad2 },
  { href: "/me", label: "Me", icon: CircleUser },
];

export function BottomNav() {
  return <BottomNavView path={usePathname()} />;
}

export function BottomNavView({ path }: { path: string | null }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--card-border)] bg-[rgba(7,11,20,0.92)] backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md justify-around py-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = path !== null && (href === "/" ? path === "/" : path.startsWith(href));
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-medium transition-colors min-[400px]:px-1.5 min-[400px]:text-[11px]",
                  active ? "text-[var(--accent-blue)]" : "text-[var(--muted-fg)]",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
