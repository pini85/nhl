"use client";

import { CalendarDays, Home, Swords, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/games", label: "Games", icon: CalendarDays },
  { href: "/players", label: "Players", icon: Users },
  { href: "/opponents", label: "Opponents", icon: Swords },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--card-border)] bg-[rgba(7,11,20,0.92)] backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md justify-around py-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium transition-colors",
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
