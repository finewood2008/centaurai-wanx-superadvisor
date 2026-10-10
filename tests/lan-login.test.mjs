import test from 'node:test';
import assert from 'node:assert/strict';
import { createHTTPTransport } from 'centaurai-wanx';
import { AdvisorySession } from '../shell/session.mjs';
import { ServiceConnection } from '../shell/service-connection.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startWanxFixture } from '../tools/wanx-smoke-fixture.mjs';

test('SDK keeps HTTP opt-in restricted to private IPv4 services', async () => {
  for (const ip of ['10.0.0.1', '172.16.0.1', '172.31.255.254', '192.168.1.10']) {
    const baseURL = `http://${ip}:8088`;
    assert.throws(() => createHTTPTransport({ baseURL }), /INVALID_BASE_URL/);
    await createHTTPTransport({ baseURL, allowPrivateNetworkHTTP: true }).close();
  }
  for (const baseURL of ['http://8.8.8.8', 'http://169.254.169.254', 'http://172.32.0.1', 'http://192.169.1.1', 'http://example.com', 'http://name.local', 'http://u:p@10.0.0.1', 'http://10.0.0.1?token=x', 'http://10.0.0.1#x']) {
    assert.throws(() => createHTTPTransport({ baseURL, allowPrivateNetworkHTTP: true }), /INVALID_BASE_URL/);
  }
});

test('selected LAN service supports SDK login, profile and authenticated WebSocket', async t => {
  const fixture = await startWanxFixture();
  t.after(() => fixture.close());
  const dir = await mkdtemp(join(tmpdir(), 'advisory-lan-login-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let resolveFrame;
  const received = new Promise(resolve => { resolveFrame = resolve; });
  const session = new AdvisorySession(resolveFrame);
  t.after(() => session.logout());
  const connection = new ServiceConnection(join(dir, 'connection.json'));
  const selected = await connection.connect(fixture.endpoint, () => session.logout());
  assert.equal(selected.endpoint, fixture.endpoint);
  await assert.rejects(connection.login({ username: 'fixture', password: 'wrong' }, session), /账号或密码不正确/);
  assert.deepEqual(await connection.login({ username: 'fixture', password: 'synthetic-only' }, session), { username: '测试用户', application_id: 'super-advisory' });
  assert.equal((await session.profile()).team_id, 'fixture-host');
  await session.watch('fixture-host', 'fixture-room');
  const frame = await Promise.race([received, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('No LAN websocket frame')), 5000); timer.unref(); })]);
  assert.equal(frame.frame.content, '局域网实时连接已验证');
  assert.ok(fixture.authenticatedSocket());
});
