/** Run as a WANX admin/developer. Only enables this application for a named account. */
import {
  createCentaurAIWanxClient,
  createHTTPTransport,
  operationRegistry,
} from "centaurai-wanx";
const [url, username, targetUsername] = process.argv.slice(2);
const password = process.env.WANX_ADMIN_PASSWORD;
if (!url || !username || !targetUsername || !password) {
  console.error(
    "用法：WANX_ADMIN_PASSWORD=<从环境读取> node tools/enable-application.mjs <WANX地址> <管理员账号> <使用者账号>",
  );
  process.exit(1);
}
let token = null;
const client = createCentaurAIWanxClient({
  transport: createHTTPTransport({ baseURL: url, token: async () => token }),
  policy: {
    applicationId: "wanx",
    operations: operationRegistry
      .filter(
        (o) =>
          o.tags.includes("applications") ||
          ["/api/auth/login", "/api/auth/logout", "/api/users"].includes(
            o.path,
          ),
      )
      .map((o) => o.operationId),
    sockets: [],
  },
});
function value(r) {
  if (r.status < 200 || r.status >= 300)
    throw new Error(r.body?.error?.message || `WANX 请求失败 ${r.status}`);
  return r.body;
}
try {
  token = value(
    await client.modules.auth.login({
      body: { username, password, application_id: "wanx" },
    }),
  ).access_token;
  const id = "super-advisory";
  const products = value(await client.applications.list());
  if (!products.some((p) => p.application_id === id))
    value(
      await client.applications.create({
        application_id: id,
        name: "半人马AI-超级参谋团",
        description: "由主持人自动推进、结合知君个人上下文的多模型头脑风暴。",
        capabilities: ["chat", "teams", "brainstorm", "zhijun_context"],
        agent_template: {},
        resource_requirements: {},
      }),
    );
  const definition = value(await client.applications.get(id));
  if (
    !["chat", "teams", "brainstorm", "zhijun_context"].every((c) =>
      definition.capabilities.includes(c),
    )
  )
    throw new Error("已有应用定义缺少能力，请在 WANX 应用管理中核对配置。");
  if (definition.capabilities.includes("model_settings"))
    value(
      await client.applications.update(id, {
        capabilities: definition.capabilities.filter(
          (c) => c !== "model_settings",
        ),
      }),
    );
  const current = value(await client.applications.getDeployment(id));
  value(
    await client.applications.putDeployment(id, {
      enabled: true,
      resource_bindings: current.resource_bindings,
      configuration: current.configuration,
    }),
  );
  const usersOp = operationRegistry.find(
    (o) => o.method === "GET" && o.path === "/api/users",
  );
  const users = value(await client.native.invoke(usersOp.operationId, {}));
  const owner = (Array.isArray(users) ? users : users.users).find(
    (u) => u.username === targetUsername,
  );
  if (!owner) throw new Error("没有找到目标 WANX 账号。");
  value(
    await client.applications.putAccess(id, {
      user_id: owner.id,
      enabled: true,
    }),
  );
  console.log("超级参谋团已启用，并已为指定 WANX 账号授权。");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    if (token) await client.modules.auth.logout({});
  } catch {}
  await client.close();
  token = null;
}
