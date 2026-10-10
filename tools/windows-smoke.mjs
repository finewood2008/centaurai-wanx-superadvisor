// Verify the installed executable, renderer assets and sandboxed IPC on a Windows runner.
// No account, credentials or model requests are involved.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

assert.equal(process.platform, 'win32');
const profile = await mkdtemp(join(tmpdir(), 'advisory-smoke-'));
const port = 19227;
const app = spawn(process.argv[2], [`--user-data-dir=${profile}`, `--remote-debugging-port=${port}`], { stdio: 'inherit' });
let socket;
try {
  let target;
  for (let attempt = 0; attempt < 90; attempt++) {
    if (app.exitCode !== null) throw new Error(`Application exited: ${app.exitCode}`);
    try {
      const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = pages.find(page => page.type === 'page' && page.url.startsWith('file:'));
      if (target) break;
    } catch { /* Allow Chromium to start. */ }
    await delay(500);
  }
  assert.ok(target, 'Installed application did not open its local page');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let serial = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timeout);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++serial;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 15000);
      pending.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  let state;
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = await send('Runtime.evaluate', {
      expression: `(async () => ({ text: document.body.innerText, images: Array.from(document.images).map(i => ({ loaded: i.complete && i.naturalWidth > 0 })), connection: await window.advisory.call('connectionInfo') }))()`,
      awaitPromise: true, returnByValue: true,
    });
    state = result.result.value;
    if (state?.text.includes('把难题放上桌') && state.images.length >= 2 && state.images.every(i => i.loaded)) break;
    await delay(500);
  }
  assert.ok(state?.text.includes('把难题放上桌'), 'Launch page did not render');
  assert.ok(state.images.length >= 2 && state.images.every(i => i.loaded), 'Artwork did not load');
  assert.equal(state.connection.selected, null, 'Isolated profile should have no selected service');
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile('release/windows-startup.png', Buffer.from(screenshot.data, 'base64'));
  await writeFile('release/windows-startup.json', JSON.stringify({ installedExecutable: true, launchPage: true, artwork: true, sandboxedIPC: true, realBackend: false }, null, 2));
  console.log('Installed Windows application: launch page, artwork and sandboxed IPC verified.');
} finally {
  socket?.close();
  app.kill();
}
