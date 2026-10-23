import { EmptyState } from "@/components/club/Section";

export const metadata = { title: "Opponents" };

export default function OpponentsPage() {
  return (
    <>
      <h1 className="text-2xl font-black">Opponents</h1>
      <EmptyState title="Scouting is coming soon" hint="Head-to-head records, nemesis clubs and lobby scouting." />
    </>
  );
}
