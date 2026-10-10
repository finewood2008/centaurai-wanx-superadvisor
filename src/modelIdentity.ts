import type { BrainstormProfile, BrainstormSession } from "./bridge";

export type ModelFamily = "claude" | "gpt" | "gemini" | "grok" | "deepseek" | "qwen";

// Inspect the model name, not the gateway/provider (e.g. openrouter/anthropic/claude).
export function modelFamily(model?: string | null): ModelFamily | undefined {
  const name = model?.trim().toLowerCase().split("/").pop() ?? "";
  if (/(^|[^a-z])claude/.test(name)) return "claude";
  if (/(^|[^a-z])(?:gpt|chatgpt|o[134](?:\b|[-_]))/.test(name)) return "gpt";
  if (/(^|[^a-z])gemini/.test(name)) return "gemini";
  if (/(^|[^a-z])grok(?=$|[^a-z])/.test(name)) return "grok";
  if (/(^|[^a-z])deepseek/.test(name)) return "deepseek";
  if (/(^|[^a-z])(?:qwen|qwq)/.test(name) || name.includes("通义千问")) return "qwen";
}

export const familyNames: Record<ModelFamily, string> = {
  claude: "Claude", gpt: "GPT", gemini: "Gemini", grok: "Grok",
  deepseek: "DeepSeek", qwen: "Qwen",
};

export function speakerIdentity(
  agentId: string | undefined,
  session: BrainstormSession,
  profile?: BrainstormProfile,
) {
  const moderator = !agentId || agentId === session.team_id;
  const participant = session.participants?.find((m) => m.agent_id === agentId);
  const configured = profile?.members.find((m) => m.agent_id === agentId);
  // Closed meetings retain their roster; active meetings follow the saved model assignment.
  const member = session.status === "ended" ? participant ?? configured : configured ?? participant;
  return {
    moderator,
    name: moderator ? "主持人" : participant?.name ?? member?.name ?? "参谋",
    model: moderator ? undefined : member?.model,
  };
}
