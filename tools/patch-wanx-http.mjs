// Compatibility patch for the pinned alpha.8 SDK. Keep the SDK's default policy;
// add an explicit private-IPv4 HTTP option for the user's selected LAN service.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = dirname(fileURLToPath(import.meta.resolve('centaurai-wanx')));
const predicate = '["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)';
const privateIPv4 = `function isPrivateIPv4(host) {
    if (isIP(host) !== 4) return false;
    const [a, b] = host.split(".").map(Number);
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
`;
const patches = [
  ['http-transport.js', source => {
    if (source.includes('allowPrivateNetworkHTTP')) return source;
    if (!source.includes(predicate) || !source.includes('import WebSocket from "ws";')) throw new Error('Unexpected WANX transport; review patch for this SDK version');
    return source.replace('import WebSocket from "ws";', 'import WebSocket from "ws";\nimport { isIP } from "node:net";\n' + privateIPv4)
      .replace(predicate, `(${predicate} || (options.allowPrivateNetworkHTTP === true && isPrivateIPv4(base.hostname)))`);
  }],
  ['http-transport.d.ts', source => {
    if (source.includes('allowPrivateNetworkHTTP')) return source;
    if (!source.includes('    baseURL: string;')) throw new Error('Unexpected WANX transport types');
    return source.replace('    baseURL: string;', '    baseURL: string;\n    /** Opt in to HTTP for explicitly selected RFC1918 IPv4 services only. */\n    allowPrivateNetworkHTTP?: boolean;');
  }],
];
const version = JSON.parse(await readFile(join(root, '../package.json'), 'utf8')).version;
if (version !== '0.1.0-alpha.8') throw new Error(`Review LAN compatibility patch before upgrading SDK ${version}`);
for (const [name, patch] of patches) {
  const path = join(root, name);
  const original = await readFile(path, 'utf8');
  const updated = patch(original);
  if (updated !== original) await writeFile(path, updated);
}
console.log('WANX alpha.8: explicit private-network HTTP compatibility patch ready.');
