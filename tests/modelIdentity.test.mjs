import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const source = await readFile(new URL("../src/modelIdentity.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { modelFamily, speakerIdentity } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

test("model avatars recognize model families across gateways, versions and local tags", () => {
  const cases = {
    "openrouter/anthropic/claude-sonnet-4.5": "claude",
    "azure/gpt-4.1": "gpt", "openai/o3-mini": "gpt",
    "google/gemini-2.5-pro": "gemini", "xai/grok-4": "grok",
    "deepseek-chat": "deepseek", "ollama/qwen2.5:7b": "qwen",
    "qwq-32b": "qwen", "通义千问": "qwen",
    "openai/unknown-model": undefined, "grokking-custom": undefined,
    "": undefined,
  };
  for (const [model, family] of Object.entries(cases)) assert.equal(modelFamily(model), family, model);
});

test("saved model changes update active advisors while host and closed roster remain distinct", () => {
  const original = { agent_id: "a", name: "战略参谋", model: "claude-sonnet" };
  const session = { team_id: "old-host", status: "paused", participants: [original] };
  const profile = { team_id: "new-host", members: [{ ...original, model: "gemini-pro" }] };
  assert.equal(speakerIdentity("a", session, profile).model, "gemini-pro");
  assert.equal(speakerIdentity("old-host", session, profile).moderator, true);
  assert.equal(speakerIdentity("a", { ...session, status: "ended" }, profile).model, "claude-sonnet");
  assert.equal(speakerIdentity("a", session, { members: [] }).model, "claude-sonnet");
  assert.equal(speakerIdentity("unknown", session, profile).model, undefined);
  assert.equal(speakerIdentity("unknown", session, profile).moderator, false);
});
