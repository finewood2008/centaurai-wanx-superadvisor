import type { BrainstormSession, BrainstormSource } from "./bridge";

export const sourceKinds = {
  memory: "知君记忆",
  ontology: "已确认资料",
  knowledge: "知识库",
  history: "知君对话",
};
export const sourceProvenance: Record<string, string> = {
  user_statement: "用户原话",
  assistant_reply: "AI 回复",
  confirmed_fact: "用户已确认",
  model_inference: "AI 推测",
  inference: "AI 推测",
  confirmed_understanding: "用户确认的理解",
  source_quote: "原文引用",
};

export function sourceTitle(source: BrainstormSource) {
  const title = source.title.trim();
  const internal = /^(?:memory:)?\/?(?:atoms?|raw(?:_events)?|pages?)\//i;
  const identifier =
    /^(?:(?:memory|ontology|history):)?(?:[a-z]+_)?(?:[0-9A-HJKMNP-TV-Z]{26}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(?:\.md)?$/i;
  return !title ||
    title === source.id ||
    internal.test(title) ||
    identifier.test(title)
    ? sourceKinds[source.kind]
    : title;
}

export function readableReferences(
  text: string,
  sources: readonly BrainstormSource[],
) {
  let readable = text;
  for (const source of sources) {
    readable = readable.split(source.id).join(sourceTitle(source));
    if (source.kind === "memory" && source.id.startsWith("memory:"))
      readable = readable.split(source.id.slice(7)).join(sourceTitle(source));
  }
  return readable;
}

export function viewpointParts(text: string) {
  const clean = text.trim();
  const newline = clean.indexOf("\n");
  const end = clean.search(/[。！？](?:\s|$)/);
  const split = newline >= 0 ? newline : end >= 0 ? end + 1 : clean.length;
  return {
    title: clean
      .slice(0, split)
      .replace(/^#{1,6}\s+|^[-*]\s+/, "")
      .replace(/^\*\*(.*?)\*\*$/, "$1"),
    detail: clean.slice(split).trim(),
  };
}

export function meetingDigest(session: BrainstormSession) {
  const draft = session.report_draft;
  const pending = session.ideas.filter((idea) =>
    /待.*回报|尚未回报|等待.*回报/.test(idea),
  );
  return {
    overview: draft?.overview || session.brief || session.summary,
    points: draft?.key_points.length
      ? draft.key_points
      : session.ideas.filter((idea) => !pending.includes(idea)),
    disagreements: draft?.disagreements ?? [],
    actions: draft?.actions ?? [],
    questions: [
      ...new Set([...(draft?.open_questions ?? []), ...session.questions]),
    ],
    pending,
  };
}
