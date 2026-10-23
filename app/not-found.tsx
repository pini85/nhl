import Link from "next/link";

export default function NotFound() {
  return (
    <div className="arena-card my-10 p-6 text-center">
      <div className="text-4xl">🥅</div>
      <h1 className="mt-2 text-lg font-bold">Nothing here</h1>
      <p className="mt-1 text-sm text-[var(--muted-fg)]">That game or player isn&apos;t in our records.</p>
      <Link href="/" className="mt-4 inline-block text-sm font-semibold text-[var(--accent-blue)]">
        Back to home
      </Link>
    </div>
  );
}
