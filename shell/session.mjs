import {
  createCentaurAIWanxClient,
  createHTTPTransport,
  operationRegistry,
} from "centaurai-wanx";
import { writeFile } from "node:fs/promises";
const APPLICATION_ID = "super-advisory";
const operations = [
  "login_api_auth_login_post",
  "me_api_auth_me_get",
  "logout_api_auth_logout_post",
  "list_expert_hub_api_experts_hub_get",
  "get_thread_history_api_agents__agent_id__threads__thread_id__history_get",
  ...operationRegistry
    .filter((o) => o.tags.includes("brainstorm"))
    .map((o) => o.operationId),
];
const policy = { applicationId: APPLICATION_ID, operations, sockets: ["chat"] };
function unwrap(response) {
  if (response.status < 200 || response.status >= 300) {
    const code = response.body?.error?.code;
    const message = response.body?.error?.message ?? response.body?.detail;
    throw new Error(
      typeof message === "string"
        ? message
        : `WANX 请求失败（${response.status}${code ? " · " + code : ""}）`,
    );
  }
  return response.body;
}
/** Token and transport stay in the trusted main process. No raw SDK access crosses IPC. */
export class AdvisorySession {
  #client;
  #token = null;
  #socket;
  #generation = 0;
  #room;
  #watchGeneration = 0;
  constructor(emit = () => {}, chooseReportPath = async () => null) {
    this.emit = emit;
    this.chooseReportPath = chooseReportPath;
  }
  async login({ url, username, password }) {
    await this.logout();
    this.#client = createCentaurAIWanxClient({
      transport: createHTTPTransport({
        baseURL: url,
        token: async () => this.#token,
      }),
      policy,
    });
    try {
      const data = unwrap(
        await this.#client.modules.auth.login({
          body: { username, password, application_id: APPLICATION_ID },
        }),
      );
      this.#token = data.access_token;
      const user = unwrap(await this.#client.modules.auth.me({}));
      return {
        username: user.display_name || user.username,
        application_id: APPLICATION_ID,
      };
    } catch (error) {
      await this.logout();
      throw error;
    }
  }
  #require() {
    if (!this.#client || !this.#token)
      throw new Error("请先使用 WANX 账号登录。");
    return this.#client;
  }
  async profile() {
    return unwrap(await this.#require().modules.brainstorm.getProfile({}));
  }
  async configure(body) {
    return unwrap(
      await this.#require().modules.brainstorm.configureProfile({ body }),
    );
  }
  async market(q = "") {
    return unwrap(
      await this.#require().modules.experts.listExpertHub({ query: { q } }),
    );
  }
  async importExpert(slug) {
    return unwrap(
      await this.#require().modules.brainstorm.importExpert({ path: { slug } }),
    );
  }
  async list() {
    return unwrap(await this.#require().modules.brainstorm.listSessions({}));
  }
  async get(thread_id) {
    return unwrap(
      await this.#require().modules.brainstorm.getSession({
        path: { thread_id },
      }),
    );
  }
  async report(thread_id) {
    return unwrap(
      await this.#require().modules.brainstorm.getReport({
        path: { thread_id },
      }),
    );
  }
  async exportReport(thread_id) {
    const generation = this.#generation;
    const report = await this.report(thread_id);
    const path = await this.chooseReportPath(report.title);
    if (!path) return { canceled: true };
    if (generation !== this.#generation)
      throw new Error("账号已变化，请重新导出。");
    const bytes = unwrap(
      await this.#require().modules.brainstorm.exportReport({
        path: { thread_id },
      }),
    );
    if (generation !== this.#generation)
      throw new Error("账号已变化，请重新导出。");
    await writeFile(path, bytes);
    return { canceled: false, path };
  }
  async create(body) {
    return unwrap(
      await this.#require().modules.brainstorm.createSession({ body }),
    );
  }
  async control(thread_id, body) {
    return unwrap(
      await this.#require().modules.brainstorm.controlSession({
        path: { thread_id },
        body,
      }),
    );
  }
  async history(team_id, thread_id, cursor) {
    return unwrap(
      await this.#require().modules.chat.getThreadHistory({
        path: { agent_id: team_id, thread_id },
        query: { limit: 200, ...(cursor ? { cursor } : {}) },
      }),
    );
  }
  async watch(team_id, thread_id) {
    const client = this.#require();
    const generation = this.#generation;
    const watching = ++this.#watchGeneration;
    await this.#socket?.close();
    this.#room = undefined;
    const socket = await client.openSocket({
      endpoint: "chat",
      agentId: team_id,
    });
    if (generation !== this.#generation || watching !== this.#watchGeneration) {
      await socket.close();
      return;
    }
    this.#socket = socket;
    this.#room = { team_id, thread_id };
    await socket.send({
      kind: "text",
      text: JSON.stringify({ type: "subscribe", thread_id }),
    });
    void (async () => {
      try {
        for await (const frame of socket.frames) {
          if (
            generation !== this.#generation ||
            watching !== this.#watchGeneration
          )
            return;
          if (frame.kind === "text")
            this.emit({ thread_id, frame: JSON.parse(frame.text) });
        }
      } catch {
        if (
          generation === this.#generation &&
          watching === this.#watchGeneration
        )
          this.emit({
            thread_id,
            frame: {
              type: "connection_lost",
              message: "实时连接已断开，已保存内容仍可查看。",
            },
          });
      }
    })();
  }
  async send(thread_id, text) {
    this.#require();
    if (!this.#socket || this.#room?.thread_id !== thread_id)
      throw new Error("请重新连接讨论后发送。");
    if (typeof text !== "string" || !text.trim() || text.length > 12000)
      throw new Error("请输入有效的讨论内容。");
    await this.#socket.send({
      kind: "text",
      text: JSON.stringify({ type: "user_turn", thread_id, text }),
    });
  }
  async logout() {
    this.#generation++;
    this.#watchGeneration++;
    this.#room = undefined;
    const old = this.#client;
    this.#client = undefined;
    if (old) {
      try {
        if (this.#token) await old.modules.auth.logout({});
      } catch {
      } finally {
        await old.close();
      }
    }
    this.#token = null;
    this.#socket = undefined;
  }
}
