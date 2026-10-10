// Synthetic WANX endpoints on a real private network interface; never real credentials.
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { once } from 'node:events';
import { WebSocketServer } from 'ws';
import assert from 'node:assert/strict';

export async function startWanxFixture() {
  const address = Object.values(networkInterfaces()).flat().find(value => {
    if (!value || value.internal || value.family !== 'IPv4') return false;
    const [a, b] = value.address.split('.').map(Number);
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  })?.address;
  assert.ok(address, 'LAN regression requires an RFC1918 IPv4 interface');
  const token = 'synthetic-lan-token';
  let socketAuthenticated = false;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    let status = 200, data;
    if (req.url === '/api/health') data = { ok: true, db: true };
    else if (req.url === '/api/auth/captcha') data = { provider: 'none' };
    else if (req.url === '/.well-known/wanx') data = { product: 'wanx', protocol: 1, name: 'Windows LAN verification', version: 'fixture' };
    else if (req.url === '/api/auth/login') {
      assert.equal(body.application_id, 'super-advisory');
      if (body.username === 'fixture' && body.password === 'synthetic-only') data = { access_token: token };
      else { status = 401; data = { error: { message: '账号或密码不正确' } }; }
    } else if (req.headers.authorization !== `Bearer ${token}`) {
      status = 401; data = { error: { message: '未登录' } };
    } else if (req.url === '/api/auth/me') data = { username: 'fixture', display_name: '测试用户' };
    else if (req.url === '/api/brainstorm/profile') data = { team_id: 'fixture-host', members: [], experts: [], models: [] };
    else if (req.url === '/api/brainstorm/sessions') data = [];
    else if (req.url === '/api/auth/logout') data = {};
    else { status = 404; data = {}; }
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(data));
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', (socket, req) => {
    socketAuthenticated = new URL(req.url, 'http://localhost').searchParams.get('token') === token;
    if (!socketAuthenticated) { socket.close(1008); return; }
    socket.on('message', raw => {
      const frame = JSON.parse(raw.toString());
      if (frame.type === 'subscribe') socket.send(JSON.stringify({ type: 'token', agent_id: 'fixture-member', content: '局域网实时连接已验证' }));
    });
  });
  server.listen(0, '0.0.0.0');
  await once(server, 'listening');
  return {
    endpoint: `http://${address}:${server.address().port}`,
    authenticatedSocket: () => socketAuthenticated,
    async close() {
      for (const socket of wss.clients) socket.terminate();
      await new Promise(resolve => wss.close(resolve));
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    },
  };
}
