import { useEffect, useRef, useState, type FormEvent } from "react";
import { call, type WanxService } from "./bridge";
import "./login.css";

const mark = new URL("./assets/centaurai-mark.png", import.meta.url).href;
const councilArtwork = new URL(
  "./assets/ai-council-brands.png",
  import.meta.url,
).href;
const serviceName = (name: string) =>
  name.replace(/(?:万象)?WANX/g, "万象WANX");
const message = (error: unknown) =>
  error instanceof Error ? error.message : "连接暂未完成，请重试。";

export default function Login({
  onLogin,
}: {
  onLogin: (credentials: {
    username: string;
    password: string;
  }) => Promise<void>;
}) {
  const [selected, setSelected] = useState<WanxService | null>(null);
  const [services, setServices] = useState<WanxService[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [stage, setStage] = useState<"connect" | "login">("connect");
  const [searching, setSearching] = useState(true);
  const [searched, setSearched] = useState(false);
  const [connecting, setConnecting] = useState("");
  const [address, setAddress] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const searchId = useRef(0);
  const account = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let canceled = false;
    const id = ++searchId.current;
    void (async () => {
      try {
        const info = await call("connectionInfo");
        if (canceled) return;
        setSaved(info.savedEndpoint);
        if (info.selected) {
          setSelected(info.selected);
          setStage("login");
        }
        const result = await call("discoverServices");
        if (!canceled && id === searchId.current) {
          setServices(result.services);
          setSearched(true);
        }
      } catch (e) {
        if (!canceled && id === searchId.current) setError(message(e));
      } finally {
        if (!canceled && id === searchId.current) setSearching(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);
  useEffect(() => {
    if (stage === "login") account.current?.focus();
  }, [stage]);

  async function search() {
    const id = ++searchId.current;
    setSearching(true);
    setError("");
    try {
      const result = await call("discoverServices");
      if (id === searchId.current) {
        setServices(result.services);
        setSearched(true);
      }
    } catch (e) {
      if (id === searchId.current) setError(message(e));
    } finally {
      if (id === searchId.current) setSearching(false);
    }
  }
  async function connect(endpoint: string) {
    if (locked.current) return;
    locked.current = true;
    setConnecting(endpoint);
    setError("");
    try {
      const service = await call("connectService", endpoint);
      setSelected(service);
      setSaved(service.endpoint);
      setPassword("");
      setVisible(false);
      setStage("login");
    } catch (e) {
      setError(message(e));
    } finally {
      locked.current = false;
      setConnecting("");
    }
  }
  async function login(event: FormEvent) {
    event.preventDefault();
    if (locked.current || !selected || !username.trim() || !password) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await onLogin({ username: username.trim(), password });
      setPassword("");
    } catch (e) {
      setError(message(e));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function changeService() {
    setPassword("");
    setVisible(false);
    setError("");
    setStage("connect");
    if (!searching) void search();
  }

  return (
    <main className="welcome-page">
      <section className="welcome-story" aria-label="关于超级参谋团">
        <div className="welcome-brand">
          <img src={mark} alt="半人马AI" />
          <div>
            <b>半人马AI</b>
            <span>超级参谋团</span>
          </div>
        </div>
        <div className="welcome-editorial">
          <span className="welcome-kicker">
            <i /> YOUR QUESTION. OUR COUNCIL.
          </span>
          <h1>
            把难题放上桌。
            <br />
            <em>让答案更清楚。</em>
          </h1>
          <p>
            不必一个人想透所有事。
            <br />
            让不同的视角围绕你的问题展开，
            <br />
            由你决定，下一步怎么走。
          </p>
          <figure className="council-illustration">
            <img
              src={councilArtwork}
              alt="六位分别带有 Claude、GPT、Gemini、Grok、DeepSeek、Qwen 标识的 AI 参谋，与人类决策者围桌商议。"
              width="1536"
              height="1024"
            />
            <figcaption>让不同的智慧，在你的问题上相遇。</figcaption>
          </figure>
        </div>
        <footer className="welcome-story-footer">
          <span>众智相谋 · 决定在你</span>
          <span>CENTAUR AI</span>
        </footer>
      </section>

      <section className="welcome-access" aria-label="连接与登录">
        <nav className="welcome-steps" aria-label="登录步骤">
          <span aria-current={stage === "connect" ? "step" : undefined}>
            <b>{stage === "login" ? "✓" : "01"}</b>连接服务
          </span>
          <i />
          <span aria-current={stage === "login" ? "step" : undefined}>
            <b>02</b>登录账号
          </span>
        </nav>
        <div className="access-card">
          <span className="access-kicker">
            {stage === "connect"
              ? "每场好讨论，从连接开始"
              : "你的参谋团，等你入席"}
          </span>
          <h2>
            {stage === "connect" ? "先找到你的万象" : "欢迎来到超级参谋团"}
          </h2>
          <p className="access-intro">
            {stage === "connect"
              ? "选择保存你账号与资料的万象WANX服务。"
              : "使用你的万象WANX账号登录。"}
          </p>

          {stage === "connect" ? (
            <>
              <div className="discovery-heading">
                <span>
                  <i className={searching ? "signal searching" : "signal"} />
                  {searching ? "正在寻找附近的服务…" : "可连接的服务"}
                </span>
                <button
                  type="button"
                  className="access-text-button"
                  disabled={searching || !!connecting}
                  onClick={() => void search()}
                >
                  重新搜索 <span aria-hidden="true">↻</span>
                </button>
              </div>
              <div
                className="service-results"
                aria-live="polite"
                aria-busy={searching}
              >
                {services.map((service) => (
                  <button
                    type="button"
                    className="service-choice"
                    key={service.endpoint}
                    disabled={!!connecting}
                    onClick={() => void connect(service.endpoint)}
                    aria-label={`连接 ${serviceName(service.name)} ${
                      service.endpoint
                    }`}
                  >
                    <span className="service-icon" aria-hidden="true">
                      ▤
                    </span>
                    <span className="service-copy">
                      <strong>{serviceName(service.name)}</strong>
                      <span>{service.endpoint}</span>
                      <small>
                        {service.version ? `v${service.version} · ` : ""}
                        {service.endpoint === saved
                          ? "上次使用"
                          : new URL(service.endpoint).hostname === "127.0.0.1"
                          ? "这台电脑"
                          : "局域网服务"}
                      </small>
                    </span>
                    <span className="service-arrow">
                      {connecting === service.endpoint ? "连接中…" : "→"}
                    </span>
                  </button>
                ))}
                {!services.length && (
                  <div className="discovery-empty">
                    <span
                      className={
                        searching
                          ? "discovery-radar scanning"
                          : "discovery-radar"
                      }
                      aria-hidden="true"
                    >
                      <i />
                    </span>
                    <b>
                      {searching
                        ? "为你寻找万象WANX"
                        : searched
                        ? "暂未发现服务"
                        : "搜索暂未完成"}
                    </b>
                    <p>
                      {searching
                        ? "请稍等片刻，发现的服务会出现在这里。"
                        : "确认服务已启动，并连接到同一个局域网。也可以手动输入地址。"}
                    </p>
                  </div>
                )}
              </div>
              {saved &&
                !searching &&
                !services.some((s) => s.endpoint === saved) && (
                  <p className="saved-unavailable">
                    上次使用的服务暂未找到：{saved}
                  </p>
                )}
              <details className="manual-connection">
                <summary>
                  没有找到？手动输入地址 <span aria-hidden="true">＋</span>
                </summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void connect(address.trim());
                  }}
                >
                  <label htmlFor="service-address">万象WANX服务地址</label>
                  <div>
                    <input
                      id="service-address"
                      type="url"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="http://192.168.1.10:8088"
                      required
                      disabled={!!connecting}
                    />
                    <button
                      type="submit"
                      disabled={!!connecting || !address.trim()}
                    >
                      {connecting === address.trim() ? "连接中…" : "连接"}
                    </button>
                  </div>
                  <p>支持本机与局域网 IPv4 地址。</p>
                </form>
              </details>
              {selected && (
                <button
                  type="button"
                  className="access-text-button return-login"
                  disabled={!!connecting}
                  onClick={() => {
                    setError("");
                    setStage("login");
                  }}
                >
                  返回已连接服务的登录页 →
                </button>
              )}
            </>
          ) : (
            <>
              <div className="selected-service">
                <i className="signal" />
                <div>
                  <strong>{serviceName(selected!.name)}</strong>
                  <span>{selected!.endpoint}</span>
                </div>
                <button
                  type="button"
                  className="access-text-button"
                  onClick={changeService}
                  disabled={busy}
                >
                  更换
                </button>
              </div>
              <form
                className="welcome-login-form"
                onSubmit={login}
                aria-label="登录超级参谋团"
              >
                <label htmlFor="login-account">账号</label>
                <input
                  ref={account}
                  id="login-account"
                  autoComplete="username"
                  placeholder="输入你的万象WANX账号"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={busy}
                />
                <label htmlFor="login-password">密码</label>
                <div className="password-field">
                  <input
                    id="login-password"
                    type={visible ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={busy}
                  />
                  <button
                    type="button"
                    aria-label={visible ? "隐藏密码" : "显示密码"}
                    aria-pressed={visible}
                    onClick={() => setVisible((v) => !v)}
                    disabled={busy}
                  >
                    {visible ? "隐藏" : "显示"}
                  </button>
                </div>
                <button
                  type="submit"
                  className="primary welcome-submit"
                  disabled={busy || !username.trim() || !password}
                >
                  {busy ? "正在进入…" : "进入超级参谋团"}
                  <span aria-hidden="true">→</span>
                </button>
              </form>
              <p className="access-privacy">
                <span aria-hidden="true">◇</span>{" "}
                会议围绕你展开，知君资料由你选择是否带入。
              </p>
            </>
          )}
          {error && (
            <div className="error access-error" role="alert">
              {error}
            </div>
          )}
        </div>
        <footer className="welcome-access-footer">
          <span>先聊清问题，再一起找答案。</span>
          <button
            type="button"
            className="access-text-button"
            disabled={busy || !!connecting}
            onClick={changeService}
          >
            <i className="signal" />
            连接服务
          </button>
        </footer>
      </section>
    </main>
  );
}
