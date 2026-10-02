import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { WebSocketServer } from "ws";
import { AdvisorySession } from "../shell/session.mjs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("report export saves SDK bytes and respects cancellation, access revocation and account changes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "advisory-export-"));
  const path = join(directory, "meeting.docx");
  let revoked = false,
    exports = 0;
  const bytes = Buffer.from([80, 75, 3, 4, 255]);
  const server = createServer(async (req, res) => {
    for await (const _ of req) {
      /* consume request */
    }
    if (req.url.endsWith("/report/document")) {
      exports++;
      res.writeHead(revoked ? 403 : 200, {
        "content-type": revoked
          ? "application/json"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      res.end(revoked ? '{"error":{"message":"应用授权已撤销"}}' : bytes);
    } else {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify(
          req.url === "/api/auth/login"
            ? { access_token: "synthetic-token" }
            : req.url.endsWith("/report")
            ? { title: "我的会议", markdown: "已保存的裁决" }
            : { username: "owner" },
        ),
      );
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  let choose = async () => path;
  const session = new AdvisorySession(
    () => {},
    (title) => {
      assert.equal(title, "我的会议");
      return choose();
    },
  );
  try {
    await session.login({
      url: `http://127.0.0.1:${server.address().port}`,
      username: "owner",
      password: "synthetic",
    });
    assert.deepEqual(await session.exportReport("room"), {
      canceled: false,
      path,
    });
    assert.deepEqual(await readFile(path), bytes);
    await rm(path);
    choose = async () => null;
    assert.deepEqual(await session.exportReport("room"), { canceled: true });
    assert.equal(exports, 1);
    choose = async () => path;
    revoked = true;
    await assert.rejects(session.exportReport("room"), /授权已撤销/);
    await assert.rejects(stat(path), { code: "ENOENT" });
    choose = async () => {
      await session.logout();
      return path;
    };
    await assert.rejects(session.exportReport("room"), /账号已变化/);
    assert.equal(exports, 2);
  } finally {
    await session.logout();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
test("main-process session keeps account token private and uses typed SDK + native room socket", async () => {
  const requests = [];
  const socketFrames = [];
  const server = createServer(async (req, res) => {
    const pieces = [];
    for await (const p of req) pieces.push(p);
    const body = Buffer.concat(pieces).toString();
    requests.push({ url: req.url, body, auth: req.headers.authorization });
    let value = {};
    if (req.url === "/api/auth/login") {
      assert.equal(JSON.parse(body).application_id, "super-advisory");
      value = { access_token: "private-session-token" };
    } else {
      assert.equal(req.headers.authorization, "Bearer private-session-token");
      if (req.url === "/api/auth/me") value = { username: "owner" };
      else if (req.url?.startsWith("/api/experts/hub"))
        value = {
          items: [
            {
              id: "skillhub-skillset-growth",
              slug: "growth",
              label: { zh: "增长专家" },
              description: { zh: "实验" },
              skill_count: 1,
            },
          ],
          scenes: [],
        };
      else if (req.url === "/api/brainstorm/experts/growth/import")
        value = { id: "skillhub-skillset-growth", name: "增长专家" };
      else if (req.url === "/api/brainstorm/profile")
        value = {
          team_id: "host",
          models: ["a/x", "b/y"],
          members: [],
          experts: [],
          host_model: "a/x",
        };
      else if (req.url === "/api/brainstorm/sessions" && req.method === "POST")
        value = { thread_id: "room", team_id: "host", status: "running" };
      else if (req.url?.endsWith("/control"))
        value = {
          thread_id: "room",
          status: JSON.parse(body).action === "pause" ? "paused" : "running",
        };
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(value));
  });
  const wss = new WebSocketServer({ server });
  wss.on("connection", (ws, req) => {
    assert.equal(
      new URL(req.url, "http://localhost").searchParams.get("token"),
      "private-session-token",
    );
    ws.on("message", (raw) => {
      const frame = JSON.parse(raw.toString());
      socketFrames.push(frame);
      if (frame.type === "subscribe")
        ws.send(
          JSON.stringify({
            type: "token",
            agent_id: "member",
            content: "新的思路",
          }),
        );
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  let resolveFrame;
  const received = new Promise((r) => {
    resolveFrame = r;
  });
  const session = new AdvisorySession(resolveFrame);
  try {
    const login = await session.login({
      url: `http://127.0.0.1:${server.address().port}`,
      username: "owner",
      password: "synthetic",
    });
    assert.deepEqual(login, {
      username: "owner",
      application_id: "super-advisory",
    });
    assert.ok(!JSON.stringify(login).includes("token"));
    assert.equal((await session.profile()).team_id, "host");
    assert.equal((await session.market("增长")).items[0].slug, "growth");
    assert.equal((await session.importExpert("growth")).name, "增长专家");
    await session.configure({
      expert_ids: ["brainstorm-product", "skillhub-skillset-growth"],
      expert_models: {
        "brainstorm-product": "a/x",
        "skillhub-skillset-growth": "b/y",
      },
    });
    const saved = requests
      .filter((r) => r.url === "/api/brainstorm/profile" && r.body)
      .at(-1);
    assert.deepEqual(JSON.parse(saved.body), {
      expert_ids: ["brainstorm-product", "skillhub-skillset-growth"],
      expert_models: {
        "brainstorm-product": "a/x",
        "skillhub-skillset-growth": "b/y",
      },
    });
    assert.equal(session.saveProvider, undefined);
    assert.equal(session.testProvider, undefined);
    assert.ok(!requests.some((r) => r.url.includes("providers")));
    const state = await session.create({
      topic: "新问题",
      context_enabled: true,
      expert_ids: ["brainstorm-product", "skillhub-skillset-growth"],
    });
    assert.equal(state.thread_id, "room");
    await session.watch("host", "room");
    const frame = await received;
    assert.equal(frame.frame.content, "新的思路");
    await session.send("room", "进一步探索");
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(socketFrames[1].type, "user_turn");
    assert.equal(
      (await session.control("room", { action: "pause" })).status,
      "paused",
    );
    await assert.rejects(session.send("other-room", "越界"), /重新连接/);
    await session.logout();
    await assert.rejects(session.profile(), /先使用 WANX/);
    assert.ok(requests.some((r) => r.url === "/api/auth/logout"));
  } finally {
    await session.logout();
    for (const client of wss.clients) client.terminate();
    await new Promise((r) => wss.close(r));
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
