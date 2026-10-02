import type { Message } from "./bridge";

export function messageText(message: Message) {
  return typeof message.content === "string"
    ? message.content
    : message.content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n");
}
export interface Speech {
  key: number;
  ids: string[];
  role: string;
  agent_id?: string;
  text: string;
  shown: number;
  done: boolean;
  instant: boolean;
  streamed: boolean;
  confirmed: boolean;
  received?: string;
}
export const isHuman = (speech: { role: string }) =>
  ["human", "user"].includes(speech.role);
const normalized = (text: string) => text.replace(/\s+/g, "").trim();

/** Only presentation is paced. Complete messages remain in WANX history. */
export class SpeechPlayback {
  entries: Speech[] = [];
  private nextKey = 0;
  private seeded = false;
  private streams = new Map<string, Speech>();

  reset() {
    this.entries = [];
    this.streams.clear();
    this.seeded = false;
  }
  history(messages: Message[], older = false) {
    const initial = !this.seeded;
    const additions: Speech[] = [];
    for (const message of messages) {
      const text = messageText(message);
      const id =
        message.id ?? `${message.role}:${message.agent_id ?? ""}:${text}`;
      let entry = this.entries.find((s) => s.ids.includes(id));
      if (!entry) {
        entry = this.entries.find((s) => {
          if (
            (!isHuman(s) && s.agent_id !== message.agent_id) ||
            isHuman(s) !== isHuman(message)
          )
            return false;
          if (!s.ids.length && isHuman(s)) return s.text === text;
          if (!s.streamed || s.confirmed || !text.trim() || !s.text.trim())
            return false;
          const a = normalized(s.text),
            b = normalized(text);
          return a.includes(b) || b.startsWith(a);
        });
      }
      if (entry) {
        if (!entry.ids.includes(id)) entry.ids.push(id);
        if (normalized(text).length >= normalized(entry.text).length)
          entry.text = text;
        entry.confirmed = normalized(text) === normalized(entry.text);
        // A history row can arrive before the stream's final frame.
        if (!this.streams.has(entry.agent_id ?? "")) entry.done = true;
        if (entry.instant) entry.shown = Array.from(entry.text).length;
      } else {
        additions.push({
          key: this.nextKey++,
          ids: [id],
          role: message.role,
          agent_id: message.agent_id,
          text,
          shown:
            initial || older || isHuman(message) ? Array.from(text).length : 0,
          done: true,
          instant: initial || older || isHuman(message),
          streamed: false,
          confirmed: true,
        });
      }
    }
    this.entries =
      initial || older
        ? [...additions, ...this.entries]
        : [...this.entries, ...additions];
    this.seeded = true;
  }
  token(agent: string, text: string) {
    let entry = this.streams.get(agent);
    if (!entry) {
      entry = [...this.entries]
        .reverse()
        .find(
          (s) =>
            s.agent_id === agent &&
            !s.streamed &&
            !s.instant &&
            normalized(s.text).startsWith(normalized(text)),
        );
      if (!entry) {
        entry = {
          key: this.nextKey++,
          ids: [],
          role: "assistant",
          agent_id: agent,
          text: "",
          shown: 0,
          done: false,
          instant: false,
          streamed: true,
          confirmed: false,
        };
        this.entries.push(entry);
      }
      entry.streamed = true;
      entry.done = false;
      this.streams.set(agent, entry);
    }
    entry.received = (entry.received ?? "") + text;
    if (
      !entry.confirmed ||
      !normalized(entry.text).startsWith(normalized(entry.received))
    )
      entry.text = entry.received;
    if (entry.instant) entry.shown = Array.from(entry.text).length;
  }
  done(agent?: string) {
    for (const [id, entry] of this.streams) {
      if (agent !== undefined && agent !== id) continue;
      entry.done = true;
      this.streams.delete(id);
    }
  }
  human(text: string) {
    this.entries.push({
      key: this.nextKey++,
      ids: [],
      role: "user",
      text,
      shown: Array.from(text).length,
      done: true,
      instant: true,
      streamed: false,
      confirmed: false,
    });
  }
  get active() {
    return this.entries.find(
      (s) => !isHuman(s) && (!s.done || s.shown < Array.from(s.text).length),
    );
  }
  advance(reducedMotion = false) {
    const entry = this.active;
    if (!entry) return false;
    const length = Array.from(entry.text).length;
    const shown =
      reducedMotion || entry.instant
        ? length
        : Math.min(length, entry.shown + 3);
    if (shown === entry.shown) return false;
    entry.shown = shown;
    return true;
  }
  reveal() {
    const entry = this.active;
    if (!entry) return;
    entry.instant = true;
    entry.shown = Array.from(entry.text).length;
  }
  visible() {
    const active = this.active;
    const index = active ? this.entries.indexOf(active) : this.entries.length;
    return this.entries.filter((s, i) => isHuman(s) || i <= index);
  }
}
