import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const source = await readFile(
  new URL("../src/insightContent.ts", import.meta.url),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const { meetingDigest, sourceTitle, viewpointParts, readableReferences } =
  await import(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
  );

test("digest separates actual viewpoints, unresolved work, proposals and owner ruling", () => {
  const state = {
    brief: "目前先复用旧课",
    summary: "",
    ideas: ["（待成员回报）招生方向", "先问十位老学员。因为每周只有两小时。"],
    questions: ["是否愿意试一周？"],
    ruling: "",
    report_draft: null,
  };
  const digest = meetingDigest(state);
  assert.deepEqual(digest.pending, [state.ideas[0]]);
  assert.deepEqual(digest.points, [state.ideas[1]]);
  assert.equal(state.ruling, "");
  const draft = {
    overview: "省制作时间不等于省答疑时间。",
    key_points: [
      "先复用旧课。\n理由：不用再做一次。\n对你意味着：两小时留给学员。",
    ],
    disagreements: ["答疑时间是否增加，仍未验证。"],
    actions: [{ task: "试一周", owner: "", timing: "" }],
    open_questions: ["是否愿意试一周？"],
  };
  const fresh = meetingDigest({ ...state, report_draft: draft });
  assert.deepEqual(fresh.points, draft.key_points);
  assert.deepEqual(fresh.questions, state.questions);
  assert.deepEqual(fresh.actions, draft.actions);
  assert.deepEqual(viewpointParts(fresh.points[0]), {
    title: "先复用旧课。",
    detail: "理由：不用再做一次。\n对你意味着：两小时留给学员。",
  });
});

test("source presentation hides internal identifiers while keeping content and meaningful origin", () => {
  const memory = {
    id: "memory:atom/00000000-0000-0000-0000-000000000001.md",
    title: "atom/00000000-0000-0000-0000-000000000001.md",
    kind: "memory",
  };
  const history = {
    id: "history:thr_01M3MBCQC0GQZJGVNHXNM5ZM57:2",
    title: "学院的市场运营",
    kind: "history",
  };
  assert.equal(sourceTitle(memory), "知君记忆");
  assert.equal(sourceTitle(history), "学院的市场运营");
  assert.equal(
    readableReferences(
      `根据 ${memory.id}，每周只有两小时；出处 ${history.id}。`,
      [memory, history],
    ),
    "根据 知君记忆，每周只有两小时；出处 学院的市场运营。",
  );
  assert.equal(
    sourceTitle({ ...history, title: "thr_01M3MBCQC0GQZJGVNHXNM5ZM57" }),
    "知君对话",
  );
});
