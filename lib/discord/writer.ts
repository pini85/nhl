// Optional: a short commentator-style intro written by Claude. Without ANTHROPIC_API_KEY the recap posts without it.
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM = `You write the opening of a Discord post recapping last night's games for "Drop drop drop", a group of friends playing EA NHL club games together.
Write 2-3 sentences in the voice of an upbeat hockey commentator who knows the team: name the story of the night (a comeback, a slump, a standout player, a rivalry) and why it matters.
Use only the facts given. Never invent players, scores or events. Plain text, at most one emoji, no headings, no lists, under 350 characters. The stats are listed under your text, so don't recite them all.`;

export async function writeIntro(facts: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic({ timeout: 60_000 });
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: facts }],
    });
    if (response.stop_reason !== "end_turn") return null;
    const text = response.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("")
      .trim();
    return text ? text.slice(0, 500) : null;
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.log(`intro: Claude API error ${e.status}: ${e.message}`);
    else console.log(`intro failed: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}
