import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  createLanDiscovery,
  lanOrigin,
  probeWanx,
} from "./vendor/wanx-discovery.mjs";

// Discovery never has access to the account session or its token.
export class ServiceConnection {
  #discovery;
  #selected = null;
  #saved = null;
  constructor(file, { probe = probeWanx, discover = createLanDiscovery } = {}) {
    this.file = file;
    this.probe = probe;
    this.discover = discover;
  }
  async load() {
    try {
      const saved = JSON.parse(await readFile(this.file, "utf8"));
      this.#saved = lanOrigin(saved.endpoint);
    } catch {
      this.#saved = null;
    }
    return this.info();
  }
  info() {
    return { selected: this.#selected, savedEndpoint: this.#saved };
  }
  async scan() {
    this.#discovery ??= this.discover({
      seed: [
        ...new Set([this.#saved, "http://127.0.0.1:8088"].filter(Boolean)),
      ],
    });
    return { ...(await this.#discovery.scan()), scope: "client-lan" };
  }
  async connect(address, logout) {
    const endpoint = lanOrigin(address);
    let service;
    try {
      service = await this.probe(endpoint);
    } catch {
      throw new Error(
        "暂时无法连接这个万象WANX。请确认服务已启动、设备在同一网络，并检查地址或 HTTPS 证书。",
      );
    }
    await logout();
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify({ endpoint }), { mode: 0o600 });
    this.#selected = service;
    this.#saved = endpoint;
    this.#discovery?.close();
    this.#discovery = undefined;
    return service;
  }
  login(credentials, session) {
    if (!this.#selected) throw new Error("请先选择并连接你的万象WANX服务。");
    // The renderer cannot redirect credentials to a different service.
    return session.login({
      url: this.#selected.endpoint,
      username: credentials.username,
      password: credentials.password,
    });
  }
  close() {
    this.#discovery?.close();
  }
}
