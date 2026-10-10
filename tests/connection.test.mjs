import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ServiceConnection } from "../shell/service-connection.mjs";
import { lanOrigin, probeWanx } from "../shell/vendor/wanx-discovery.mjs";

test("discovery probes only public metadata without credentials; redirects and unrelated services are rejected", async () => {
  const calls = [];
  const service = await probeWanx(
    "http://192.168.0.2:8088",
    async (url, options) => {
      calls.push({ url, options });
      return Response.json(
        url.endsWith("/api/health")
          ? { ok: true, db: true }
          : url.endsWith("/api/auth/captcha")
          ? { provider: "none" }
          : { product: "wanx", protocol: 1, name: "My WANX", version: "1.0" },
      );
    },
  );
  assert.equal(service.name, "My WANX");
  assert.ok(
    calls.every(
      ({ options }) =>
        options.redirect === "error" && !options.headers.Authorization,
    ),
  );
  assert.ok(calls.every(({ url }) => !url.includes("/login")));
  await assert.rejects(
    probeWanx("http://127.0.0.1:8088", async () => Response.json({ ok: true })),
    /不是兼容/,
  );
  await assert.rejects(
    probeWanx(
      "http://127.0.0.1:8088",
      async () => new Response(null, { status: 302 }),
    ),
    /没有响应/,
  );
  await assert.rejects(
    probeWanx(
      "http://127.0.0.1:8088",
      async () => new Response(" ".repeat(20000)),
    ),
    /无效/,
  );
});

test("manual addresses use the same LAN-only policy as Zhijun and never accept embedded credentials", () => {
  for (const address of [
    "https://example.com",
    "http://169.254.169.254",
    "http://u:secret@192.168.0.2",
    "http://192.168.0.2/api",
    "http://192.168.0.2/?token=secret",
    "file:///tmp/test",
  ])
    assert.throws(() => lanOrigin(address));
  assert.equal(lanOrigin("http://127.0.0.1:8088/"), "http://127.0.0.1:8088");
});

test("remembered service is only a discovery seed after restart; login uses the explicit selected endpoint", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "advisory-connection-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "connection.json"),
    calls = [];
  let seeds,
    closed = 0;
  const options = {
    probe: async (endpoint) => ({
      endpoint,
      name: "WANX",
      version: "1",
      advertised: true,
    }),
    discover: ({ seed }) => {
      seeds = seed;
      return {
        scan: async () => ({ services: [], scope: "server-lan" }),
        close: () => closed++,
      };
    },
  };
  const connection = new ServiceConnection(file, options);
  await connection.load();
  assert.throws(() => connection.login({}, {}), /请先选择/);
  await connection.scan();
  assert.deepEqual(seeds, ["http://127.0.0.1:8088"]);
  await connection.connect("http://192.168.0.2:8088", async () =>
    calls.push("logout"),
  );
  await connection.login(
    { username: "test", password: "test-secret", url: "http://192.168.0.99" },
    { login: async (body) => calls.push(body) },
  );
  assert.equal(calls[0], "logout");
  assert.equal(calls[1].url, "http://192.168.0.2:8088");
  assert.deepEqual(JSON.parse(await readFile(file, "utf8")), {
    endpoint: "http://192.168.0.2:8088",
  });
  assert.equal(closed, 1);
  const restarted = new ServiceConnection(file, options);
  assert.deepEqual(await restarted.load(), {
    selected: null,
    savedEndpoint: "http://192.168.0.2:8088",
  });
  assert.equal((await restarted.scan()).scope, "client-lan");
  assert.deepEqual(seeds, ["http://192.168.0.2:8088", "http://127.0.0.1:8088"]);
  restarted.close();
});

test("failed selection preserves the previous endpoint and session; successful switching logs out first", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "advisory-switch-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let offline = false,
    logouts = 0;
  const connection = new ServiceConnection(join(dir, "connection.json"), {
    probe: async (endpoint) => {
      if (offline) throw new Error("timeout");
      return { endpoint, name: "WANX" };
    },
  });
  const logout = async () => {
    logouts++;
  };
  await connection.connect("http://192.168.0.2:8088", logout);
  offline = true;
  await assert.rejects(
    connection.connect("http://192.168.0.3:8088", logout),
    /暂时无法连接/,
  );
  assert.equal(logouts, 1);
  assert.equal(connection.info().selected.endpoint, "http://192.168.0.2:8088");
  offline = false;
  await connection.connect("http://192.168.0.3:8088", logout);
  assert.equal(logouts, 2);
  assert.equal(connection.info().selected.endpoint, "http://192.168.0.3:8088");
});
