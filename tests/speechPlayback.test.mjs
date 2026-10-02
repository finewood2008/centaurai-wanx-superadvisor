import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const source = await readFile(
  new URL("../src/speechPlayback.ts", import.meta.url),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const { SpeechPlayback } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);
const message = (id, agent, content) => ({
  id,
  role: "assistant",
  agent_id: agent,
  content,
});
const visibleText = (speech) =>
  Array.from(speech.text).slice(0, speech.shown).join("");

test("burst answers appear one at a time; polling cannot skip playback or duplicate a speech", () => {
  const p = new SpeechPlayback();
  p.history([message("old", "host", "旧的会议记录完整显示")]);
  assert.equal(visibleText(p.visible()[0]), "旧的会议记录完整显示");
  p.token("a", "我建议先找十位老学员试一周，因为你每周只有两小时。");
  p.done("a");
  p.token("b", "我担心答疑仍然花时间，先记下这一周实际花了多久。");
  p.done("b");
  p.advance();
  assert.equal(visibleText(p.active), "我建议");
  assert.deepEqual(
    p.visible().map((s) => s.agent_id),
    ["host", "a"],
  );
  p.history([
    message("old", "host", "旧的会议记录完整显示"),
    message("a1", "a", p.entries[1].text),
    message("b1", "b", p.entries[2].text),
  ]);
  assert.equal(p.entries.length, 3);
  assert.equal(visibleText(p.active), "我建议");
  assert.deepEqual(
    p.visible().map((s) => s.agent_id),
    ["host", "a"],
  );
  p.reveal();
  assert.equal(p.active.agent_id, "b");
  assert.equal(p.entries[2].shown, 0);
  p.advance();
  assert.equal(visibleText(p.active), "我担心");
});

test("incremental tokens and early history commit retain pace, complete content and repeated speakers", () => {
  const p = new SpeechPlayback();
  p.history([]);
  p.token("a", "一个观点");
  p.advance();
  p.history([message("a1", "a", "一个观点，有具体理由。")]);
  assert.equal(p.entries.length, 1);
  assert.equal(p.entries[0].shown, 3);
  // The remaining tokens must not duplicate text already received from history.
  p.token("a", "，有具体理由。");
  p.done("a");
  p.history([message("a1", "a", "一个观点，有具体理由。")]);
  assert.equal(p.entries[0].text, "一个观点，有具体理由。");
  p.reveal();
  p.token("a", "另一个具体观点");
  p.done("a");
  p.history([
    message("a1", "a", "一个观点，有具体理由。"),
    message("a2", "a", "另一个具体观点"),
  ]);
  assert.equal(p.entries.length, 2);
  assert.equal(p.active.shown, 0);
});

test("history-only delivery is paced without truncation; older history and user interruptions stay readable", () => {
  const p = new SpeechPlayback();
  p.history([]);
  const long = "理由和例子".repeat(120) + "这是最后一个重要细节。";
  p.history([message("a1", "a", long), message("b1", "b", "下一位回应")]);
  p.advance();
  p.human("我想先聊另一件事");
  p.history([
    { id: "u1", role: "human", agent_id: "host", content: "我想先聊另一件事" },
  ]);
  assert.equal(
    p.entries.filter((s) => s.text === "我想先聊另一件事").length,
    1,
  );
  assert.equal(p.visible().at(-1).text, "我想先聊另一件事");
  p.history([message("older", "host", "更早的记录")], true);
  assert.equal(visibleText(p.visible()[0]), "更早的记录");
  const ticks = Math.ceil(
    (Array.from(long).length -
      p.entries.find((s) => s.ids.includes("a1")).shown) /
      3,
  );
  for (let i = 0; i < ticks; i++) p.advance();
  assert.equal(visibleText(p.entries.find((s) => s.ids.includes("a1"))), long);
  assert.equal(p.active.agent_id, "b");
  assert.equal(p.active.shown, 0);
});

test("disconnection and reduced motion do not strand later speeches or break Unicode", () => {
  const p = new SpeechPlayback();
  p.history([]);
  p.token("a", "建议😀先试");
  p.token("b", "再看看代价");
  p.advance();
  assert.equal(visibleText(p.active), "建议😀");
  p.done();
  p.advance(true);
  assert.equal(p.active.agent_id, "b");
  assert.equal(p.active.shown, 0);
  p.advance(true);
  assert.equal(p.active, undefined);
  p.reset();
  assert.deepEqual(p.visible(), []);
});
